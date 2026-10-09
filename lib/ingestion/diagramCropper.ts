import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface DiagramBBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  page_number: number;
}

export interface CropResult {
  localPath: string;
  publicUrl?: string;
  webPath?: string;
  width?: number;
  height?: number;
}

/**
 * Validates whether a given bounding box represents an extractable diagram
 * or is missing/degenerate (e.g. pure text table or zero area).
 */
export function isDiagramBBoxValid(bbox?: DiagramBBox | null): boolean {
  if (!bbox) return false;

  const { ymin, xmin, ymax, xmax } = bbox;
  if (
    ymin === undefined ||
    xmin === undefined ||
    ymax === undefined ||
    xmax === undefined ||
    isNaN(ymin) ||
    isNaN(xmin) ||
    isNaN(ymax) ||
    isNaN(xmax)
  ) {
    return false;
  }

  // All coordinates are zero
  if (ymin === 0 && xmin === 0 && ymax === 0 && xmax === 0) {
    return false;
  }

  // Inverted bounding box
  if (ymax <= ymin || xmax <= xmin) {
    return false;
  }

  // Check scale: if coordinates are in [0..1000] vs [0..1]
  const maxVal = Math.max(Math.abs(ymin), Math.abs(xmin), Math.abs(ymax), Math.abs(xmax));
  const scale = maxVal > 1.0 ? 1000.0 : 1.0;

  const widthFraction = (xmax - xmin) / scale;
  const heightFraction = (ymax - ymin) / scale;

  // If area is negligible (<0.5% width or height), it's likely a misdetected text artifact
  if (widthFraction < 0.005 || heightFraction < 0.005) {
    return false;
  }

  return true;
}

/**
 * Normalizes a target filename into a safe .png name without directory traversals.
 */
