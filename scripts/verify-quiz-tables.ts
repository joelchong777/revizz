/**
 * Standalone Verification Script for Quiz Table Rendering.
 *
 * Verifies that QuestionCard properly parses and renders:
 * 1. Markdown tables via remark-gfm (table, thead, tbody, tr, th, td elements with neobrutalist styling).
 * 2. Raw HTML tags within table headers (e.g. <br>) via rehype-raw without escaping them as &lt;br&gt;.
 * 3. Inline KaTeX math equations within stems and tables without syntax errors.
 * 4. Option markdown text formatting.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CAMBRIDGE_QUESTIONS, Question } from '../lib/questions';

// Ignore CSS imports in Node environment
require.extensions['.css'] = () => {};

let QuestionCard: any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

async function verifyQuizTables() {
  console.log('================================================================');
  console.log('           QUIZ TABLE RENDERING VERIFICATION SUITE              ');
  console.log('================================================================\n');

  const questionCardModule = await import('../components/QuestionCard');
  QuestionCard = questionCardModule.QuestionCard;

  const targetQuestionIds = [
    '0455-s24-12-q06',
    '0455-s24-12-q10',
    '0455-s24-12-q12',
    '0455-s24-12-q14',
    '0455-s24-12-q24',
    '0455-s24-12-q29',
    '0455-s24-12-q30',
  ];

  const questionsMap = new Map<string, Question>();
  for (const q of CAMBRIDGE_QUESTIONS) {
    questionsMap.set(q.id, q);
  }

  for (const qId of targetQuestionIds) {
    const q = questionsMap.get(qId);
    if (!q) {
      assert(false, `Question ${qId} found in CAMBRIDGE_QUESTIONS`);
      continue;
    }

    console.log(`\nTesting question: ${qId} ("${q.citation || q.id}")`);

    // Render QuestionCard using renderToStaticMarkup
    let html = '';
    try {
      html = renderToStaticMarkup(
        React.createElement(QuestionCard, {
          question: q,
          questionNumber: 1,
          totalQuestions: 30,
          status: 'unanswered',
          timeLeft: 60,
          isTimed: false,
          onAnswer: () => {},
          onNext: () => {},
          selectedOptionId: null,
          firstWrongOptionId: null,
          currentStreak: 0,
          isEndless: false,
          onFinish: () => {},
          totalXP: 0,
          subject: 'Economics',
        })
      );
      assert(true, `Successfully rendered QuestionCard for ${qId}`);
    } catch (err) {
      assert(false, `Failed to render QuestionCard for ${qId}: ${err}`);
      continue;
    }

    // 1. Table structure elements
    assert(html.includes('<table') && html.includes('</table>'), `${qId}: contains <table> element`);
    assert(html.includes('<thead') && html.includes('</thead>'), `${qId}: contains <thead> element`);
    assert(html.includes('<tbody') && html.includes('</tbody>'), `${qId}: contains <tbody> element`);
    assert(html.includes('<tr') && html.includes('</tr>'), `${qId}: contains <tr> element`);
    assert(html.includes('<th') && html.includes('</th>'), `${qId}: contains <th> element`);
    assert(html.includes('<td') && html.includes('</td>'), `${qId}: contains <td> element`);

    // 2. Custom Cambridge Exam Table Classes
    assert(
      (html.includes('border-neutral-900') || html.includes('border-black')) && html.includes('w-fit'),
      `${qId}: table container has authentic Cambridge exam styling (border-neutral-900/border-black, w-fit)`
    );
    assert(
      html.includes('overflow-hidden') && html.includes('w-fit'),
      `${qId}: tables in QuestionCard contain overflow-hidden and w-fit`
    );
    assert(
      html.includes('overflow-hidden') && html.includes('max-w-full'),
      `${qId}: AutoFitTable renders overflow-hidden and max-w-full`
    );
    assert(
      !html.includes('overflow-x-auto'),
      `${qId}: question card stem container does NOT have overflow-x-auto`
    );
    assert(
      html.includes('divide-neutral-900'),
      `${qId}: tbody has divide-neutral-900 class`
    );

    // 3. Raw HTML in table headers (Q29, Q30 contain <br>)
    if (qId === '0455-s24-12-q29' || qId === '0455-s24-12-q30') {
      assert(
        !html.includes('&lt;br&gt;') && !html.includes('&lt;br/&gt;'),
        `${qId}: raw HTML <br> tags are NOT escaped as &lt;br&gt;`
      );
      assert(
        html.includes('<br/>') || html.includes('<br>'),
        `${qId}: raw HTML <br> is rendered as an HTML element`
      );
    }

    // 4. KaTeX Math rendering
    if (qId === '0455-s24-12-q10') {
      // Q10 has $OW_c$ and $OW_n$
      assert(
        html.includes('katex') && html.includes('katex-html'),
        `${qId}: math formulas ($OW_c$, $OW_n$) rendered through KaTeX`
      );
    }
  }

  // Option markdown verification
  console.log('\nTesting option markdown rendering with table/formatting');
  const customQuestion: Question = {
    id: 'test-custom-table-q',
    stem_markdown: 'Look at the table below:\n\n| Feature | Status |\n| :--- | :--- |\n| Speed | Fast |\n\nChoose the best answer:',
    options: [
      { id: 'opt-a', text_markdown: 'Standard option with **bold** text' },
      { id: 'opt-b', text_markdown: 'Option with math: $\\alpha + \\beta = 1$' },
      { id: 'opt-c', text_markdown: 'Option with line break<br>second line' },
      { id: 'opt-d', text_markdown: 'Option with table:\n| A | B |\n|---|---|\n| 1 | 2 |' },
    ],
    correct_option_id: 'opt-a',
    topic: 'Testing',
  };

  const customHtml = renderToStaticMarkup(
    React.createElement(QuestionCard, {
      question: customQuestion,
      questionNumber: 2,
      totalQuestions: 10,
      status: 'unanswered',
      timeLeft: 30,
      isTimed: true,
      onAnswer: () => {},
      onNext: () => {},
      selectedOptionId: null,
      firstWrongOptionId: null,
      currentStreak: 2,
      isEndless: false,
      onFinish: () => {},
      totalXP: 50,
      subject: 'Economics',
    })
  );

  assert(customHtml.includes('<strong>bold</strong>'), 'Option A renders bold markdown');
  assert(customHtml.includes('katex'), 'Option B renders KaTeX math');
  assert(customHtml.includes('<br/>') || customHtml.includes('<br>'), 'Option C renders raw HTML break');
  assert(!customHtml.includes('&lt;br&gt;'), 'Option C does not escape <br>');

  // RoundSummary missed question accordion table rendering verification
  console.log('\nTesting RoundSummary missed question accordion table rendering');
  const roundSummaryModule = await import('../components/RoundSummary');
  const RoundSummary = roundSummaryModule.RoundSummary;

  const missedQ14 = questionsMap.get('0455-s24-12-q14')!;
  const missedQ29 = questionsMap.get('0455-s24-12-q29')!;

  const missedItems = [
    { question: missedQ14, questionNumber: 14, userSelectedOptionId: missedQ14.options[0].id, outcome: 'wrong' as const },
    { question: missedQ29, questionNumber: 29, userSelectedOptionId: missedQ29.options[0].id, outcome: 'wrong' as const },
  ];

  // Test Q14 expanded (index 0)
  const roundSummaryHtmlQ14 = renderToStaticMarkup(
    React.createElement(RoundSummary, {
      totalXP: 100,
      peakStreak: 4,
      correctFirstTryCount: 5,
      correctRetryCount: 1,
      wrongCount: 2,
      missedQuestions: missedItems,
      onReviewMissed: () => {},
      onPlayAgain: () => {},
      onHome: () => {},
      initialOpenMissedIndex: 0,
    })
  );

  assert(roundSummaryHtmlQ14.includes('<table') && roundSummaryHtmlQ14.includes('</table>'), 'RoundSummary Q14: expanded accordion contains <table>');
  assert(roundSummaryHtmlQ14.includes('<thead') && roundSummaryHtmlQ14.includes('</thead>'), 'RoundSummary Q14: expanded accordion contains <thead>');
  assert(roundSummaryHtmlQ14.includes('<th') && roundSummaryHtmlQ14.includes('</th>'), 'RoundSummary Q14: expanded accordion contains <th>');
  assert(roundSummaryHtmlQ14.includes('<td') && roundSummaryHtmlQ14.includes('</td>'), 'RoundSummary Q14: expanded accordion contains <td>');
  assert(
    (roundSummaryHtmlQ14.includes('border-neutral-900') || roundSummaryHtmlQ14.includes('border-black')) && roundSummaryHtmlQ14.includes('w-fit'),
    'RoundSummary Q14: expanded accordion table has authentic Cambridge exam styling'
  );

  // Verify collapsed trigger preview does NOT leak markdown table pipes
  const q14TriggerText = missedQ14.stem_markdown.split(/\n\s*\|/)[0].trim().replace(/[*#$]/g, '');
  assert(roundSummaryHtmlQ14.includes(q14TriggerText), 'RoundSummary: trigger preview contains clean pre-table stem text');

  // Test Q29 expanded (index 1) with <br> in header
  const roundSummaryHtmlQ29 = renderToStaticMarkup(
    React.createElement(RoundSummary, {
      totalXP: 100,
      peakStreak: 4,
      correctFirstTryCount: 5,
      correctRetryCount: 1,
      wrongCount: 2,
      missedQuestions: missedItems,
      onReviewMissed: () => {},
      onPlayAgain: () => {},
      onHome: () => {},
      initialOpenMissedIndex: 1,
    })
  );

  assert(roundSummaryHtmlQ29.includes('<table') && roundSummaryHtmlQ29.includes('</table>'), 'RoundSummary Q29: expanded accordion contains <table>');
  assert(roundSummaryHtmlQ29.includes('<thead') && roundSummaryHtmlQ29.includes('</thead>'), 'RoundSummary Q29: expanded accordion contains <thead>');
  assert(roundSummaryHtmlQ29.includes('<th') && roundSummaryHtmlQ29.includes('</th>'), 'RoundSummary Q29: expanded accordion contains <th>');
  assert(roundSummaryHtmlQ29.includes('<td') && roundSummaryHtmlQ29.includes('</td>'), 'RoundSummary Q29: expanded accordion contains <td>');
  assert(
    !roundSummaryHtmlQ29.includes('&lt;br&gt;') && !roundSummaryHtmlQ29.includes('&lt;br/&gt;'),
    'RoundSummary Q29: table header <br> is NOT escaped as &lt;br&gt;'
  );
  assert(
    roundSummaryHtmlQ29.includes('<br/>') || roundSummaryHtmlQ29.includes('<br>'),
    'RoundSummary Q29: table header renders unescaped <br/> tag'
  );

  // ── RichMarkdown Component Verification ──
  console.log('\nTesting RichMarkdown component variants');
  const richMarkdownModule = await import('../components/ui/RichMarkdown');
  const RichMarkdown = richMarkdownModule.RichMarkdown;

  const testTableContent = `
### Summary Table
| Metric | Value | Status |
| :--- | :---: | ---: |
| Accuracy | 98% | **Pass** |
| Latency | 45ms | _Optimal_ |
`;

  // 1. RichMarkdown - cambridge variant (default)
  const cambridgeHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: testTableContent,
      variant: 'cambridge',
    })
  );
  assert(cambridgeHtml.includes('<table') && cambridgeHtml.includes('</table>'), 'RichMarkdown (cambridge): contains <table>');
  assert(cambridgeHtml.includes('<thead') && cambridgeHtml.includes('</thead>'), 'RichMarkdown (cambridge): contains <thead>');
  assert(cambridgeHtml.includes('<tbody') && cambridgeHtml.includes('</tbody>'), 'RichMarkdown (cambridge): contains <tbody>');
  assert(cambridgeHtml.includes('<tr') && cambridgeHtml.includes('</tr>'), 'RichMarkdown (cambridge): contains <tr>');
  assert(cambridgeHtml.includes('<th') && cambridgeHtml.includes('</th>'), 'RichMarkdown (cambridge): contains <th>');
  assert(cambridgeHtml.includes('<td') && cambridgeHtml.includes('</td>'), 'RichMarkdown (cambridge): contains <td>');
  assert(
    (cambridgeHtml.includes('border-neutral-900') || cambridgeHtml.includes('border-black')) && cambridgeHtml.includes('w-fit'),
    'RichMarkdown (cambridge): table has authentic Cambridge exam styling (border-neutral-900, w-fit)'
  );
  assert(
    cambridgeHtml.includes('divide-neutral-900'),
    'RichMarkdown (cambridge): tbody has divide-neutral-900 class'
  );

  // Default variant (no variant prop -> defaults to cambridge)
  const defaultHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: testTableContent,
    })
  );
  assert(
    (defaultHtml.includes('border-neutral-900') || defaultHtml.includes('border-black')) && defaultHtml.includes('w-fit'),
    'RichMarkdown (default): defaults to authentic Cambridge exam styling'
  );

  // 2. RichMarkdown - neobrutalist variant
  const neobrutalistHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: testTableContent,
      variant: 'neobrutalist',
    })
  );
  assert(neobrutalistHtml.includes('<table') && neobrutalistHtml.includes('</table>'), 'RichMarkdown (neobrutalist): contains <table>');
  assert(neobrutalistHtml.includes('<thead') && neobrutalistHtml.includes('</thead>'), 'RichMarkdown (neobrutalist): contains <thead>');
  assert(neobrutalistHtml.includes('<tbody') && neobrutalistHtml.includes('</tbody>'), 'RichMarkdown (neobrutalist): contains <tbody>');
  assert(neobrutalistHtml.includes('<tr') && neobrutalistHtml.includes('</tr>'), 'RichMarkdown (neobrutalist): contains <tr>');
  assert(neobrutalistHtml.includes('<th') && neobrutalistHtml.includes('</th>'), 'RichMarkdown (neobrutalist): contains <th>');
  assert(neobrutalistHtml.includes('<td') && neobrutalistHtml.includes('</td>'), 'RichMarkdown (neobrutalist): contains <td>');
  assert(
    neobrutalistHtml.includes('shadow-offset-2') && neobrutalistHtml.includes('border-text'),
    'RichMarkdown (neobrutalist): table has neobrutalist shadow and border'
  );
  assert(
    neobrutalistHtml.includes('bg-accent-2-100') && neobrutalistHtml.includes('font-heading'),
    'RichMarkdown (neobrutalist): thead has neobrutalist styling'
  );

  // 2. RichMarkdown - printable variant
  const printableHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: testTableContent,
      variant: 'printable',
    })
  );
  assert(printableHtml.includes('<table') && printableHtml.includes('</table>'), 'RichMarkdown (printable): contains <table>');
  assert(printableHtml.includes('<thead') && printableHtml.includes('</thead>'), 'RichMarkdown (printable): contains <thead>');
  assert(printableHtml.includes('<tbody') && printableHtml.includes('</tbody>'), 'RichMarkdown (printable): contains <tbody>');
  assert(printableHtml.includes('<tr') && printableHtml.includes('</tr>'), 'RichMarkdown (printable): contains <tr>');
  assert(printableHtml.includes('<th') && printableHtml.includes('</th>'), 'RichMarkdown (printable): contains <th>');
  assert(printableHtml.includes('<td') && printableHtml.includes('</td>'), 'RichMarkdown (printable): contains <td>');
  assert(
    printableHtml.includes('border-black') && printableHtml.includes('divide-black'),
    'RichMarkdown (printable): table has clean print border styling'
  );

  // 3. Question 0455/11 w24 Q2 table stem verification
  console.log('\nTesting Question 0455/11 w24 Q2 table stem markdown rendering');
  const q0455W24Q2Stem =
    'In which case is it possible to set the level of reward before production takes place for the first factor of production but not for the second factor? \n\n| | first factor | second factor |\n| :---: | :---: | :---: |\n| **A** | capital | land |\n| **B** | enterprise | labour |\n| **C** | labour | capital |\n| **D** | land | enterprise |\n';

  const q2CambridgeHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: q0455W24Q2Stem,
      variant: 'cambridge',
    })
  );

  assert(q2CambridgeHtml.includes('<table') && q2CambridgeHtml.includes('</table>'), '0455/11 w24 Q2 (cambridge): contains <table>');
  assert(q2CambridgeHtml.includes('<thead') && q2CambridgeHtml.includes('</thead>'), '0455/11 w24 Q2 (cambridge): contains <thead>');
  assert(q2CambridgeHtml.includes('<tbody') && q2CambridgeHtml.includes('</tbody>'), '0455/11 w24 Q2 (cambridge): contains <tbody>');
  assert(q2CambridgeHtml.includes('<tr') && q2CambridgeHtml.includes('</tr>'), '0455/11 w24 Q2 (cambridge): contains <tr>');
  assert(q2CambridgeHtml.includes('<th') && q2CambridgeHtml.includes('</th>'), '0455/11 w24 Q2 (cambridge): contains <th>');
  assert(q2CambridgeHtml.includes('<td') && q2CambridgeHtml.includes('</td>'), '0455/11 w24 Q2 (cambridge): contains <td>');
  assert(!q2CambridgeHtml.includes('| :---: |'), '0455/11 w24 Q2 (cambridge): does not contain raw delimiter row "| :---: |"');
  assert(!q2CambridgeHtml.includes('| first factor |'), '0455/11 w24 Q2 (cambridge): does not contain unparsed header pipes');
  assert(!q2CambridgeHtml.includes('<p>|'), '0455/11 w24 Q2 (cambridge): does not contain raw pipe paragraph text');
  assert(q2CambridgeHtml.includes('<strong>A</strong>'), '0455/11 w24 Q2 (cambridge): renders bold row label <strong>A</strong> inside cell');
  assert(
    (q2CambridgeHtml.includes('border-neutral-900') || q2CambridgeHtml.includes('border-black')) && q2CambridgeHtml.includes('w-fit'),
    '0455/11 w24 Q2 (cambridge): table container has authentic Cambridge exam styling'
  );
  assert(
    q2CambridgeHtml.includes('divide-neutral-900'),
    '0455/11 w24 Q2 (cambridge): tbody has divide-neutral-900 class'
  );

  const q2NeoHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: q0455W24Q2Stem,
      variant: 'neobrutalist',
    })
  );

  assert(q2NeoHtml.includes('<table') && q2NeoHtml.includes('</table>'), '0455/11 w24 Q2 (neobrutalist): contains <table>');
  assert(q2NeoHtml.includes('<thead') && q2NeoHtml.includes('</thead>'), '0455/11 w24 Q2 (neobrutalist): contains <thead>');
  assert(q2NeoHtml.includes('<tbody') && q2NeoHtml.includes('</tbody>'), '0455/11 w24 Q2 (neobrutalist): contains <tbody>');
  assert(q2NeoHtml.includes('<tr') && q2NeoHtml.includes('</tr>'), '0455/11 w24 Q2 (neobrutalist): contains <tr>');
  assert(q2NeoHtml.includes('<th') && q2NeoHtml.includes('</th>'), '0455/11 w24 Q2 (neobrutalist): contains <th>');
  assert(q2NeoHtml.includes('<td') && q2NeoHtml.includes('</td>'), '0455/11 w24 Q2 (neobrutalist): contains <td>');
  assert(!q2NeoHtml.includes('| :---: |'), '0455/11 w24 Q2: does not contain raw delimiter row "| :---: |"');
  assert(!q2NeoHtml.includes('| first factor |'), '0455/11 w24 Q2: does not contain unparsed header pipes');
  assert(!q2NeoHtml.includes('<p>|'), '0455/11 w24 Q2: does not contain raw pipe paragraph text');
  assert(q2NeoHtml.includes('<strong>A</strong>'), '0455/11 w24 Q2: renders bold row label <strong>A</strong> inside cell');

  const q2PrintHtml = renderToStaticMarkup(
    React.createElement(RichMarkdown, {
      content: q0455W24Q2Stem,
      variant: 'printable',
    })
  );
  assert(q2PrintHtml.includes('<table') && q2PrintHtml.includes('</table>'), '0455/11 w24 Q2 (printable): contains <table>');
  assert(q2PrintHtml.includes('<thead') && q2PrintHtml.includes('</thead>'), '0455/11 w24 Q2 (printable): contains <thead>');
  assert(q2PrintHtml.includes('<tbody') && q2PrintHtml.includes('</tbody>'), '0455/11 w24 Q2 (printable): contains <tbody>');
  assert(q2PrintHtml.includes('<tr') && q2PrintHtml.includes('</tr>'), '0455/11 w24 Q2 (printable): contains <tr>');
  assert(q2PrintHtml.includes('<th') && q2PrintHtml.includes('</th>'), '0455/11 w24 Q2 (printable): contains <th>');
  assert(q2PrintHtml.includes('<td') && q2PrintHtml.includes('</td>'), '0455/11 w24 Q2 (printable): contains <td>');
  assert(!q2PrintHtml.includes('<p>|'), '0455/11 w24 Q2 (printable): does not contain raw pipe paragraph text');

  // 4. AutoFitTable component verification
  console.log('\nTesting AutoFitTable component rendering');
  const autoFitModule = await import('../components/ui/AutoFitTable');
  const AutoFitTable = autoFitModule.AutoFitTable;
  const autoFitHtml = renderToStaticMarkup(
    React.createElement(AutoFitTable, null, React.createElement('table', { className: 'w-fit' }, 'test'))
  );
  assert(autoFitHtml.includes('overflow-hidden'), 'AutoFitTable renders outer container with overflow-hidden');
  assert(autoFitHtml.includes('max-w-full'), 'AutoFitTable renders inner container with max-w-full');
  assert(autoFitHtml.includes('w-fit'), 'AutoFitTable renders children table with w-fit');
  assert(!autoFitHtml.includes('overflow-x-auto'), 'AutoFitTable does NOT render overflow-x-auto');

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL QUIZ TABLE RENDERING CHECKS PASSED!\n');
    process.exit(0);
  }
}

verifyQuizTables().catch((err) => {
  console.error('Unhandled error during verification:', err);
  process.exit(1);
});
