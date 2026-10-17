export interface CambridgeQuestionMeta {
  subject: string;
  year: number;
  series: string;
  seriesCode: string;
  paperCode: string;
  variant: string;
  questionNumber: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  status: 'Live' | 'Needs review' | 'Agent draft' | 'Withdrawn';
  topic: string;
  subtopic: string;
  tags: string[];
  hasDiagram: boolean;
  imageUrl: string;
  citation: string;
}

export const SUGGESTED_TAGS: string[] = [
  'Microeconomics',
  'Macroeconomics',
  'Calculation',
  'Graph / Diagram',
  'Data Response',
  'Definition',
  'Core Concept',
  'Paper 1',
];

export const SERIES_OPTIONS: { label: string; value: string; code: string }[] = [
  { label: 'May/June', value: 'May/June', code: 's' },
  { label: 'Oct/Nov', value: 'Oct/Nov', code: 'w' },
  { label: 'Feb/March', value: 'Feb/March', code: 'm' },
];

export const VARIANT_OPTIONS: string[] = ['1', '2', '3'];

export const PAPER_CODE_OPTIONS: string[] = ['11', '12', '13', '21', '22', '23'];

export const YEAR_OPTIONS: number[] = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];

export const SUBJECT_OPTIONS: string[] = [
  '0455 - Economics',
  '0610 - Biology',
  '0620 - Chemistry',
  '0625 - Physics',
];

export const DIFFICULTY_OPTIONS: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];

export const STATUS_OPTIONS: ('Live' | 'Needs review' | 'Agent draft' | 'Withdrawn')[] = [
  'Live',
  'Needs review',
  'Agent draft',
  'Withdrawn',
];

export function formatCambridgeCitation(meta: Partial<CambridgeQuestionMeta>): string {
  const subjectNum = meta.subject?.match(/\d{4}/)?.[0] || '0455';
  const paper = meta.paperCode || (meta.variant ? `1${meta.variant}` : '12');
  const series = meta.series || 'May/June';
  const year = meta.year || 2024;
  const qNum = meta.questionNumber ?? 1;

  let subjectPrefix = 'Cambridge IGCSE Economics';
  if (meta.subject && !meta.subject.toLowerCase().includes('economics')) {
    subjectPrefix = `Cambridge IGCSE ${meta.subject.replace(/^\d+\s*[-:]\s*/, '')}`;
  }

  return `${subjectPrefix} ${subjectNum}/${paper} ${series} ${year} Q${qNum}`;
}

export function parseCambridgeQuestionMetadata(q?: any): CambridgeQuestionMeta {
  if (!q) {
    return {
      subject: '0455 - Economics',
      year: 2024,
      series: 'May/June',
      seriesCode: 's',
      paperCode: '12',
      variant: '2',
      questionNumber: 1,
      difficulty: 'Medium',
      status: 'Live',
      topic: 'The basic economic problem',
      subtopic: '1.1 The nature of the economic problem',
      tags: ['Microeconomics', 'Core Concept'],
      hasDiagram: false,
      imageUrl: '',
      citation: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1',
    };
  }

  const id = typeof q.id === 'string' ? q.id : '';
  const citationStr = typeof q.citation === 'string' ? q.citation : '';

  // Extract year
  let year = 2024;
  const citationYearMatch = citationStr.match(/\b(20\d\d)\b/);
  if (citationYearMatch) {
    year = parseInt(citationYearMatch[1], 10);
  } else {
    const idYearMatch = id.match(/[-_]([smw])(\d{2})[-_]/i);
    if (idYearMatch) {
      year = 2000 + parseInt(idYearMatch[2], 10);
    }
  }

  // Extract series
  let series = 'May/June';
  let seriesCode = 's';
  if (/oct|nov|o\/n|-w\d/i.test(citationStr) || /[-_]w\d{2}[-_]/i.test(id)) {
    series = 'Oct/Nov';
    seriesCode = 'w';
  } else if (/feb|march|f\/m|-m\d/i.test(citationStr) || /[-_]m\d{2}[-_]/i.test(id)) {
    series = 'Feb/March';
    seriesCode = 'm';
  } else {
    series = 'May/June';
    seriesCode = 's';
  }

  // Extract paper code & variant
  let paperCode = '12';
  let variant = '2';
  const paperMatch = citationStr.match(/\d{4}\/(\d{2})/i) || id.match(/[-_](\d{2})[-_]q/i);
  if (paperMatch) {
    paperCode = paperMatch[1];
    variant = paperCode.slice(-1);
  } else if (q.paper) {
    paperCode = String(q.paper);
    variant = paperCode.slice(-1) || '2';
  }

  // Extract question number
  let questionNumber = 1;
  const qNumCitationMatch = citationStr.match(/\bQ(\d+)\b/i);
  const qNumIdMatch = id.match(/[-_]q(\d+)\b/i);
  if (qNumCitationMatch) {
    questionNumber = parseInt(qNumCitationMatch[1], 10);
  } else if (qNumIdMatch) {
    questionNumber = parseInt(qNumIdMatch[1], 10);
  } else if (typeof q.question_number === 'number') {
    questionNumber = q.question_number;
  }

  // Extract difficulty & status
  const difficulty: 'Easy' | 'Medium' | 'Hard' =
    q.difficulty === 'Easy' || q.difficulty === 'Hard' ? q.difficulty : 'Medium';

  const status: 'Live' | 'Needs review' | 'Agent draft' | 'Withdrawn' =
    q.status === 'Needs review' || q.status === 'Agent draft' || q.status === 'Withdrawn'
      ? q.status
      : 'Live';

  // Topic & Subtopic
  const topic = q.topic || 'The basic economic problem';
  const subtopic = q.subtopic || '';

  // Tags
  let tags: string[] = [];
  if (Array.isArray(q.tags) && q.tags.length > 0) {
    tags = q.tags;
  } else {
    const isMacro = /macro|government|trade|globalisation|development/i.test(topic);
    tags = isMacro ? ['Macroeconomics', 'Paper 1'] : ['Microeconomics', 'Core Concept'];
  }

  // Diagram & Media
  const hasDiagram = Boolean(
    q.has_diagram ||
    q.diagram?.has_diagram ||
    q.image_url ||
    q.diagram?.image_url
  );
  const imageUrl = q.image_url || q.diagram?.image_url || '';

  // Citation
  const citation = citationStr || formatCambridgeCitation({
    subject: '0455 - Economics',
    year,
    series,
    paperCode,
    variant,
    questionNumber,
  });

  return {
    subject: '0455 - Economics',
    year,
    series,
    seriesCode,
    paperCode,
    variant,
    questionNumber,
    difficulty,
    status,
    topic,
    subtopic,
    tags,
    hasDiagram,
    imageUrl,
    citation,
  };
}
