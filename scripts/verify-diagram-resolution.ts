/**
 * Standalone Verification Test Script: verify-diagram-resolution.ts
 *
 * Validates:
 * 1. resolveDiagramUrl utility against edge cases (null, undefined, absolute, relative, dirty, non-existent)
 * 2. Live Supabase Storage public access for Cambridge 0455/13 Oct/Nov 2024 Q18 (0455_2024_w_13_q18.png)
 * 3. Supabase DB questions with image_url IS NOT NULL: resolution & HTTP probes across 2022, 2023, 2024 series
 */

import { supabase } from '../lib/supabaseClient';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details: string;
  durationMs?: number;
}

const results: TestResult[] = [];

function recordResult(name: string, category: string, passed: boolean, details: string, durationMs?: number) {
  results.push({ name, category, passed, details, durationMs });
  const icon = passed ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${icon} [${category}] ${name}: ${details}${durationMs !== undefined ? ` (${durationMs}ms)` : ''}`);
}

async function getResolveDiagramUrlFn(): Promise<(url?: string | null) => string | null | undefined> {
  // Dynamically locate resolveDiagramUrl from lib/questions, lib/diagrams, or lib/utils
  const candidateModules = [
    '../lib/questions',
    '../lib/diagrams',
    '../lib/utils',
    '../lib/testCompiler',
  ];

  for (const modPath of candidateModules) {
    try {
      const mod = await import(modPath) as Record<string, any>;
      if (typeof mod.resolveDiagramUrl === 'function') {
        console.log(`ℹ️ Located resolveDiagramUrl in "${modPath}"\n`);
        return mod.resolveDiagramUrl;
      }
    } catch {
      // Continue search
    }
  }

  // If not found in modules, check if fallback can be exported or notify failure
  throw new Error(
    'resolveDiagramUrl function not found in candidate modules (lib/questions, lib/diagrams, lib/utils, lib/testCompiler).'
  );
}

async function testResolutionFunction(resolveDiagramUrl: (url?: string | null) => string | null | undefined) {
  console.log('--- 1. Testing resolveDiagramUrl Logic ---');

  // Test 1: null input
  try {
    const res = resolveDiagramUrl(null);
    const pass = res === null || res === undefined;
    recordResult('null input handling', 'Unit: resolveDiagramUrl', pass, `Output: ${JSON.stringify(res)} (expected null/undefined)`);
  } catch (err: any) {
    recordResult('null input handling', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 2: undefined input
  try {
    const res = resolveDiagramUrl(undefined);
    const pass = res === null || res === undefined;
    recordResult('undefined input handling', 'Unit: resolveDiagramUrl', pass, `Output: ${JSON.stringify(res)} (expected null/undefined)`);
  } catch (err: any) {
    recordResult('undefined input handling', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 3: empty / whitespace string
  try {
    const res = resolveDiagramUrl('   ');
    const pass = !res || res.trim() === '';
    recordResult('whitespace input handling', 'Unit: resolveDiagramUrl', pass, `Output: ${JSON.stringify(res)} (expected falsy or empty)`);
  } catch (err: any) {
    recordResult('whitespace input handling', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 4: full external URL
  try {
    const input = 'https://example.com/external-diagram.png';
    const res = resolveDiagramUrl(input);
    const pass = res === input;
    recordResult('Full HTTPS URL', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Full HTTPS URL', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 5: full Supabase Storage URL
  try {
    const input = 'https://dmvahcaxixvhgxidmkqs.supabase.co/storage/v1/object/public/question-diagrams/0455_2024_w_13_q18.png';
    const res = resolveDiagramUrl(input);
    const pass = res === input;
    recordResult('Existing full Supabase URL', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Existing full Supabase URL', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 6: standard relative path (/questions/...)
  try {
    const input = '/questions/0455_2024_w_13_q18.png';
    const res = resolveDiagramUrl(input);
    const pass = typeof res === 'string' &&
      res.includes('question-diagrams') &&
      res.includes('0455_2024_w_13_q18.png') &&
      res.startsWith('http');
    recordResult('Standard relative path (/questions/0455_2024_w_13_q18.png)', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Standard relative path', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 7: relative path without leading slash
  try {
    const input = 'questions/0455_2024_w_13_q18.png';
    const res = resolveDiagramUrl(input);
    const pass = typeof res === 'string' &&
      res.includes('question-diagrams') &&
      res.includes('0455_2024_w_13_q18.png') &&
      res.startsWith('http');
    recordResult('Relative path without leading slash', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Relative path without leading slash', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 8: bare filename (0455_2024_w_13_q18.png)
  try {
    const input = '0455_2024_w_13_q18.png';
    const res = resolveDiagramUrl(input);
    const pass = typeof res === 'string' &&
      res.includes('question-diagrams') &&
      res.includes('0455_2024_w_13_q18.png') &&
      res.startsWith('http');
    recordResult('Bare filename input', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Bare filename input', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 9: dirty filename with whitespace
  try {
    const input = '   /questions/0455_2024_w_13_q18.png   ';
    const res = resolveDiagramUrl(input);
    const pass = typeof res === 'string' &&
      !res.includes(' ') &&
      res.includes('0455_2024_w_13_q18.png') &&
      res.startsWith('http');
    recordResult('Dirty filename with whitespace', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Dirty filename with whitespace', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }

  // Test 10: non-existent / arbitrary filename
  try {
    const input = '/questions/non_existent_test_diagram_99999.png';
    const res = resolveDiagramUrl(input);
    const pass = typeof res === 'string' && res.startsWith('http') && res.includes('non_existent_test_diagram_99999.png');
    recordResult('Non-existent path graceful resolution', 'Unit: resolveDiagramUrl', pass, `Output: ${res}`);
  } catch (err: any) {
    recordResult('Non-existent path graceful resolution', 'Unit: resolveDiagramUrl', false, `Threw exception: ${err?.message}`);
  }
}

async function probeHttpUrl(url: string, description: string): Promise<{ status: number; contentType: string; contentLength: number }> {
  const start = Date.now();
  try {
    // Try GET with streaming or abort after header to probe actual headers
    const res = await fetch(url, { method: 'GET' });
    const durationMs = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    const bodyBuf = await res.arrayBuffer();
    const actualBytes = bodyBuf.byteLength;

    const effectiveLength = contentLength > 0 ? contentLength : actualBytes;
    const isSuccess = res.status === 200 && effectiveLength > 0 && contentType.toLowerCase().includes('image');

    recordResult(
      description,
      'HTTP Probe',
      isSuccess,
      `Status: ${res.status}, Type: ${contentType}, Length: ${effectiveLength} bytes`,
      durationMs
    );

    return { status: res.status, contentType, contentLength: effectiveLength };
  } catch (err: any) {
    const durationMs = Date.now() - start;
    recordResult(description, 'HTTP Probe', false, `Network error: ${err?.message}`, durationMs);
    return { status: 0, contentType: '', contentLength: 0 };
  }
}

async function testTargetOctNov2024Q18(resolveDiagramUrl: (url?: string | null) => string | null | undefined) {
  console.log('\n--- 2. Live Supabase Storage Probe: Cambridge 0455/13 Oct/Nov 2024 Q18 ---');

  const resolvedUrl = resolveDiagramUrl('/questions/0455_2024_w_13_q18.png');
  if (!resolvedUrl) {
    recordResult(
      'Target Q18 URL Resolution',
      'Target: 0455/13 w24 Q18',
      false,
      'resolveDiagramUrl returned empty for /questions/0455_2024_w_13_q18.png'
    );
    return;
  }

  recordResult(
    'Target Q18 URL Resolution',
    'Target: 0455/13 w24 Q18',
    true,
    `Resolved URL: ${resolvedUrl}`
  );

  await probeHttpUrl(resolvedUrl, 'Live Supabase Storage fetch (0455_2024_w_13_q18.png)');
}

async function testDatabaseQuestions(resolveDiagramUrl: (url?: string | null) => string | null | undefined) {
  console.log('\n--- 3. Testing Supabase DB Questions with image_url ---');

  const { data, error } = await supabase
    .from('questions')
    .select('id, question_number, cambridge_source_ref, image_url, diagram_metadata')
    .not('image_url', 'is', null);

  if (error) {
    recordResult('Supabase Questions Query', 'Database Probe', false, `Query error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    recordResult('Supabase Questions Query', 'Database Probe', false, '0 questions returned with image_url');
    return;
  }

  recordResult(
    'Supabase Questions Query',
    'Database Probe',
    true,
    `Found ${data.length} questions in Supabase with image_url`
  );

  // Group by series (2022, 2023, 2024)
  const series2024 = data.filter((q) => q.cambridge_source_ref?.includes('2024') || q.image_url?.includes('2024') || q.image_url?.includes('24'));
  const series2023 = data.filter((q) => q.cambridge_source_ref?.includes('2023') || q.image_url?.includes('2023') || q.image_url?.includes('23'));
  const series2022 = data.filter((q) => q.cambridge_source_ref?.includes('2022') || q.image_url?.includes('2022') || q.image_url?.includes('22'));

  console.log(`\n  Distribution: 2024=${series2024.length}, 2023=${series2023.length}, 2022=${series2022.length}`);

  // Test resolution for all DB records
  let allResolved = true;
  for (const q of data) {
    const resolved = resolveDiagramUrl(q.image_url);
    if (!resolved || !resolved.startsWith('http')) {
      allResolved = false;
      recordResult(
        `Resolve DB question ${q.id} (Q${q.question_number})`,
        'Database Resolution',
        false,
        `image_url "${q.image_url}" resolved to "${resolved}"`
      );
    }
  }

  if (allResolved) {
    recordResult(
      'Resolve all DB question diagram URLs',
      'Database Resolution',
      true,
      `All ${data.length} question image_urls successfully resolved to valid HTTP(S) endpoints.`
    );
  }

  // Probe samples across series
  const samplesToProbe: { label: string; url: string }[] = [];

  if (series2024.length > 0) {
    // Pick first and target if present
    const q18 = series2024.find((q) => q.question_number === 18 && q.cambridge_source_ref?.includes('13'));
    if (q18) {
      samplesToProbe.push({
        label: `Sample 2024 (Q18 13 w24): ${q18.cambridge_source_ref}`,
        url: resolveDiagramUrl(q18.image_url)!,
      });
    }
    const sample2024 = series2024[0];
    if (sample2024 && sample2024 !== q18) {
      samplesToProbe.push({
        label: `Sample 2024 (Q${sample2024.question_number}): ${sample2024.cambridge_source_ref}`,
        url: resolveDiagramUrl(sample2024.image_url)!,
      });
    }
  }

  if (series2023.length > 0) {
    const sample2023 = series2023[0];
    samplesToProbe.push({
      label: `Sample 2023 (Q${sample2023.question_number}): ${sample2023.cambridge_source_ref}`,
      url: resolveDiagramUrl(sample2023.image_url)!,
    });
  }

  if (series2022.length > 0) {
    const sample2022 = series2022[0];
    samplesToProbe.push({
      label: `Sample 2022 (Q${sample2022.question_number}): ${sample2022.cambridge_source_ref}`,
      url: resolveDiagramUrl(sample2022.image_url)!,
    });
  } else {
    // If no 2022 questions exist in DB yet, probe a synthetic 2022 resolved path from known public file
    const synthetic2022Url = resolveDiagramUrl('/questions/0455_2022_s_11_q21.png');
    if (synthetic2022Url) {
      samplesToProbe.push({
        label: 'Sample 2022 (Synthetic public path 0455_2022_s_11_q21.png)',
        url: synthetic2022Url,
      });
    }
  }

  console.log('\n--- 4. HTTP Live Probing of Sample Diagrams ---');
  for (const sample of samplesToProbe) {
    await probeHttpUrl(sample.url, sample.label);
  }
}

