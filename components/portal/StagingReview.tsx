'use client';

import React, { useState } from 'react';
import StagedPapersQueue from '@/components/portal/staged/StagedPapersQueue';
import StagedPaperAuditor from '@/components/portal/staged/StagedPaperAuditor';

export interface StagingReviewProps {
  initialPaperId?: string | null;
  onOpenFullStudio?: (paperId: string) => void;
}

export default function StagingReview({ initialPaperId = null, onOpenFullStudio }: StagingReviewProps) {
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(initialPaperId);

  const handleOpenStudio = (paperId: string) => {
    if (onOpenFullStudio) {
      onOpenFullStudio(paperId);
    } else if (typeof window !== 'undefined') {
      window.location.href = `/admin?tab=ingestion&preset=${encodeURIComponent(paperId)}`;
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
