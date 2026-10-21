'use client';

import React from 'react';
import { Check, ChevronDown, ChevronUp, Image as ImageIcon, Sparkles, Tag, ZoomIn } from 'lucide-react';
import { RichMarkdown } from '@/components/ui/RichMarkdown';
import type { StagingQuestion } from '@/types/ingestion';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { hasDiagram } from '@/lib/paperViewer';

export interface PaperQuestionCardProps {
  q: StagingQuestion;
  index: number;
  total: number;
  isActive: boolean;
  showAnswers: boolean;
  isExplanationOpen: boolean;
  onToggleExplanation: (questionNumber: number) => void;
  onZoom: (diagram: { url: string; questionNumber: number; alt?: string }) => void;
}

function PaperQuestionCardImpl({
  q,
  index,
  total,
  isActive,
  showAnswers,
  isExplanationOpen,
  onToggleExplanation,
  onZoom,
}: PaperQuestionCardProps) {
  const hasDiag = hasDiagram(q);
  const diagramUrl = resolveDiagramUrl(q.diagram?.image_url) || q.diagram?.image_url;
  const sanitizedStem = sanitizeKaTeX(q.stem_markdown || '');
  const zoom = () => {
    if (!diagramUrl) return;
    onZoom({ url: diagramUrl, questionNumber: q.question_number, alt: q.diagram?.alt_description });
  };

  return (
    <article
      id={`question-q${q.question_number}`}
      data-q={q.question_number}
      aria-label={`Question ${q.question_number}`}
      aria-posinset={index + 1}
      aria-setsize={total}
      className={`grid grid-cols-[32px_minmax(0,1fr)] gap-4 rounded-3xl p-5 bg-[#f9f4ed] border-2 transition-[border-color,box-shadow] scroll-mt-16 lg:scroll-mt-1 print:shadow-none print:border-black print:rounded-none print:break-inside-avoid print:p-4 ${
        isActive
          ? 'border-[#c67139] shadow-[4px_4px_0_0_#c67139]'
          : 'border-[#201e1d] shadow-[3px_3px_0_0_#201e1d]'
      }`}
    >
      {/* Q number badge */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 ${
          isActive ? 'bg-[#c67139] text-white' : 'bg-[#201e1d] text-[#f9f4ed]'
        }`}
        aria-hidden="true"
      >
        {q.question_number}
      </div>

      <div className="min-w-0 space-y-3">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#645c50] min-h-8">
          {q.cambridge_source_ref && <span className="font-bold text-[#201e1d]">{q.cambridge_source_ref}</span>}
          {q.topic_name && (
            <span className="px-2 py-0.5 rounded-full bg-[#f0fae1] border border-[#8fa073] text-[#3d472b] text-[11px] font-bold flex items-center gap-1">
              <Tag className="w-3 h-3 text-[#56633f]" />
              {q.topic_name}
            </span>
          )}
          {hasDiag && (
            <span className="px-2 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d]/30 text-[#8c491a] text-[11px] font-bold flex items-center gap-1 print:hidden">
              <ImageIcon className="w-3 h-3" />
              Diagram
            </span>
          )}
          {q.page_number ? <span className="font-mono ml-auto">p.{q.page_number}</span> : null}
        </div>

        {/* Stem */}
        <div className="prose prose-sm max-w-none text-[#201e1d] font-medium leading-relaxed overflow-x-auto">
          <RichMarkdown content={sanitizedStem || '_No question stem content provided._'} variant="neobrutalist" />
        </div>

        {/* Diagram */}
        {hasDiag && (
          <div className="p-2 rounded-xl border-2 border-[#201e1d]/80 bg-white flex flex-col items-center gap-1.5 print:border-black">
            {diagramUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={diagramUrl}
                  alt={q.diagram?.alt_description || `Cambridge Exam Diagram for Question ${q.question_number}`}
                  className="max-h-48 max-w-full w-auto object-contain cursor-zoom-in"
                  onClick={zoom}
                />
                <button
                  type="button"
                  onClick={zoom}
                  className="px-2 py-0.5 rounded-lg bg-[#f9f4ed] border border-[#201e1d] text-[11px] font-bold text-[#201e1d] hover:bg-[#ffe1d0] flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                >
                  <ZoomIn className="w-3 h-3" />
                  Zoom
                </button>
              </>
            ) : (
              <div className="py-3 text-center text-xs text-[#645c50] font-bold flex flex-col items-center gap-1">
                <ImageIcon className="w-5 h-5 text-[#82796a]" />
                <span>Diagram referenced in official Cambridge Question Paper</span>
                {q.diagram?.bounding_box && (
                  <span className="font-mono text-[10px] text-[#82796a]">
                    Page {q.diagram.bounding_box.page_number} [{q.diagram.bounding_box.xmin},{' '}
                    {q.diagram.bounding_box.ymin}, {q.diagram.bounding_box.xmax}, {q.diagram.bounding_box.ymax}]
                  </span>
                )}
              </div>
            )}
            {q.diagram?.alt_description && (
              <p className="text-[11px] text-[#645c50] italic text-center max-w-lg">{q.diagram.alt_description}</p>
            )}
          </div>
        )}

        {/* Options */}
        <div className="flex flex-col gap-1.5">
          {(q.options || []).map((opt) => {
            const isCorrect = showAnswers && Boolean(opt.is_correct);
            const sanitizedOpt = sanitizeKaTeX(opt.content_markdown || '');
            return (
              <div
                key={opt.label}
                className={`px-2.5 py-2 rounded-xl border-2 flex items-start gap-2.5 ${
                  isCorrect
                    ? 'bg-[#f0fae1] border-[#728157]'
                    : 'bg-white border-[#201e1d]/20'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-heading font-black text-xs shrink-0 ${
                    isCorrect
                      ? 'bg-[#728157] text-[#f9f4ed]'
                      : 'bg-[#eee7db] text-[#201e1d] border border-[#201e1d]/20'
                  }`}
                >
                  {opt.label}
                </span>
                <div className="flex-1 min-w-0 overflow-x-auto prose prose-sm max-w-none text-sm font-medium leading-relaxed">
                  <RichMarkdown content={sanitizedOpt || '_Empty option_'} variant="plain" />
                </div>
                {isCorrect && (
                  <Check className="w-4 h-4 text-[#3d472b] shrink-0 mt-1" aria-label="Correct answer" />
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation disclosure */}
        <div className="rounded-xl border-2 border-[#201e1d]/80 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => onToggleExplanation(q.question_number)}
            aria-expanded={isExplanationOpen}
            className="w-full px-3 py-2 bg-[#eee7db] hover:bg-[#e4dac9] transition-colors flex items-center justify-between text-xs font-heading font-black text-[#201e1d] cursor-pointer print:hidden"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#8c491a]" />
              Explanation
            </span>
            {isExplanationOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div
            className={`p-3 border-t-2 border-[#201e1d]/80 space-y-3 ${
              isExplanationOpen ? 'block' : 'hidden print:block'
            }`}
          >
            {q.distractor_analysis && Object.keys(q.distractor_analysis).length > 0 && (
              <div className="space-y-2 pb-3 border-b border-[#201e1d]/15">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] block">
                  Option-by-option breakdown
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(q.distractor_analysis).map(([optKey, text]) => {
                    const isCorrect = Boolean(q.options?.find((o) => o.label === optKey && o.is_correct));
                    const highlight = showAnswers && isCorrect;
                    return (
                      <div
                        key={optKey}
                        className={`p-2.5 rounded-xl border text-xs leading-relaxed min-w-0 ${
                          highlight
                            ? 'bg-[#f0fae1] border-[#8fa073] text-[#272e1b]'
                            : 'bg-[#fff9f2] border-[#e2d5c3] text-[#474238]'
                        }`}
                      >
                        <span className="font-heading font-black text-[#201e1d] block mb-0.5">
                          Option {optKey}
                          {showAnswers ? (isCorrect ? ' (Correct)' : ' (Incorrect)') : ''}
                        </span>
                        <div className="overflow-x-auto prose prose-sm max-w-none text-xs">
                          <RichMarkdown content={sanitizeKaTeX(String(text ?? ''))} variant="plain" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="prose prose-sm max-w-none text-[#201e1d] leading-relaxed overflow-x-auto">
              <RichMarkdown
                content={sanitizeKaTeX(q.explanation_markdown || '_No official explanation provided._')}
                variant="neobrutalist"
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export const PaperQuestionCard = React.memo(PaperQuestionCardImpl);
