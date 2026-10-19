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

    // 2. Custom Neobrutalist Table Classes
    assert(
      html.includes('shadow-offset-2') && html.includes('border-text'),
      `${qId}: table container has neobrutalist border and shadow classes`
    );
    assert(
      html.includes('bg-accent-2-100') && html.includes('font-heading'),
      `${qId}: thead has bg-accent-2-100 and font-heading classes`
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
