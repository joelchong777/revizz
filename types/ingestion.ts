import { z } from 'zod';
import type { OptionLabel } from './quiz';

/**
 * Normalised coordinates of a diagram crop within a PDF page.
 */
export const BoundingBoxSchema = z.object({
  ymin: z.number(),
  xmin: z.number(),
  ymax: z.number(),
  xmax: z.number(),
  page_number: z.number().int(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

/**
 * Diagram extraction and storage metadata.
 */
export const DiagramMetadataSchema = z.object({
  has_diagram: z.boolean(),
  bounding_box: BoundingBoxSchema.optional(),
  image_url: z.string().optional(),
  storage_path: z.string().optional(),
  alt_description: z.string().optional(),
});
export type DiagramMetadata = z.infer<typeof DiagramMetadataSchema>;

/**
 * MCQ Option label ('A' | 'B' | 'C' | 'D').
 */
export const OptionLabelSchema = z.enum(['A', 'B', 'C', 'D']);

/**
 * Single option in a staging question.
 */
export const StagingOptionSchema = z.object({
  label: OptionLabelSchema,
  content_markdown: z.string(),
  is_correct: z.boolean(),
});
export type StagingOption = z.infer<typeof StagingOptionSchema>;

/**
 * Paper lifecycle state enum.
 */
export const PaperLifecycleStateSchema = z.enum(['draft', 'extracting', 'review', 'published']);
export type PaperLifecycleState = z.infer<typeof PaperLifecycleStateSchema>;

/**
 * Question validation status enum.
 */
export const QuestionValidationStatusSchema = z.enum(['valid', 'warning', 'error']);
export type QuestionValidationStatus = z.infer<typeof QuestionValidationStatusSchema>;

/**
 * Question status enum.
 */
export const QuestionStatusSchema = z.enum(['active', 'withdrawn', 'needs_review']);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

/**
 * Staged question from Cambridge ingestion pipeline.
 */
export const StagingQuestionSchema = z.object({
  question_number: z.number().int().positive(),
  cambridge_source_ref: z.string().optional().default(''),
  topic_name: z.string().optional().default('General'),
  stem_markdown: z.string(),
  diagram: DiagramMetadataSchema.optional(),
  diagrams: z.array(BoundingBoxSchema).optional(),
  options: z.array(StagingOptionSchema),
  explanation_markdown: z.string(),
  status: QuestionStatusSchema.optional().default('active'),
  page_number: z.number().int().positive().optional(),
  distractor_analysis: z.record(z.string(), z.string()).optional(),
  validation_status: QuestionValidationStatusSchema.optional(),
});
export type StagingQuestion = z.infer<typeof StagingQuestionSchema>;

/**
 * Subject metadata for staging.
 */
export const StagingSubjectSchema = z.object({
  code: z.string(),
  name: z.string(),
  icon: z.string(),
});
export type StagingSubject = z.infer<typeof StagingSubjectSchema>;

/**
 * Paper metadata for staging.
 */
export const StagingPaperMetaSchema = z.object({
  series: z.string(),
  paper_code: z.string(),
  year: z.number().int(),
});
export type StagingPaperMeta = z.infer<typeof StagingPaperMetaSchema>;

/**
 * Syllabus topic mapping for staging.
 */
export const StagingSyllabusTopicSchema = z.object({
  name: z.string(),
  order_index: z.number().int(),
});
export type StagingSyllabusTopic = z.infer<typeof StagingSyllabusTopicSchema>;

/**
 * Complete Cambridge MCQ staging paper document.
 */
export const StagingPaperSchema = z.object({
  id: z.string().optional(),
  lifecycle_state: PaperLifecycleStateSchema.optional(),
  state: PaperLifecycleStateSchema.optional(),
  source_qp_filename: z.string().optional(),
  source_ms_filename: z.string().optional(),
  total_pages: z.number().int().positive().optional(),
  detected_year: z.number().int().optional(),
  detected_series: z.string().optional(),
  detected_paper_code: z.string().optional(),
  subject: StagingSubjectSchema,
  paper: StagingPaperMetaSchema,
  syllabus_topics: z.array(StagingSyllabusTopicSchema),
  questions: z.array(StagingQuestionSchema),
  ingested_at: z.string().optional(),
  updated_at: z.string().optional(),
  published_at: z.string().optional(),
  source: z.string().optional(),
});
export type StagingPaper = z.infer<typeof StagingPaperSchema>;

/**
 * Syllabus topic summary item for staged paper metadata.
 */
export interface StagedPaperTopicSummary {
  name: string;
  count: number;
}

/**
 * Summary representation of a staged paper in staging/ directory.
 */
export interface StagedPaperSummary {
  id: string;
  filename: string;
  subject?: { code?: string; name?: string; icon?: string };
  paper?: { year?: number; series?: string; paper_code?: string };
  questionsCount?: number;
  diagramsCount?: number;
  activeCount?: number;
  needsReviewCount?: number;
  withdrawnCount?: number;
  topicsCount?: number;
  topicBreakdown?: StagedPaperTopicSummary[];
  ingested_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  source_qp_filename?: string | null;
  source_ms_filename?: string | null;
  lifecycle_state?: string;
  is_published?: boolean;
  published_exam_paper_id?: string | null;
  is_archived?: boolean;
  isValid?: boolean;
  source?: 'database' | 'staging' | string;
}

/**
 * Validation options for staging paper verification.
 */
export interface ValidatePaperOptions {
  /**
   * Expected total number of questions. Default is 40 (Cambridge standard).
   */
  expectedQuestionCount?: number;
  /**
   * Set to true when validating partial batches or chunks rather than a full 40-question paper.
   */
  allowPartialBatch?: boolean;
}

/**
 * Generic validation return type.
 */
export interface ValidationResult<T> {
  success: boolean;
  errors?: string[];
  data?: T;
}

/**
 * Validates a single staging question.
 * Ensures:
 * - Exact Zod schema conformity
 * - Exactly 4 options (A, B, C, D)
 * - At least one option marked correct
 */
export function validateStagingQuestion(data: unknown): ValidationResult<StagingQuestion> {
  const result = StagingQuestionSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`
    );
    return { success: false, errors };
  }

  const q = result.data;
  const errors: string[] = [];
  const qNum = q.question_number;

  // 1. Each question must have exactly 4 options
  if (q.options.length !== 4) {
    errors.push(`Question ${qNum}: Must have exactly 4 options (found ${q.options.length}).`);
  }

  // 2. Options must contain each of labels A, B, C, and D exactly once
  const labels = q.options.map((o) => o.label).sort();
  const expectedLabels = ['A', 'B', 'C', 'D'];
  const hasExactLabels =
    labels.length === 4 && labels.every((label, idx) => label === expectedLabels[idx]);
  if (!hasExactLabels) {
    errors.push(
      `Question ${qNum}: Options must contain each of labels A, B, C, and D exactly once (found: ${q.options.map((o) => o.label).join(', ')}).`
    );
  }

  // 3. At least one option is marked correct
  const correctCount = q.options.filter((o) => o.is_correct).length;
  if (correctCount === 0) {
    errors.push(`Question ${qNum}: At least one option must be marked as correct.`);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: q };
}

/**
 * Validates a complete staging paper.
 * Ensures:
 * - Complete schema conformance
 * - Expected question count (default 40, or custom / partial batch)
 * - Each question has exactly 4 options (A, B, C, D)
 * - Each question has at least one correct option
 */
export function validateStagingPaper(
  data: unknown,
  options?: ValidatePaperOptions
): ValidationResult<StagingPaper> {
  const baseResult = StagingPaperSchema.safeParse(data);
  if (!baseResult.success) {
    const errors = baseResult.error.issues.map(
      (issue) => `${issue.path.length ? issue.path.join('.') + ': ' : ''}${issue.message}`
    );
    return { success: false, errors };
  }

  const paper = baseResult.data;
  const errors: string[] = [];

  // 1. Check question count
  const expectedCount =
    options?.expectedQuestionCount ?? (options?.allowPartialBatch ? undefined : 40);

  if (expectedCount !== undefined) {
    if (paper.questions.length !== expectedCount) {
      errors.push(
        `Paper must contain exactly ${expectedCount} questions (found ${paper.questions.length}).`
      );
    }
  } else if (paper.questions.length === 0) {
    errors.push('Paper contains no questions in batch.');
  }

  // 2. Check each question's options and correctness
  for (let i = 0; i < paper.questions.length; i++) {
    const q = paper.questions[i];
    const qNum = q.question_number || i + 1;

    // Check exactly 4 options
    if (q.options.length !== 4) {
      errors.push(`Question ${qNum}: Must have exactly 4 options (found ${q.options.length}).`);
    }

    // Check labels A, B, C, D
    const labels = q.options.map((o) => o.label).sort();
    const expectedLabels = ['A', 'B', 'C', 'D'];
    const hasExactLabels =
      labels.length === 4 && labels.every((label, idx) => label === expectedLabels[idx]);
    if (!hasExactLabels) {
      errors.push(
        `Question ${qNum}: Options must contain each of labels A, B, C, and D exactly once (found: ${q.options.map((o) => o.label).join(', ')}).`
      );
    }

    // Check at least one correct option
    const correctCount = q.options.filter((o) => o.is_correct).length;
    if (correctCount === 0) {
      errors.push(`Question ${qNum}: At least one option must be marked as correct.`);
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: paper };
}
