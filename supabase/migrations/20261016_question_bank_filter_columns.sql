-- Migration: Add status and difficulty columns with performance indexes to public.questions
-- Date: 2026-10-16
-- Description: Adds status ('Live' | 'Agent draft' | 'Needs review' | 'Flagged') and difficulty ('Easy' | 'Medium' | 'Hard') columns
--              plus B-tree performance indexes for high-velocity Question Bank filtering.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'Live',
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'Medium';

-- Indexes for Question Bank filtering and faceted aggregation
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions (subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON public.questions (topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.questions (active);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions (status);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions (difficulty);

-- Composite index for fast subject + status + difficulty querying
CREATE INDEX IF NOT EXISTS idx_questions_subject_status_diff ON public.questions (subject_id, status, difficulty);
