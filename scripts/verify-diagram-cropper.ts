import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { cropAndUploadDiagram, isDiagramBBoxValid, sanitizeDiagramFilename } from '../lib/ingestion/diagramCropper';

async function runTests() {
  console.log('=== Running Diagram Cropper Verification Tests ===\n');

  // Step 1: Create a synthetic test PDF using python/fitz
  const testPdfPath = path.resolve(process.cwd(), 'dist-test/test_diagram.pdf');
  fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });

  const pyCreatePdf = `
import fitz
doc = fitz.open()
page = doc.new_page(width=595, height=842) # A4
# Draw a simulated Cambridge circuit diagram
page.draw_rect(fitz.Rect(100, 150, 450, 400), color=(0, 0, 0), width=2)
page.draw_circle(fitz.Point(275, 275), 40, color=(0, 0, 1), width=2)
page.insert_text((260, 280), "12V", fontsize=16)
page.insert_text((120, 180), "Resistor R1 = 4.0 \u03a9", fontsize=14)
doc.save("${testPdfPath}")
doc.close()
`;
  execSync(`python3 -c '${pyCreatePdf}'`);
  console.log('✓ Created synthetic test PDF at:', testPdfPath);

  // Test 1: Filename Sanitizer
  console.log('\n--- Test 1: Filename Sanitization ---');
  const sanitized1 = sanitizeDiagramFilename('0455_s25_12_q01');
  const sanitized2 = sanitizeDiagramFilename('public/questions/physics_circuit.png');
  const sanitized3 = sanitizeDiagramFilename('/questions/diagram.jpeg');
  if (sanitized1 !== '0455_s25_12_q01.png') throw new Error(`Unexpected sanitize result: ${sanitized1}`);
  if (sanitized2 !== 'physics_circuit.png') throw new Error(`Unexpected sanitize result: ${sanitized2}`);
  if (sanitized3 !== 'diagram.jpeg.png') throw new Error(`Unexpected sanitize result: ${sanitized3}`);
  console.log('✓ sanitizeDiagramFilename handles various input formats properly');

  // Test 2: Bounding Box Validation & Fallback detection
  console.log('\n--- Test 2: BBox Validation ---');
  if (isDiagramBBoxValid(null)) throw new Error('null bbox should be invalid');
  if (isDiagramBBoxValid({ ymin: 0, xmin: 0, ymax: 0, xmax: 0, page_number: 1 })) throw new Error('zero bbox should be invalid');
  if (isDiagramBBoxValid({ ymin: 500, xmin: 100, ymax: 200, xmax: 400, page_number: 1 })) throw new Error('inverted bbox should be invalid');
  if (!isDiagramBBoxValid({ ymin: 150, xmin: 100, ymax: 500, xmax: 600, page_number: 1 })) throw new Error('valid 1000-scale bbox should be valid');
  if (!isDiagramBBoxValid({ ymin: 0.15, xmin: 0.1, ymax: 0.5, xmax: 0.6, page_number: 1 })) throw new Error('valid 1.0-scale bbox should be valid');
  console.log('✓ isDiagramBBoxValid accurately detects valid vs degenerate coordinates');

  // Test 3: Graceful fallback on missing/text-table bbox
  console.log('\n--- Test 3: Graceful Fallbacks ---');
  const fallbackRes1 = await cropAndUploadDiagram(testPdfPath, null, 'text_table_q1.png');
  if (fallbackRes1.localPath !== '' || fallbackRes1.publicUrl !== undefined) {
    throw new Error('Missing bbox should return empty localPath and undefined publicUrl');
  }

  const fallbackRes2 = await cropAndUploadDiagram('non_existent.pdf', { ymin: 100, xmin: 100, ymax: 500, xmax: 500, page_number: 1 }, 'test.png');
  if (fallbackRes2.localPath !== '' || fallbackRes2.publicUrl !== undefined) {
    throw new Error('Non-existent PDF should return graceful fallback');
  }
  console.log('✓ Graceful fallbacks correctly avoid errors and return empty paths');

  // Test 4: High-resolution (300 DPI) diagram cropping
  console.log('\n--- Test 4: High-Res Diagram Cropping ---');
  const targetFilename = 'test_verified_circuit_q14.png';
  const cropResult = await cropAndUploadDiagram(
    testPdfPath,
    { ymin: 150, xmin: 100, ymax: 500, xmax: 800, page_number: 1 },
    targetFilename
  );

  console.log('Crop result:', cropResult);
  if (cropResult.localPath !== `public/questions/${targetFilename}`) {
    throw new Error(`localPath mismatch: expected public/questions/${targetFilename}, got ${cropResult.localPath}`);
  }

  const writtenFile = path.resolve(process.cwd(), cropResult.localPath);
  if (!fs.existsSync(writtenFile)) {
    throw new Error(`Cropped file does not exist on disk at: ${writtenFile}`);
  }

  const fileStat = fs.statSync(writtenFile);
  if (fileStat.size < 1000) {
    throw new Error(`Cropped file is suspiciously small (${fileStat.size} bytes)`);
  }
  console.log(`✓ High-resolution PNG generated at ${cropResult.localPath} (${fileStat.size} bytes)`);

  // Test 5: Mock Supabase Storage Upload
  console.log('\n--- Test 5: Supabase Storage Integration ---');
  let uploadCalledWith = null;
  const mockSupabase = {
    storage: {
      listBuckets: async () => ({ data: [{ name: 'question-diagrams' }], error: null }),
      createBucket: async () => ({ data: null, error: null }),
      from: (bucket: string) => ({
        upload: async (path: string, body: Buffer, options: any) => {
          uploadCalledWith = { bucket, path, size: body.length, options };
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://mock-project.supabase.co/storage/v1/object/public/${bucket}/${path}` }
        })
      })
    }
  };

  const uploadResult = await cropAndUploadDiagram(
    testPdfPath,
    { ymin: 150, xmin: 100, ymax: 500, xmax: 800, page_number: 1 },
    'uploaded_diagram_q15.png',
    mockSupabase
  );

  if (!uploadCalledWith || (uploadCalledWith as any).bucket !== 'question-diagrams') {
    throw new Error('Supabase storage upload was not called with bucket "question-diagrams"');
  }
  if (!uploadResult.publicUrl || !uploadResult.publicUrl.includes('question-diagrams/uploaded_diagram_q15.png')) {
    throw new Error(`publicUrl was not generated properly: ${uploadResult.publicUrl}`);
  }
  console.log('✓ Successfully uploaded to Supabase Storage bucket and returned public URL:', uploadResult.publicUrl);

  console.log('\n======================================================');
  console.log('✅ ALL DIAGRAM CROPPER VERIFICATION TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
