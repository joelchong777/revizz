export interface Subject {
  id: string;
  code: string;
  name: string;
  icon: string;
}

export interface Paper {
  id: string;
  subject_id: string;
  series: string;
  paper_code: string;
  year: number;
}

export interface Topic {
  id: string;
  subject_id: string;
  name: string;
  order_index: number;
}

export type OptionLabel = 'A' | 'B' | 'C' | 'D';

export interface QuestionOption {
  id: string;
  question_id: string;
  label: OptionLabel;
  content_markdown: string;
  is_correct: boolean;
}

export interface Question {
  id: string;
  subject_id: string;
  topic_id?: string | null;
  paper_id?: string | null;
  question_number: number;
  stem_markdown: string;
  image_url?: string | null;
  explanation_markdown?: string | null;
  cambridge_source_ref: string;
  active: boolean;
  options: QuestionOption[];
  topic?: Topic;
  paper?: Paper;
}

export interface QuizRoundConfig {
  subject_id: string;
  source_type: 'topic' | 'paper' | 'random';
  topic_id?: string;
  paper_id?: string;
  length: 3 | 5 | 10 | 30 | 'endless';
  timed: boolean;
}

export interface QuizAttemptState {
  question_id: string;
  first_pick?: string;
  retry_pick?: string;
  is_first_correct?: boolean;
  is_retry_correct?: boolean;
  xp_earned: number;
  time_spent_ms: number;
}

export interface UserProfile {
  id: string;
  display_name: string;
  email?: string | null;
  is_school_account: boolean;
  total_xp: number;
  current_streak: number;
  opt_in_leaderboard: boolean;
  role?: 'student' | 'teacher' | 'admin';
}

// Answer-integrity contract for /api/quiz/*: answers never ship with questions; the server grades and reveals.
export interface AnswerReveal {
  questionId: string;
  correctLabel: OptionLabel;
  correctOptionId: string | null; // DB option id when known
  explanationMarkdown: string | null;
  distractorByLabel: Partial<Record<OptionLabel, string>>;
}

// POST /api/quiz/answer (bearer optional; guests get scoring: null)
export interface QuizAnswerRequest {
  questionId: string;
  optionLabel?: OptionLabel; // required when event is 'answer'
  event: 'answer' | 'timeout' | 'give-up';
  attempt: 1 | 2; // trusted for guests only; signed-in attempts come from answer_events
  timeSpentMs?: number;
}

export interface QuizScoring {
  xpAwarded: number;
  streak: number;
  totalXp: number;
  counted: boolean; // false when the 24h per-question XP cooldown applied
}

export interface QuizAnswerResponse {
  success: true;
  correct: boolean | null; // null for timeout / give-up
  attempt: 1 | 2;
  final: boolean; // reveal is non-null exactly when final
  reveal: AnswerReveal | null;
  scoring: QuizScoring | null;
}

// POST /api/quiz/reveal (signed-in): only questions this user has finished
export interface QuizRevealRequest { questionIds: string[] }
export interface QuizRevealResponse { success: true; reveals: AnswerReveal[] }

// POST /api/quiz/grade (homework, no auth, no writes, max 60)
export interface QuizGradeRequest { answers: { questionId: string; optionLabel: OptionLabel | null }[] }
export interface QuizGradeResponse {
  success: true;
  score: number;
  total: number;
  results: { questionId: string; correct: boolean; reveal: AnswerReveal }[];
}

// POST /api/quiz/answer-keys (teacher/admin only, max 500)
export interface AnswerKeysRequest { questionIds: string[] }
export interface AnswerKeysResponse { success: true; keys: AnswerReveal[] }