export function sanitizeDiagramFilename(targetFilename: string): string {
  let clean = targetFilename.trim();
  // Strip any leading web or folder prefixes
  clean = clean.replace(/^public\/questions\//i, '');
  clean = clean.replace(/^\/?questions\//i, '');
  clean = path.basename(clean);

  if (!clean.toLowerCase().endsWith('.png')) {
    clean += '.png';
  }
  return clean;
}

/**
 * Crops a diagram from a PDF at the specified normalized bounding box
 * and uploads to Supabase Storage if a client is provided.
 *
 * @param pdfPath - Absolute or relative path to the source PDF file
 * @param bbox - Normalized bounding box [ymin, xmin, ymax, xmax] and 1-indexed page_number
 * @param targetFilename - Destination filename (e.g. '0455_s25_12_2025_q04.png')
 * @param supabaseClient - Optional Supabase client (service role) to upload to 'question-diagrams'
 * @returns Object with localPath ('public/questions/[filename].png') and optional publicUrl
 */
export async function cropAndUploadDiagram(
  pdfPath: string,
  bbox: { ymin: number; xmin: number; ymax: number; xmax: number; page_number: number } | null | undefined,
  targetFilename: string,
  supabaseClient?: any
): Promise<{ localPath: string; publicUrl?: string; webPath?: string; width?: number; height?: number }> {
  // 1. Graceful fallback check: missing bbox or pure text table
  if (!isDiagramBBoxValid(bbox)) {
    console.warn(
      `[diagramCropper] Skipping crop for "${targetFilename}": Bounding box is missing, empty, or degenerate (pure text table).`
    );
    return { localPath: '', publicUrl: undefined, webPath: '' };
  }

  const validBBox = bbox as DiagramBBox;

  // 2. Validate PDF existence
  const absolutePdfPath = path.resolve(process.cwd(), pdfPath);
  if (!fs.existsSync(absolutePdfPath)) {
    console.warn(`[diagramCropper] PDF file not found at: ${absolutePdfPath}`);
    return { localPath: '', publicUrl: undefined, webPath: '' };
  }

  // 3. Prepare target output directory and filename
  const cleanFilename = sanitizeDiagramFilename(targetFilename);
  const localOutputDir = path.resolve(process.cwd(), 'public/questions');
  await fs.promises.mkdir(localOutputDir, { recursive: true });

  const absoluteOutputPath = path.join(localOutputDir, cleanFilename);
  const relativeLocalPath = `public/questions/${cleanFilename}`;
  const webPath = `/questions/${cleanFilename}`;

  // 4. Execute high-resolution 300 DPI crop via scripts/crop_box.py
  const scriptPath = path.resolve(process.cwd(), 'scripts/crop_box.py');
  const pythonBin = process.env.PYTHON_BIN || 'python3';

  let cropOutput: { width?: number; height?: number } = {};

  try {
    const pageNum = validBBox.page_number && validBBox.page_number > 0 ? validBBox.page_number : 1;
    const args = [
      scriptPath,
      '--pdf', absolutePdfPath,
      '--page', String(pageNum),
      '--ymin', String(validBBox.ymin),
      '--xmin', String(validBBox.xmin),
      '--ymax', String(validBBox.ymax),
      '--xmax', String(validBBox.xmax),
      '--out', absoluteOutputPath,
      '--dpi', '300',
      '--padding', '8.0',
    ];

    const { stdout, stderr } = await execFileAsync(pythonBin, args, {
      maxBuffer: 10 * 1024 * 1024,
    });

    if (stderr && stderr.trim().length > 0) {
      console.warn(`[diagramCropper] Python script stderr: ${stderr.trim()}`);
    }

    const trimmed = stdout.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed.success) {
          console.warn(`[diagramCropper] Cropper reported issue: ${parsed.reason || parsed.error}`);
          if (parsed.reason === 'degenerate_or_missing_bbox') {
            return { localPath: '', publicUrl: undefined, webPath: '' };
          }
        } else {
          cropOutput = {
            width: parsed.width,
            height: parsed.height,
          };
        }
      } catch (e) {
        console.warn(`[diagramCropper] Could not parse cropper output: ${trimmed}`);
      }
    }
  } catch (err: any) {
    console.error(`[diagramCropper] Cropping failed for ${cleanFilename}: ${err.message}`);
    // If output file wasn't created, return fallback
    if (!fs.existsSync(absoluteOutputPath)) {
      return { localPath: '', publicUrl: undefined, webPath: '' };
    }
  }

  // Check if file was successfully written
  if (!fs.existsSync(absoluteOutputPath)) {
    console.warn(`[diagramCropper] Expected output file not found at: ${absoluteOutputPath}`);
    return { localPath: '', publicUrl: undefined, webPath: '' };
  }

  let publicUrl: string | undefined = undefined;

  // 5. Supabase Storage upload (bucket: 'question-diagrams')
  if (supabaseClient && supabaseClient.storage) {
    try {
      const bucketName = 'question-diagrams';
      const fileBuffer = await fs.promises.readFile(absoluteOutputPath);

      // Attempt to ensure bucket exists if service role permissions allow
      try {
        const { data: buckets } = await supabaseClient.storage.listBuckets();
        const exists = buckets?.some((b: any) => b.name === bucketName);
        if (!exists) {
          await supabaseClient.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          });
        }
      } catch {
        // Ignore bucket listing/creation errors (client may only have object-level permissions)
      }

      // Upload image
      const storageKey = cleanFilename;
      const { error: uploadError } = await supabaseClient.storage
        .from(bucketName)
        .upload(storageKey, fileBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.warn(`[diagramCropper] Supabase Storage upload failed: ${uploadError.message}`);
      } else {
        const { data: publicUrlData } = supabaseClient.storage
          .from(bucketName)
          .getPublicUrl(storageKey);

        if (publicUrlData && publicUrlData.publicUrl) {
          publicUrl = publicUrlData.publicUrl;
        }
      }
    } catch (storageErr: any) {
      console.warn(`[diagramCropper] Supabase Storage exception: ${storageErr.message}`);
    }
  }

  return {
    localPath: relativeLocalPath,
    publicUrl,
    webPath,
    width: cropOutput.width,
    height: cropOutput.height,
  };
}

/**
 * Batch crops multiple diagrams from a PDF.
 */
export async function batchCropDiagrams(
  pdfPath: string,
  items: Array<{
    bbox?: DiagramBBox | null;
    targetFilename: string;
  }>,
  supabaseClient?: any
): Promise<Array<{ localPath: string; publicUrl?: string; webPath?: string }>> {
  const results: Array<{ localPath: string; publicUrl?: string; webPath?: string }> = [];

  for (const item of items) {
    const res = await cropAndUploadDiagram(pdfPath, item.bbox, item.targetFilename, supabaseClient);
    results.push(res);
  }

  return results;
}
