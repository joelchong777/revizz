import fs from 'fs';
import path from 'path';
import {
  StagingPaper,
  StagingQuestion,
  StagingSyllabusTopic,
  DiagramMetadata,
  validateStagingPaper,
} from '../types/ingestion';

const SLICES_DIR = path.resolve(__dirname, '../staging/slices');
const OUTPUT_FILE = path.resolve(__dirname, '../staging/0455_s24_12.json');

const QUESTION_FILES = [
  'q01_05.json',
  'q06_10.json',
  'q11_15.json',
  'q16_20.json',
  'q21_25.json',
  'q26_30.json',
];

export function aggregatePaper(): { success: boolean; paper?: StagingPaper; errors?: string[] } {
  console.log('Aggregating question slices from:', SLICES_DIR);

  // 1. Verify all question slice files exist
  for (const file of QUESTION_FILES) {
    const fullPath = path.join(SLICES_DIR, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing question slice file: ${file}`);
    }
  }

  // 2. Load Diagrams metadata
  const diagramsPath = path.join(SLICES_DIR, 'diagrams.json');
  let diagramsMap: Record<number, DiagramMetadata> = {};
  if (fs.existsSync(diagramsPath)) {
    try {
      const rawDiagrams = JSON.parse(fs.readFileSync(diagramsPath, 'utf8'));
      if (Array.isArray(rawDiagrams)) {
        for (const item of rawDiagrams) {
          const qNum = item.question_number || item.qNum;
          if (qNum) {
            diagramsMap[Number(qNum)] = item.diagram || item;
          }
        }
      } else if (typeof rawDiagrams === 'object' && rawDiagrams !== null) {
        // Could be { "1": { has_diagram: ... } } or { diagrams: [...] }
        if (Array.isArray(rawDiagrams.diagrams)) {
          for (const item of rawDiagrams.diagrams) {
            const qNum = item.question_number || item.qNum;
            if (qNum) diagramsMap[Number(qNum)] = item.diagram || item;
          }
        } else {
          for (const [key, val] of Object.entries(rawDiagrams)) {
            const num = Number(key);
            if (!isNaN(num)) {
              diagramsMap[num] = val as DiagramMetadata;
            }
          }
        }
      }
      console.log(`Loaded diagrams map with ${Object.keys(diagramsMap).length} entries.`);
    } catch (e) {
      console.warn('Warning: Could not parse diagrams.json:', e);
    }
  } else {
    console.warn('diagrams.json not found, assuming default has_diagram: false');
  }

  // 3. Load Topics mappings
  const topicsPath = path.join(SLICES_DIR, 'topic_mappings.json');
  let syllabusTopics: StagingSyllabusTopic[] = [];
  let questionTopicMap: Record<number, string> = {};

  if (fs.existsSync(topicsPath)) {
    try {
      const rawTopics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));
      if (Array.isArray(rawTopics)) {
        // Array of syllabus topics or mappings
        if (rawTopics.length > 0 && typeof rawTopics[0] === 'object' && 'name' in rawTopics[0]) {
          syllabusTopics = rawTopics.map((t: any, idx: number) => ({
            name: t.name,
            order_index: t.order_index ?? idx + 1,
          }));
        } else if (rawTopics.length > 0 && typeof rawTopics[0] === 'object' && 'question_number' in rawTopics[0]) {
          for (const item of rawTopics) {
            questionTopicMap[item.question_number] = item.topic_name;
          }
        }
      } else if (typeof rawTopics === 'object' && rawTopics !== null) {
        if (Array.isArray(rawTopics.syllabus_topics)) {
          syllabusTopics = rawTopics.syllabus_topics.map((t: any, idx: number) => ({
            name: t.name,
            order_index: t.order_index ?? idx + 1,
          }));
        }
        if (rawTopics.question_topics && typeof rawTopics.question_topics === 'object') {
          for (const [k, v] of Object.entries(rawTopics.question_topics)) {
            questionTopicMap[Number(k)] = String(v);
          }
        } else if (rawTopics.mappings && typeof rawTopics.mappings === 'object') {
          for (const [k, v] of Object.entries(rawTopics.mappings)) {
            questionTopicMap[Number(k)] = String(v);
          }
        } else {
          // Maybe it's directly { "1": "Topic", "2": "Topic" }
          for (const [k, v] of Object.entries(rawTopics)) {
            const num = Number(k);
            if (!isNaN(num) && typeof v === 'string') {
              questionTopicMap[num] = v;
            }
          }
        }
      }
      console.log(`Loaded ${syllabusTopics.length} syllabus topics and ${Object.keys(questionTopicMap).length} question-topic mappings.`);
    } catch (e) {
      console.warn('Warning: Could not parse topic_mappings.json:', e);
    }
  }

  // 4. Load all 30 questions
  const allQuestions: StagingQuestion[] = [];
  for (const file of QUESTION_FILES) {
    const fullPath = path.join(SLICES_DIR, file);
    const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const questions: StagingQuestion[] = Array.isArray(content)
      ? content
      : Array.isArray(content.questions)
      ? content.questions
      : [];

    if (questions.length === 0) {
      throw new Error(`File ${file} contained no valid questions array!`);
    }

    for (const q of questions) {
      // Ensure question number
      const qNum = Number(q.question_number);
      if (isNaN(qNum) || qNum < 1 || qNum > 30) {
        throw new Error(`Invalid question number: ${q.question_number} in ${file}`);
      }

      // Check topic
      if (!q.topic_name && questionTopicMap[qNum]) {
        q.topic_name = questionTopicMap[qNum];
      }
      if (!q.topic_name) {
        q.topic_name = 'General Economics';
      }

      // Check diagram
      if (!q.diagram) {
        if (diagramsMap[qNum]) {
          q.diagram = diagramsMap[qNum];
        } else {
          q.diagram = { has_diagram: false };
        }
      } else if (diagramsMap[qNum]) {
        // Merge in case diagrams.json has more complete metadata (bounding boxes, storage_path, etc.)
        q.diagram = { ...diagramsMap[qNum], ...q.diagram };
      }

      // Ensure Cambridge source ref
      if (!q.cambridge_source_ref) {
        q.cambridge_source_ref = `Cambridge IGCSE Economics 0455/12 May/June 2024 Q${qNum}`;
      }

      // Ensure status
      if (!q.status) {
        q.status = 'active';
      }

      allQuestions.push(q);
    }
  }

  // Sort questions by question_number
  allQuestions.sort((a, b) => a.question_number - b.question_number);

  // If syllabusTopics was not populated from topic_mappings.json, derive from questions
  if (syllabusTopics.length === 0) {
    const seenTopics = new Set<string>();
    const derivedTopics: StagingSyllabusTopic[] = [];
    for (const q of allQuestions) {
      if (q.topic_name && !seenTopics.has(q.topic_name)) {
        seenTopics.add(q.topic_name);
        derivedTopics.push({
          name: q.topic_name,
          order_index: derivedTopics.length + 1,
        });
      }
    }
    syllabusTopics = derivedTopics;
    console.log(`Derived ${syllabusTopics.length} syllabus topics from question topic names.`);
  }

  // Construct StagingPaper
  const stagingPaper: StagingPaper = {
    subject: {
      code: '0455',
      name: 'Economics',
      icon: 'trending-up',
    },
    paper: {
      series: 's',
      paper_code: '12',
      year: 2024,
    },
    syllabus_topics: syllabusTopics,
    questions: allQuestions,
  };

  // Validate paper
  console.log(`Validating staging paper with ${stagingPaper.questions.length} questions...`);
  const validation = validateStagingPaper(stagingPaper, { expectedQuestionCount: 30 });

  if (!validation.success) {
    console.error('Validation FAILED with errors:');
    validation.errors?.forEach((err) => console.error(`  - ${err}`));
    return { success: false, errors: validation.errors };
  }

  console.log('Validation SUCCESSFUL!');
  // Save final file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validation.data, null, 2), 'utf8');
  console.log(`Wrote final staging paper to: ${OUTPUT_FILE}`);

  return { success: true, paper: validation.data };
}

if (require.main === module) {
  try {
    const res = aggregatePaper();
    if (!res.success) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Error during aggregation:', err.message);
    process.exit(1);
  }
}
