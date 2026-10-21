import assert from 'node:assert';
import {
  CAMBRIDGE_QUESTIONS,
  isDiagramQuestion,
  isGraphQuestion,
  filterQuestionsByDiagram,
  Question,
} from '../lib/questions';
import { hasDataTable } from '../lib/compilerFilters';

console.log('Testing diagram filter logic...');

// 1. filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'mixed').length === CAMBRIDGE_QUESTIONS.length (30)
const mixed = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'mixed');
assert.strictEqual(mixed.length, 30, 'Mixed filter should return all 30 questions');
assert.strictEqual(mixed.length, CAMBRIDGE_QUESTIONS.length, 'Mixed filter length should match CAMBRIDGE_QUESTIONS length');

// Undefined filter should also return all questions
const undefinedFilter = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, undefined);
assert.strictEqual(undefinedFilter.length, CAMBRIDGE_QUESTIONS.length, 'Undefined filter should return all questions');

// 2. filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'diagrams').length === 5 (all have isDiagramQuestion === true)
const diagramsOnly = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'diagrams');
assert.strictEqual(diagramsOnly.length, 5, 'Diagrams filter should return exactly 5 questions');
for (const q of diagramsOnly) {
  assert.strictEqual(isDiagramQuestion(q), true, `Question ${q.id} should be identified as a diagram question`);
}

// 3. filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'no-diagrams').length === 25 (all have isDiagramQuestion === false)
const noDiagramsOnly = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'no-diagrams');
assert.strictEqual(noDiagramsOnly.length, 25, 'No-diagrams filter should return exactly 25 questions');
for (const q of noDiagramsOnly) {
  assert.strictEqual(isDiagramQuestion(q), false, `Question ${q.id} should not be identified as a diagram question`);
}

// 4. Handles empty array [] cleanly without errors
const emptyMixed = filterQuestionsByDiagram([], 'mixed');
assert.deepStrictEqual(emptyMixed, [], 'Empty array with mixed filter should return empty array');

const emptyDiagrams = filterQuestionsByDiagram([], 'diagrams');
assert.deepStrictEqual(emptyDiagrams, [], 'Empty array with diagrams filter should return empty array');

const emptyNoDiagrams = filterQuestionsByDiagram([], 'no-diagrams');
assert.deepStrictEqual(emptyNoDiagrams, [], 'Empty array with no-diagrams filter should return empty array');

// 5. Preserves original array without in-place mutation
const originalClone = [...CAMBRIDGE_QUESTIONS];
filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'diagrams');
filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'no-diagrams');
filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'mixed');
assert.deepStrictEqual(CAMBRIDGE_QUESTIONS, originalClone, 'CAMBRIDGE_QUESTIONS should not be mutated in-place');

// 6. Test various diagram field patterns for isDiagramQuestion
const testQ1: Question = {
  id: 't1',
  stem_markdown: 'test',
  options: [],
  correct_option_id: 'a',
  has_diagram: true,
};
assert.strictEqual(isDiagramQuestion(testQ1), true, 'has_diagram: true should identify as diagram');

const testQ2: Question = {
  id: 't2',
  stem_markdown: 'test',
  options: [],
  correct_option_id: 'a',
  image_url: '/img/diagram.png',
};
assert.strictEqual(isDiagramQuestion(testQ2), true, 'image_url present should identify as diagram');

const testQ3: Question = {
  id: 't3',
  stem_markdown: 'test',
  options: [],
  correct_option_id: 'a',
  diagram: { has_diagram: true },
};
assert.strictEqual(isDiagramQuestion(testQ3), true, 'diagram.has_diagram: true should identify as diagram');

const testQ4: Question = {
  id: 't4',
  stem_markdown: 'test',
  options: [],
  correct_option_id: 'a',
  diagram: { image_url: '/img/diagram.png' },
};
assert.strictEqual(isDiagramQuestion(testQ4), true, 'diagram.image_url present should identify as diagram');

const testQ5: Question = {
  id: 't5',
  stem_markdown: 'test',
  options: [],
  correct_option_id: 'a',
};
// 7. Test 4-option question format filter (all, graph, diagram, text)
const allFilter = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'all');
assert.strictEqual(allFilter.length, 30, 'All filter should return all 30 questions');

const graphFilter = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'graph');
assert.strictEqual(graphFilter.length, 5, 'Graph filter should return exactly 5 questions');
for (const q of graphFilter) {
  assert.strictEqual(isGraphQuestion(q), true, `Question ${q.id} should be identified as a graph question`);
}

const diagramFilter = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'diagram');
assert.strictEqual(diagramFilter.length, 8, 'Diagram filter should return exactly 8 questions');
for (const q of diagramFilter) {
  assert.strictEqual(isGraphQuestion(q), false, `Question ${q.id} in diagram filter should not be a graph question`);
  assert.ok(
    isDiagramQuestion(q) || hasDataTable(q.stem_markdown, q),
    `Question ${q.id} should be a diagram or data table question`
  );
}

const textFilter = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, 'text');
assert.strictEqual(textFilter.length, 17, 'Text filter should return exactly 17 questions');
for (const q of textFilter) {
  assert.strictEqual(isGraphQuestion(q), false, `Question ${q.id} should not be a graph question`);
  assert.strictEqual(isDiagramQuestion(q), false, `Question ${q.id} should not be a diagram question`);
  assert.strictEqual(hasDataTable(q.stem_markdown, q), false, `Question ${q.id} should not have a data table`);
}

assert.strictEqual(
  graphFilter.length + diagramFilter.length + textFilter.length,
  allFilter.length,
  'Sum of graph, diagram, and text questions must equal total questions'
);

console.log('All diagram filter verification tests passed successfully! ✓');
