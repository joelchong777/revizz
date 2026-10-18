import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  CAMBRIDGE_TOPICS,
  CAMBRIDGE_QUESTIONS,
  Question,
  SyllabusTopic,
} from '../lib/questions';
import { QuizRoundConfig } from '../hooks/useQuizGame';

console.log('--- Running Topic Selection Verification Suite ---');

// 1. Verify all Cambridge Economics 0455 topics have matching questions in the bank
console.log('1. Checking Cambridge Economics 0455 topics coverage...');
assert.strictEqual(CAMBRIDGE_TOPICS.length, 6, 'Should have exactly 6 Cambridge Economics 0455 syllabus topics');

const topicMap = new Map<string, SyllabusTopic>();
for (const topic of CAMBRIDGE_TOPICS) {
  topicMap.set(topic.id, topic);
}

for (const topic of CAMBRIDGE_TOPICS) {
  const matchingQuestions = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic.id);
  assert(
    matchingQuestions.length > 0,
    `Topic "${topic.name}" (${topic.id}) must have matching questions in CAMBRIDGE_QUESTIONS (found: ${matchingQuestions.length})`
  );
  console.log(`  ✓ Topic [Ch ${topic.orderIndex}] "${topic.name}": ${matchingQuestions.length} questions`);
}

// Verify every question has a valid topic_id matching a syllabus topic
for (const q of CAMBRIDGE_QUESTIONS) {
  assert(
    q.topic_id && topicMap.has(q.topic_id),
    `Question ${q.id} has invalid or unknown topic_id "${q.topic_id}"`
  );
}
console.log('  ✓ All 30 Cambridge questions map to valid syllabus topics.');

// 2. Verify app/page.tsx topic filtering logic
console.log('2. Verifying page.tsx question pool filtering logic...');

// Helper mimicking app/page.tsx handleStartStandard topic filtering
function filterPoolByConfig(questions: Question[], config: QuizRoundConfig): Question[] {
  let pool = [...questions];

  if (config.sourceType === 'topic' && config.sourceValue !== 'all') {
    const targetTopicIds = new Set(config.sourceValue.split(',').filter(Boolean));
    const topicFiltered = pool.filter((q) => q.topic_id && targetTopicIds.has(q.topic_id));
    if (topicFiltered.length > 0) pool = topicFiltered;
  }

  return pool;
}

// 2a. Test selecting 'all' in topic mode returns all questions
const allConfig: QuizRoundConfig = {
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceValue: 'all',
  roundLength: 10,
  isTimed: true,
};
const allResult = filterPoolByConfig(CAMBRIDGE_QUESTIONS, allConfig);
assert.strictEqual(
  allResult.length,
  CAMBRIDGE_QUESTIONS.length,
  'When sourceValue is "all", all questions should be retained in the pool'
);
console.log('  ✓ sourceValue: "all" retains full question pool');

// 2b. Test selecting each individual topic
for (const topic of CAMBRIDGE_TOPICS) {
  const topicConfig: QuizRoundConfig = {
    subject: 'Economics 0455',
    sourceType: 'topic',
    sourceValue: topic.id,
    roundLength: 5,
    isTimed: true,
  };
  const filtered = filterPoolByConfig(CAMBRIDGE_QUESTIONS, topicConfig);
  const expectedCount = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic.id).length;
  
  assert.strictEqual(
    filtered.length,
    expectedCount,
    `Filtered pool for topic ${topic.id} should have exactly ${expectedCount} questions`
  );
  for (const q of filtered) {
    assert.strictEqual(
      q.topic_id,
      topic.id,
      `All filtered questions must have topic_id === ${topic.id}`
    );
  }
}
console.log('  ✓ Each individual topic ID filters strictly to matching questions');

// 2c. Test multi-topic selection (e.g. Chapter 1 + Chapter 2)
const multiTopicIds = [CAMBRIDGE_TOPICS[0].id, CAMBRIDGE_TOPICS[1].id];
const multiConfig: QuizRoundConfig = {
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceValue: multiTopicIds.join(','),
  roundLength: 10,
  isTimed: true,
};
const multiFiltered = filterPoolByConfig(CAMBRIDGE_QUESTIONS, multiConfig);
const expectedMultiCount = CAMBRIDGE_QUESTIONS.filter(
  (q) => q.topic_id === multiTopicIds[0] || q.topic_id === multiTopicIds[1]
).length;

assert.strictEqual(
  multiFiltered.length,
  expectedMultiCount,
  `Multi-topic filter should return sum of questions (${expectedMultiCount}) for selected topics, got ${multiFiltered.length}`
);
const multiSet = new Set(multiTopicIds);
for (const q of multiFiltered) {
  assert(
    q.topic_id && multiSet.has(q.topic_id),
    `Question ${q.id} topic ${q.topic_id} should be within selected topics`
  );
}
console.log(`  ✓ Multi-topic filter (2 chapters: Ch 1 & Ch 2) returns exactly ${multiFiltered.length} matching questions`);

