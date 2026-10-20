import fs from 'fs';
import path from 'path';
import {
  StagingPaper,
  StagingQuestion,
  validateStagingPaper,
} from '../types/ingestion';

const SLICES_DIR = path.resolve(__dirname, '../staging/slices');
const OUTPUT_FILE = path.resolve(__dirname, '../staging/0455_m24_12.json');

const QUESTION_FILES = [
  'm24_q01_10.json',
  'm24_q11_20.json',
  'm24_q21_30.json',
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

  // 2. Load all 30 questions
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
      const qNum = Number(q.question_number);
      if (isNaN(qNum) || qNum < 1 || qNum > 30) {
        throw new Error(`Invalid question number: ${q.question_number} in ${file}`);
      }

      if (!q.cambridge_source_ref) {
        q.cambridge_source_ref = `Cambridge IGCSE Economics 0455/12 Feb/March 2024 Q${qNum}`;
      }

      if (!q.status) {
        q.status = 'active';
      }

      allQuestions.push(q);
    }
  }

  // Sort questions by question_number
  allQuestions.sort((a, b) => a.question_number - b.question_number);

  if (allQuestions.length !== 30) {
    throw new Error(`Expected exactly 30 questions, found ${allQuestions.length}`);
  }

  // Construct StagingPaper
  const stagingPaper: StagingPaper = {
    id: '0455_m24_12',
    lifecycle_state: 'review',
    state: 'review',
    source_qp_filename: '0455_m24_qp_12.pdf',
    source_ms_filename: '0455_m24_ms_12.pdf',
    detected_year: 2024,
    detected_series: 'm',
    detected_paper_code: '12',
    subject: {
      code: '0455',
      name: 'Economics',
      icon: 'trending-up',
    },
    paper: {
      series: 'm',
      paper_code: '12',
      year: 2024,
    },
    syllabus_topics: [
      { name: 'The basic economic problem', order_index: 1 },
      { name: 'The allocation of resources', order_index: 2 },
      { name: 'Microeconomic decision makers', order_index: 3 },
      { name: 'Government and the macroeconomy', order_index: 4 },
      { name: 'Economic development', order_index: 5 },
      { name: 'International trade and globalisation', order_index: 6 },
    ],
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
