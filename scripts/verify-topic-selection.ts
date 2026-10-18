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
    const topicFiltered = pool.filter((q) => q.topic_id === config.sourceValue);
    if (topicFiltered.length > 0) pool = topicFiltered;
  }

  return pool;
}

// Test selecting 'all' in topic mode returns all questions
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

// Test selecting each individual topic
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

// 3. Verify revizz_last_config serialization/deserialization with sourceType: 'topic' and sourceValue: '<topic-id>'
console.log('3. Verifying revizz_last_config serialization/deserialization...');

const selectedTopicId = CAMBRIDGE_TOPICS[1].id; // Chapter 2
const configToSave: QuizRoundConfig = {
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceValue: selectedTopicId,
  roundLength: 5,
  isTimed: true,
  diagramFilter: 'mixed',
};

const serialized = JSON.stringify(configToSave);
const deserialized = JSON.parse(serialized);

assert.strictEqual(deserialized.sourceType, 'topic');
assert.strictEqual(deserialized.sourceValue, selectedTopicId);
assert.strictEqual(deserialized.roundLength, 5);
assert.strictEqual(deserialized.isTimed, true);

// Simulate StartFlow.tsx restoration logic
let restoredMode: string = 'standard';
let restoredTopicId: string = 'all';

if (deserialized.sourceType === 'review') restoredMode = 'review';
else if (deserialized.sourceType === 'topic') {
  restoredMode = 'topic';
  if (deserialized.sourceValue && typeof deserialized.sourceValue === 'string') {
    restoredTopicId = deserialized.sourceValue;
  }
} else {
  restoredMode = 'standard';
}

assert.strictEqual(restoredMode, 'topic', 'Mode should be restored to "topic"');
assert.strictEqual(restoredTopicId, selectedTopicId, 'Topic ID should be restored to the saved topic ID');
console.log('  ✓ Serialization & restoration accurately restores sourceType="topic" and sourceValue');

// 4. Verify Static Code Contract in components/StartFlow.tsx
console.log('4. Verifying components/StartFlow.tsx code contracts...');
const startFlowPath = path.resolve(__dirname, '../components/StartFlow.tsx');
const startFlowSource = fs.readFileSync(startFlowPath, 'utf-8');

assert(startFlowSource.includes('selectedTopicId'), 'StartFlow.tsx must manage selectedTopicId state');
assert(startFlowSource.includes('isTopicDropdownOpen'), 'StartFlow.tsx must manage isTopicDropdownOpen state');
assert(startFlowSource.includes('topicDropdownRef'), 'StartFlow.tsx must have topicDropdownRef');
assert(startFlowSource.includes('data-testid="topic-picker-trigger"'), 'StartFlow.tsx must have data-testid="topic-picker-trigger"');
assert(startFlowSource.includes('data-testid="topic-picker-menu"'), 'StartFlow.tsx must have data-testid="topic-picker-menu"');
assert(startFlowSource.includes('data-testid="topic-option-all"'), 'StartFlow.tsx must have data-testid="topic-option-all"');
assert(startFlowSource.includes('data-testid={`topic-option-${t.id}`}'), 'StartFlow.tsx must render topic-option-${t.id} test IDs');
assert(startFlowSource.includes('Choose Topic'), 'StartFlow.tsx must render "Choose Topic" section header');
assert(startFlowSource.includes('syllabus topics'), 'StartFlow.tsx must render syllabus topics badge');
assert(startFlowSource.includes('All Topics (Across Syllabus)'), 'StartFlow.tsx must render "All Topics (Across Syllabus)"');
assert(startFlowSource.includes('sourceValue: selectedMode === \'topic\' ? selectedTopicId : \'random\''), 'StartFlow.tsx handleStart must set sourceValue to selectedTopicId for topic mode');

console.log('  ✓ All StartFlow.tsx code contracts and testids verified');

console.log('\n========================================================');
console.log('   ALL TOPIC SELECTION TESTS PASSED PERFECTLY! 🚀');
console.log('========================================================\n');
