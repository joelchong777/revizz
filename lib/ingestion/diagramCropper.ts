import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

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
 * Safely supports normalized [0..1000] and [0..1] coordinate ranges.
 */
export function isDiagramBBoxValid(bbox?: DiagramBBox | null): boolean {
  if (!bbox || typeof bbox !== 'object') return false;

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

  // Negative coordinates check (allow small floating point rounding error down to -0.01)
  if (ymin < -0.01 || xmin < -0.01 || ymax < -0.01 || xmax < -0.01) {
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
 * Normalizes bounding box coordinates into either [0..1] standard float range (default)
 * or [0..1000] Gemini coordinate range.
 *
 * @param bbox - Bounding box in [0..1], [0..1000], or pixel space
 * @param targetScale - Target scale (1 for [0..1] floats, 1000 for [0..1000] integers/floats). Defaults to 1.
 * @param sourceDimensions - Optional source pixel dimensions { width, height }
 * @returns Normalized DiagramBBox
 */
export function normalizeBBox(
  bbox: DiagramBBox,
  targetScale: 1 | 1000 = 1,
  sourceDimensions?: { width: number; height: number }
): DiagramBBox {
  let ny_min: number;
  let nx_min: number;
  let ny_max: number;
  let nx_max: number;

  if (sourceDimensions && sourceDimensions.width > 0 && sourceDimensions.height > 0) {
    ny_min = bbox.ymin / sourceDimensions.height;
    nx_min = bbox.xmin / sourceDimensions.width;
    ny_max = bbox.ymax / sourceDimensions.height;
    nx_max = bbox.xmax / sourceDimensions.width;
  } else {
    const coords = [bbox.ymin, bbox.xmin, bbox.ymax, bbox.xmax];
    const maxVal = Math.max(...coords.map((c) => Math.abs(c)));
    const scale = maxVal > 1.0 ? 1000.0 : 1.0;

    ny_min = bbox.ymin / scale;
    nx_min = bbox.xmin / scale;
    ny_max = bbox.ymax / scale;
    nx_max = bbox.xmax / scale;
  }

  // Clamp to [0..1]
  ny_min = Math.max(0, Math.min(1, ny_min));
  nx_min = Math.max(0, Math.min(1, nx_min));
  ny_max = Math.max(ny_min, Math.min(1, ny_max));
  nx_max = Math.max(nx_min, Math.min(1, nx_max));

  if (targetScale === 1000) {
    return {
      ymin: Math.round(ny_min * 1000),
      xmin: Math.round(nx_min * 1000),
      ymax: Math.round(ny_max * 1000),
      xmax: Math.round(nx_max * 1000),
      page_number: bbox.page_number || 1,
    };
  }

  return {
    ymin: Number(ny_min.toFixed(6)),
    xmin: Number(nx_min.toFixed(6)),
    ymax: Number(ny_max.toFixed(6)),
    xmax: Number(nx_max.toFixed(6),),
    page_number: bbox.page_number || 1,
  };
}

/**
 * Denormalizes a bounding box to pixel coordinates or target scale.
 *
 * @param bbox - DiagramBBox in [0..1] or [0..1000]
 * @param target - Target pixel dimensions { width, height } or numeric scale (e.g. 1000)
 * @returns Denormalized DiagramBBox with coordinates scaled to target
 */
export function denormalizeBBox(
  bbox: DiagramBBox,
  target: { width: number; height: number } | number = 1000
): DiagramBBox {
  const norm = normalizeBBox(bbox, 1);

  let targetWidth: number;
  let targetHeight: number;

  if (typeof target === 'number') {
    targetWidth = target;
    targetHeight = target;
  } else {
    targetWidth = target.width;
    targetHeight = target.height;
  }

  const ymin = Math.max(0, Math.min(targetHeight, Math.round(norm.ymin * targetHeight)));
  const xmin = Math.max(0, Math.min(targetWidth, Math.round(norm.xmin * targetWidth)));
  const ymax = Math.max(ymin, Math.min(targetHeight, Math.round(norm.ymax * targetHeight)));
  const xmax = Math.max(xmin, Math.min(targetWidth, Math.round(norm.xmax * targetWidth)));

  return {
    ymin,
    xmin,
    ymax,
    xmax,
    page_number: bbox.page_number || 1,
  };
}

/**
 * Generates exact pixel crop coordinates { left, top, width, height } for image cropping libraries.
 * Applies optional padding in pixels clamped to image boundaries.
 */
export function getCropPixelCoordinates(
  bbox: DiagramBBox,
  imageWidth: number,
  imageHeight: number,
  padding: number = 0
): { left: number; top: number; width: number; height: number } {
  const pixelBBox = denormalizeBBox(bbox, { width: imageWidth, height: imageHeight });

  const left = Math.max(0, pixelBBox.xmin - padding);
  const top = Math.max(0, pixelBBox.ymin - padding);
  const right = Math.min(imageWidth, pixelBBox.xmax + padding);
  const bottom = Math.min(imageHeight, pixelBBox.ymax + padding);

  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return { left, top, width, height };
}

/**
 * Normalizes a target filename into a safe .png name without directory traversals.
 */
export function sanitizeDiagramFilename(targetFilename: string): string {
  let clean = targetFilename.trim();
  clean = clean.replace(/^public\/questions\//i, '');
  clean = clean.replace(/^\/?questions\//i, '');
  clean = path.basename(clean);

  if (!clean.toLowerCase().endsWith('.png')) {
    clean += '.png';
  }
  return clean;
}

/**
 * In-memory image buffer cropper using Sharp.
 */
export async function cropImageBuffer(
  imageBuffer: Buffer,
  bbox: DiagramBBox,
  options?: { padding?: number }
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const imgWidth = metadata.width || 1000;
  const imgHeight = metadata.height || 1000;

  const cropCoords = getCropPixelCoordinates(bbox, imgWidth, imgHeight, options?.padding ?? 4);

  const cropped = await image
    .extract(cropCoords)
    .png({ compressionLevel: 8 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: cropped.data,
    width: cropped.info.width,
    height: cropped.info.height,
  };
}

/**
 * Uploads an image buffer to Supabase Storage bucket 'question-diagrams',
 * falling back to saving in public/questions or returning a data URL.
 */
export async function uploadDiagramToStorage(
  imageBuffer: Buffer,
  targetFilename: string,
  supabaseClient?: any
): Promise<{ url: string; storagePath: string; isFallback: boolean }> {
  const cleanFilename = sanitizeDiagramFilename(targetFilename);
  const bucketName = 'question-diagrams';
  const storagePath = cleanFilename;

  // 1. Supabase Storage upload
  if (supabaseClient && supabaseClient.storage) {
    try {
      // Ensure bucket exists if service permissions allow
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
        // Ignore bucket listing/creation errors
      }

      const { error: uploadError } = await supabaseClient.storage
        .from(bucketName)
        .upload(storagePath, imageBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (!uploadError) {
        const { data: urlData } = supabaseClient.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        if (urlData && urlData.publicUrl) {
          return {
            url: urlData.publicUrl,
            storagePath,
            isFallback: false,
          };
        }
      } else {
        console.warn(`[diagramCropper] Supabase Storage upload failed: ${uploadError.message}`);
      }
    } catch (storageErr: any) {
      console.warn(`[diagramCropper] Supabase Storage exception: ${storageErr.message}`);
    }
  }

  // 2. Local filesystem fallback: write to public/questions/
  try {
    const localOutputDir = path.resolve(process.cwd(), 'public/questions');
    await fs.promises.mkdir(localOutputDir, { recursive: true });
    const localFilePath = path.join(localOutputDir, cleanFilename);
    await fs.promises.writeFile(localFilePath, imageBuffer);

    return {
      url: `/questions/${cleanFilename}`,
      storagePath,
      isFallback: true,
    };
  } catch (fsErr: any) {
    console.warn(`[diagramCropper] Local file fallback failed: ${fsErr.message}`);
    // 3. Ultimate Fallback: Data URL
    const base64 = imageBuffer.toString('base64');
    return {
      url: `data:image/png;base64,${base64}`,
      storagePath,
      isFallback: true,
    };
  }
}

/**
 * End-to-end crop and upload utility supporting imageBuffer, base64, or URL inputs.
 */
export async function cropAndUploadImage(options: {
  imageBuffer?: Buffer;
  imageBase64?: string;
  imageUrl?: string;
  bbox: DiagramBBox;
  targetFilename: string;
  supabaseClient?: any;
  padding?: number;
}): Promise<{
  success: boolean;
  url: string;
  storage_path?: string;
  bbox: DiagramBBox;
  width?: number;
  height?: number;
  error?: string;
}> {
  const { imageBuffer, imageBase64, imageUrl, bbox, targetFilename, supabaseClient, padding } =
    options;

  if (!isDiagramBBoxValid(bbox)) {
    return {
      success: false,
      url: '',
      bbox,
      error: 'Invalid, degenerate, or missing bounding box.',
    };
  }

  let bufferToCrop: Buffer | null = null;

  if (imageBuffer) {
    bufferToCrop = imageBuffer;
  } else if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    bufferToCrop = Buffer.from(cleanBase64, 'base64');
  } else if (imageUrl) {
    if (imageUrl.startsWith('data:image/')) {
      const cleanBase64 = imageUrl.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      bufferToCrop = Buffer.from(cleanBase64, 'base64');
    } else if (imageUrl.startsWith('/') || imageUrl.startsWith('public/')) {
      const relativePath = imageUrl.startsWith('public/')
        ? imageUrl
        : path.join('public', imageUrl.replace(/^\//, ''));
      const absPath = path.resolve(process.cwd(), relativePath);
      if (fs.existsSync(absPath)) {
        bufferToCrop = await fs.promises.readFile(absPath);
      }
    } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      const res = await fetch(imageUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        bufferToCrop = Buffer.from(arrayBuf);
      }
    }
  }

  if (!bufferToCrop || bufferToCrop.length === 0) {
    return {
      success: false,
      url: '',
      bbox,
      error: 'Could not obtain valid image buffer from provided source.',
    };
  }

  try {
    const cropped = await cropImageBuffer(bufferToCrop, bbox, { padding });
    const uploaded = await uploadDiagramToStorage(cropped.buffer, targetFilename, supabaseClient);

    return {
      success: true,
      url: uploaded.url,
      storage_path: uploaded.storagePath,
      bbox: normalizeBBox(bbox, 1000),
      width: cropped.width,
      height: cropped.height,
    };
  } catch (err: any) {
    console.error(`[diagramCropper] cropAndUploadImage failed: ${err.message}`);
    return {
      success: false,
      url: '',
      bbox,
      error: err.message || 'Image cropping failed.',
    };
  }
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
  bbox: DiagramBBox | null | undefined,
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
      } catch {
        console.warn(`[diagramCropper] Could not parse cropper output: ${trimmed}`);
      }
    }
  } catch (err: any) {
    console.error(`[diagramCropper] Cropping failed for ${cleanFilename}: ${err.message}`);
    if (!fs.existsSync(absoluteOutputPath)) {
      return { localPath: '', publicUrl: undefined, webPath: '' };
    }
  }

  if (!fs.existsSync(absoluteOutputPath)) {
    console.warn(`[diagramCropper] Expected output file not found at: ${absoluteOutputPath}`);
    return { localPath: '', publicUrl: undefined, webPath: '' };
  }

  let publicUrl: string | undefined = undefined;

  // 5. Supabase Storage upload
  if (supabaseClient && supabaseClient.storage) {
    try {
      const fileBuffer = await fs.promises.readFile(absoluteOutputPath);
      const uploadRes = await uploadDiagramToStorage(fileBuffer, cleanFilename, supabaseClient);
      if (!uploadRes.isFallback) {
        publicUrl = uploadRes.url;
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
