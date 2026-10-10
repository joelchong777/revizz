import fs from 'fs';
import path from 'path';

interface StagingOption {
  label: string;
  content_markdown: string;
  is_correct: boolean;
}

interface StagingQuestion {
  question_number: number;
  cambridge_source_ref: string;
  topic_name: string;
  stem_markdown: string;
  explanation_markdown: string;
  status?: string;
  diagram?: {
    has_diagram: boolean;
    image_url?: string;
  };
  options: StagingOption[];
}

interface StagingPaper {
  subject: {
    code: string;
    name: string;
    icon: string;
  };
  paper: {
    series: string;
    paper_code: string;
    year: number;
  };
  syllabus_topics: {
    name: string;
    order_index: number;
  }[];
  questions: StagingQuestion[];
}

const TOPIC_UUID_MAP: Record<string, string> = {
  'The basic economic problem': 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
  'The allocation of resources': '6b7bf963-f082-467c-a7ca-812891a838ab',
  'Microeconomic decision makers': '76de1d41-45e1-46a2-9a23-714d283948f2',
  'Government and the macroeconomy': '09266079-92a1-44f2-961d-daf0c1b2ac2b',
  'Economic development': 'c9501184-3e43-4b00-aac5-791638119278',
  'International trade and globalisation': '941a998b-8700-47b5-8695-c262070d4949',
};

const SUBJECT_ID = '9d8a0a9e-b790-4b7d-9871-82f85b379b44';
const PAPER_ID = '44b5a068-194c-4c5c-a934-05a19006e4f8';

export function generateQuestionSql(q: StagingQuestion): string {
  const qNum = q.question_number;
  const topicId = TOPIC_UUID_MAP[q.topic_name];
  if (!topicId) {
    throw new Error(`Unknown topic: ${q.topic_name} for Q${qNum}`);
  }

  const cambridgeRef = `0455/12/M/J/24 Q${qNum}`;
  const imageUrl = q.diagram?.has_diagram && q.diagram.image_url ? `'${q.diagram.image_url}'` : 'NULL';
  const active = q.status !== 'withdrawn' ? 'true' : 'false';

  const stemTag = `$stem_${qNum}$`;
  const expTag = `$exp_${qNum}$`;

  const optValues = q.options.map(opt => {
    const optTag = `$opt_${qNum}_${opt.label}$`;
    const isCorrect = opt.is_correct ? 'true' : 'false';
    return `('${opt.label}'::bpchar, ${optTag}${opt.content_markdown}${optTag}, ${isCorrect})`;
  }).join(',\n    ');

  return `WITH q AS (
  INSERT INTO public.questions (
    subject_id, paper_id, topic_id, question_number, stem_markdown,
    image_url, explanation_markdown, cambridge_source_ref, active
  ) VALUES (
    '${SUBJECT_ID}', '${PAPER_ID}', '${topicId}', ${qNum}, ${stemTag}${q.stem_markdown}${stemTag},
    ${imageUrl}, ${expTag}${q.explanation_markdown}${expTag}, '${cambridgeRef}', ${active}
  )
  ON CONFLICT (paper_id, question_number) DO UPDATE SET
    subject_id = EXCLUDED.subject_id,
    topic_id = EXCLUDED.topic_id,
    stem_markdown = EXCLUDED.stem_markdown,
    image_url = EXCLUDED.image_url,
    explanation_markdown = EXCLUDED.explanation_markdown,
    cambridge_source_ref = EXCLUDED.cambridge_source_ref,
    active = EXCLUDED.active
  RETURNING id
)
INSERT INTO public.question_options (question_id, label, content_markdown, is_correct)
SELECT q.id, opt.label, opt.content_markdown, opt.is_correct
FROM q, (VALUES
    ${optValues}
) AS opt(label, content_markdown, is_correct)
ON CONFLICT (question_id, label) DO UPDATE SET
  content_markdown = EXCLUDED.content_markdown,
  is_correct = EXCLUDED.is_correct;`;
}

function main() {
  const stagingPath = path.resolve(__dirname, '../staging/0455_s24_12.json');
  if (!fs.existsSync(stagingPath)) {
    throw new Error(`Staging file not found at ${stagingPath}`);
  }

  const raw = fs.readFileSync(stagingPath, 'utf8');
  const paper: StagingPaper = JSON.parse(raw);

  // Group into 6 batches of 5 questions each
  const batchSize = 5;
  for (let i = 0; i < paper.questions.length; i += batchSize) {
    const chunk = paper.questions.slice(i, i + batchSize);
    const startQ = chunk[0].question_number;
    const endQ = chunk[chunk.length - 1].question_number;
    const sqlStatements = chunk.map(q => generateQuestionSql(q)).join('\n\n');
    const batchFile = path.resolve(__dirname, `../staging/batch_q${startQ.toString().padStart(2, '0')}_q${endQ.toString().padStart(2, '0')}.sql`);
    fs.writeFileSync(batchFile, sqlStatements, 'utf8');
    console.log(`Wrote batch Q${startQ}-Q${endQ} to ${batchFile}`);
  }
}

main();
