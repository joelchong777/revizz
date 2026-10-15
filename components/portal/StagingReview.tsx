'use client';

export interface StagingReviewProps {
  initialPaperId?: string | null;
  onOpenFullStudio?: (paperId: string) => void;
  onArchivePaper?: (paperId: string) => Promise<{ success: boolean; error?: string }>;
}

export default function StagingReview(_props?: StagingReviewProps) {
  return null;
}