async function main() {
  console.log('================================================================');
  console.log('       REVIZZ DIAGRAM RESOLUTION & STORAGE VERIFICATION         ');
  console.log('================================================================\n');

  let resolveDiagramUrlFn: ((url?: string | null) => string | null | undefined) | null = null;

  try {
    resolveDiagramUrlFn = await getResolveDiagramUrlFn();
  } catch (err: any) {
    recordResult(
      'Locate resolveDiagramUrl utility',
      'Initialization',
      false,
      err?.message || 'Failed to locate resolveDiagramUrl'
    );
  }

  if (resolveDiagramUrlFn) {
    recordResult(
      'Locate resolveDiagramUrl utility',
      'Initialization',
      true,
      'resolveDiagramUrl successfully located and imported.'
    );

    await testResolutionFunction(resolveDiagramUrlFn);
    await testTargetOctNov2024Q18(resolveDiagramUrlFn);
    await testDatabaseQuestions(resolveDiagramUrlFn);
  }

  console.log('\n================================================================');
  console.log('                       AUDIT SUMMARY REPORT                     ');
  console.log('================================================================\n');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Checks Executed : ${total}`);
  console.log(`Passed Checks         : ${passed}`);
  console.log(`Failed Checks         : ${failed}`);
  console.log(`Success Rate          : ${((passed / total) * 100).toFixed(1)}%\n`);

  if (failed > 0) {
    console.log('❌ FAILURES ENCOUNTERED:');
    results
      .filter((r) => !r.passed)
      .forEach((r, idx) => {
        console.log(`  ${idx + 1}. [${r.category}] ${r.name}: ${r.details}`);
      });
    console.log('\nVerification FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL CHECKS PASSED PERFECTLY!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in verification script:', err);
  process.exit(1);
});
