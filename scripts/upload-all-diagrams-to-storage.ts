import fs from 'fs';
import path from 'path';
import { supabase } from '../lib/supabaseClient';

const BUCKET_NAME = 'question-diagrams';
const QUESTIONS_DIR = path.resolve(process.cwd(), 'public/questions');
const CONCURRENCY = 10;

async function uploadFile(filename: string): Promise<{ filename: string; success: boolean; error?: string }> {
  try {
    const filePath = path.join(QUESTIONS_DIR, filename);
    const fileBuffer = await fs.promises.readFile(filePath);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, fileBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      return { filename, success: false, error: error.message };
    }

    return { filename, success: true };
  } catch (err: any) {
    return { filename, success: false, error: err.message };
  }
}

async function main() {
  console.log(`🔍 Scanning directory: ${QUESTIONS_DIR}`);

  if (!fs.existsSync(QUESTIONS_DIR)) {
    console.error(`❌ Directory not found: ${QUESTIONS_DIR}`);
    process.exit(1);
  }

  const files = (await fs.promises.readdir(QUESTIONS_DIR)).filter(
    (file) => file.toLowerCase().endsWith('.png') && !file.startsWith('.')
  );

  console.log(`📦 Found ${files.length} PNG diagram(s) to upload to Supabase Storage bucket "${BUCKET_NAME}".\n`);

  let successCount = 0;
  let failCount = 0;
  const errors: { filename: string; error?: string }[] = [];

  // Run in chunks
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const chunk = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map((f) => uploadFile(f)));

    for (const res of results) {
      if (res.success) {
        successCount++;
      } else {
        failCount++;
        errors.push({ filename: res.filename, error: res.error });
        console.error(`❌ Failed: ${res.filename} - ${res.error}`);
      }
    }

    const progress = Math.min(i + CONCURRENCY, files.length);
    process.stdout.write(`⏳ Uploaded ${progress}/${files.length} diagrams...\r`);
  }

  console.log(`\n\n══════════════════════════════════════════`);
  console.log(`✅ Upload Completed!`);
  console.log(`   Total files scanned: ${files.length}`);
  console.log(`   Successfully uploaded: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`══════════════════════════════════════════\n`);

  if (errors.length > 0) {
    console.error(`First 5 errors:`);
    console.error(JSON.stringify(errors.slice(0, 5), null, 2));
    process.exit(1);
  }

  // Verification step: verify a known diagram
  const testSample = '0455_2024_w_13_q18.png';
  if (files.includes(testSample)) {
    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(testSample);
    console.log(`🔗 Verifying sample URL for ${testSample}:`);
    console.log(`   ${urlData.publicUrl}`);

    try {
      const resp = await fetch(urlData.publicUrl);
      if (resp.ok && resp.status === 200) {
        const contentType = resp.headers.get('content-type');
        const contentLength = resp.headers.get('content-length');
        console.log(`✨ CDN Verification Succeeded: HTTP 200 (ContentType: ${contentType}, Size: ${contentLength} bytes)`);
      } else {
        console.warn(`⚠️ CDN Verification returned status HTTP ${resp.status}`);
      }
    } catch (fetchErr: any) {
      console.warn(`⚠️ CDN fetch test failed: ${fetchErr.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal error during upload:', err);
  process.exit(1);
});
