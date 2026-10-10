import {
  getQuestionValidation,
  hasDiagram,
  IngestionQuestionNavProps,
} from "../components/portal/IngestionQuestionNav";
import type { StagingQuestion } from "../types/ingestion";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log("=== Testing IngestionQuestionNav Helpers ===");

// Test 1: Valid Question
const validQ: StagingQuestion = {
  question_number: 1,
  cambridge_source_ref: "0455/12/M/J/24 Q1",
  topic_name: "Basic Economic Problem",
  stem_markdown: "What is an opportunity cost?",
  diagram: { has_diagram: false },
  options: [
    { label: "A", content_markdown: "The next best alternative forgone", is_correct: true },
    { label: "B", content_markdown: "Total monetary cost", is_correct: false },
    { label: "C", content_markdown: "Direct accounting cost", is_correct: false },
    { label: "D", content_markdown: "Fixed capital expense", is_correct: false },
  ],
  explanation_markdown: "Standard definition",
  status: "active",
};

const v1 = getQuestionValidation(validQ);
assert(v1.isValid === true, "Valid question passes validation");
assert(v1.issues.length === 0, "Valid question has zero issues");

// Test 2: Invalid Question - Missing Stem
const emptyStemQ: StagingQuestion = {
  ...validQ,
  stem_markdown: "   ",
};
const v2 = getQuestionValidation(emptyStemQ);
assert(v2.isValid === false, "Empty stem question fails validation");
assert(v2.issues.some(i => i.includes("Stem text is empty")), "Detects empty stem error");

// Test 3: Invalid Question - 3 options
const threeOptionsQ: StagingQuestion = {
  ...validQ,
  options: validQ.options.slice(0, 3),
};
const v3 = getQuestionValidation(threeOptionsQ);
assert(v3.isValid === false, "3 options question fails validation");
assert(v3.issues.some(i => i.includes("Requires 4 options")), "Detects options count error");

// Test 4: Invalid Question - 0 correct
const zeroCorrectQ: StagingQuestion = {
  ...validQ,
  options: validQ.options.map(o => ({ ...o, is_correct: false })),
};
const v4 = getQuestionValidation(zeroCorrectQ);
assert(v4.isValid === false, "No correct option marked fails validation");
assert(v4.issues.some(i => i.includes("No correct option marked")), "Detects missing correct option");

// Test 5: Invalid Question - Multiple correct
const multiCorrectQ: StagingQuestion = {
  ...validQ,
  options: validQ.options.map(o => ({ ...o, is_correct: true })),
};
const v5 = getQuestionValidation(multiCorrectQ);
assert(v5.isValid === false, "Multiple correct options fails validation");
assert(v5.issues.some(i => i.includes("Multiple correct options marked")), "Detects multiple correct options");

// Test 6: Diagram detection
const diagramMetaQ: StagingQuestion = {
  ...validQ,
  diagram: { has_diagram: true },
};
assert(hasDiagram(diagramMetaQ) === true, "has_diagram: true is detected");

const diagramUrlQ: StagingQuestion = {
  ...validQ,
  diagram: { has_diagram: false, image_url: "https://example.com/diagram.png" },
};
assert(hasDiagram(diagramUrlQ) === true, "image_url is detected");

const markdownImageQ: StagingQuestion = {
  ...validQ,
  stem_markdown: "Look at the diagram: ![graph](https://example.com/graph.png)",
};
assert(hasDiagram(markdownImageQ) === true, "Markdown ![image] is detected");

const textOnlyQ: StagingQuestion = {
  ...validQ,
  stem_markdown: "Pure text question without images",
  diagram: { has_diagram: false },
};
assert(hasDiagram(textOnlyQ) === false, "Text only question hasDiagram is false");

console.log("\n🎉 All IngestionQuestionNav logic checks passed successfully!");