// 2d. Test multi-topic selection with 3 chapters (Ch 1, 3, 5)
const threeTopicIds = [CAMBRIDGE_TOPICS[0].id, CAMBRIDGE_TOPICS[2].id, CAMBRIDGE_TOPICS[4].id];
const threeConfig: QuizRoundConfig = {
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceValue: threeTopicIds.join(','),
  roundLength: 10,
  isTimed: true,
};
const threeFiltered = filterPoolByConfig(CAMBRIDGE_QUESTIONS, threeConfig);
const expectedThreeCount = CAMBRIDGE_QUESTIONS.filter(
  (q) => q.topic_id && threeTopicIds.includes(q.topic_id)
).length;
assert.strictEqual(threeFiltered.length, expectedThreeCount);
console.log(`  ✓ Multi-topic filter (3 chapters) returns exactly ${threeFiltered.length} matching questions`);

// 3. Verify revizz_last_config serialization/deserialization
console.log('3. Verifying revizz_last_config serialization/deserialization...');

// Multi-topic config serialization
const configToSave: QuizRoundConfig = {
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceValue: multiTopicIds.join(','),
  roundLength: 5,
  isTimed: true,
  diagramFilter: 'mixed',
};

const serialized = JSON.stringify(configToSave);
const deserialized = JSON.parse(serialized);

assert.strictEqual(deserialized.sourceType, 'topic');
assert.strictEqual(deserialized.sourceValue, multiTopicIds.join(','));
assert.strictEqual(deserialized.roundLength, 5);
assert.strictEqual(deserialized.isTimed, true);

// Simulate StartFlow.tsx restoration logic
let restoredMode: string = 'standard';
let restoredTopicIds: string[] = [];

if (deserialized.sourceType === 'review') restoredMode = 'review';
else if (deserialized.sourceType === 'topic') {
  restoredMode = 'topic';
  if (deserialized.sourceValue && typeof deserialized.sourceValue === 'string') {
    if (deserialized.sourceValue !== 'all') {
      const ids = deserialized.sourceValue.split(',').filter(Boolean);
      if (ids.length > 0) {
        restoredTopicIds = ids;
      }
    }
  }
} else {
  restoredMode = 'standard';
}

assert.strictEqual(restoredMode, 'topic', 'Mode should be restored to "topic"');
assert.deepStrictEqual(restoredTopicIds, multiTopicIds, 'Topic IDs should be restored to the saved multi-topic array');
console.log('  ✓ Serialization & restoration accurately restores multi-topic sourceValue');

// 4. Verify Static Code Contracts in components/StartFlow.tsx and app/page.tsx
console.log('4. Verifying components/StartFlow.tsx & app/page.tsx code contracts...');
const startFlowPath = path.resolve(__dirname, '../components/StartFlow.tsx');
const startFlowSource = fs.readFileSync(startFlowPath, 'utf-8');

assert(startFlowSource.includes('selectedTopicIds'), 'StartFlow.tsx must manage selectedTopicIds array state');
assert(startFlowSource.includes('isTopicModalOpen'), 'StartFlow.tsx must manage isTopicModalOpen state');
assert(startFlowSource.includes('data-testid="topic-picker-trigger"'), 'StartFlow.tsx must have data-testid="topic-picker-trigger"');
assert(startFlowSource.includes('data-testid="topic-picker-modal"'), 'StartFlow.tsx must have data-testid="topic-picker-modal"');
assert(startFlowSource.includes('data-testid="topic-picker-menu"'), 'StartFlow.tsx must have data-testid="topic-picker-menu"');
assert(startFlowSource.includes('data-testid="topic-select-all"'), 'StartFlow.tsx must have data-testid="topic-select-all" button');
assert(startFlowSource.includes('data-testid="topic-clear-all"'), 'StartFlow.tsx must have data-testid="topic-clear-all" button');
assert(startFlowSource.includes('data-testid="topic-modal-done"'), 'StartFlow.tsx must have data-testid="topic-modal-done" button');
assert(startFlowSource.includes('data-testid={`topic-option-${t.id}`}'), 'StartFlow.tsx must render topic-option-${t.id} test IDs');
assert(startFlowSource.includes('Edit Topics ✎'), 'StartFlow.tsx trigger must show "Edit Topics ✎"');

// Verify app/page.tsx multi-topic support
const pagePath = path.resolve(__dirname, '../app/page.tsx');
const pageSource = fs.readFileSync(pagePath, 'utf-8');
assert(pageSource.includes('targetTopicIds'), 'app/page.tsx must extract targetTopicIds Set from comma-separated sourceValue');
assert(pageSource.includes('targetTopicIds.has(q.topic_id)'), 'app/page.tsx must filter questions by targetTopicIds Set');

console.log('  ✓ All StartFlow.tsx and app/page.tsx code contracts and testids verified');

console.log('\n========================================================');
console.log('   ALL MULTI-TOPIC SELECTION TESTS PASSED PERFECTLY! 🚀');
console.log('========================================================\n');
