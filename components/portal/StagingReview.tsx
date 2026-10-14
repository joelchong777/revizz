'use client';

import React, { useState } from 'react';
import StagedPapersQueue from '@/components/portal/staged/StagedPapersQueue';
import StagedPaperAuditor from '@/components/portal/staged/StagedPaperAuditor';
import { useIngestionStore } from '@/lib/ingestion/useIngestionStore';

export interface StagingReviewProps {
  initialPaperId?: string | null;
  onOpenFullStudio?: (paperId: string) => void;
  onArchivePaper?: (paperId: string) => Promise<{ success: boolean; error?: string }>;
}

export default function StagingReview({
  initialPaperId = null,
  onOpenFullStudio,
  onArchivePaper,
}: StagingReviewProps) {
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(initialPaperId);
  const storeArchive = useIngestionStore((state) => state.archiveStagedPaper);

  const handleOpenStudio = (paperId: string) => {
    if (onOpenFullStudio) {
      onOpenFullStudio(paperId);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/admin?tab=ingestion&preset=${encodeURIComponent(paperId)}`;
    }
  };

  const handleArchivePaper = async (paperId: string) => {
    if (onArchivePaper) {
      return onArchivePaper(paperId);
    }
    if (storeArchive) {
      return storeArchive(paperId);
    }
    try {
      const res = await fetch('/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', id: paperId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        return { success: false, error: data?.error || 'Failed to archive staged paper' };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  if (!selectedPaperId) {
    return (
      <StagedPapersQueue
        onSelectPaper={(id) => setSelectedPaperId(id)}
        onOpenFullStudio={handleOpenStudio}
      />
    );
  }

  return (
    <StagedPaperAuditor
      paperId={selectedPaperId}
      onBackToQueue={() => setSelectedPaperId(null)}
      onOpenFullStudio={handleOpenStudio}
    />
  );
}
