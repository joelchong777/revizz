export interface TestPaperConfig {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  schoolName: string;
  durationMinutes: number;
  totalMarks: number;
  testCode: string;
  dateString: string;
  includeCoverPage: boolean;
  includeCandidateHeader: boolean;
  includeBubbleSheet: boolean;
  includeMarkScheme: boolean;
  instructionsText?: string;
  questionIds: string[];
  compiledQuestions?: CompiledExamQuestion[];
  createdAt: string;
}

export interface CompiledExamQuestion {
  questionNumber: number;
  id: string;
  stemMarkdown: string;
  imageUrl?: string | null;
  options: { label: 'A' | 'B' | 'C' | 'D'; textMarkdown: string; isCorrect: boolean; }[];
  citation?: string;
  topic?: string;
  explanationMarkdown?: string | null;
}
