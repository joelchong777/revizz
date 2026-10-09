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
