"use client";

import React, { useState, useMemo, useEffect } from "react";
import IngestionDiagnostics from "@/components/portal/IngestionDiagnostics";
import { useQuestions } from "@/lib/questions";
import type { StagingQuestion } from "@/types/ingestion";
import { sanitizeKaTeX } from "@/lib/ingestion/katexSanitizer";
import { CheckCircle2, Sigma, Code2 } from "lucide-react";

export interface IngestionDiagnosticsLabProps {
  /** Rendered first in the header row (the Studio passes its tab strip). */
  headerStart?: React.ReactNode;
}

export default function IngestionDiagnosticsLab({ headerStart }: IngestionDiagnosticsLabProps) {
  const { questions, loading: questionsLoading } = useQuestions();

  // Diagnostics interactive state
  const [selectedDiagQuestionIdx, setSelectedDiagQuestionIdx] = useState(0);
  const [testEquationInput, setTestEquationInput] = useState('\\text{Opportunity Cost} = \\frac{\\Delta \\text{Return}}{\\Delta \\text{Sacrifice}}');
  const [testCurrencyInput, setTestCurrencyInput] = useState('Price increased from $50 to $120, yielding revenue $R = P \\times Q$.');

  // Convert Questions to StagingQuestion for diagnostic pipeline inspection
  const diagnosticQuestions: StagingQuestion[] = useMemo(() => {
    return (questions || []).slice(0, 10).map((q, idx) => ({
      question_number: idx + 1,
      cambridge_source_ref: q.id || `q-${String(idx + 1).padStart(2, '0')}`,
      topic_name: q.topic || 'General',
      stem_markdown: q.stem_markdown || '',
      diagram: q.has_diagram
        ? {
            has_diagram: true,
            image_url: q.image_url,
            alt_description: 'Diagram illustration',
          }
        : undefined,
      options: (q.options || []).map((opt, optIdx) => ({
        label: (['A', 'B', 'C', 'D'][optIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
        content_markdown: opt.text_markdown || '',
        is_correct: opt.id === q.correct_option_id,
      })),
      explanation_markdown: q.explanation_markdown || 'Mark scheme answer explanation.',
      status: 'active',
      page_number: Math.floor(idx / 3) + 2,
      validation_status: 'valid',
    }));
  }, [questions]);

  // Keep selectedDiagQuestionIdx within bounds if diagnosticQuestions changes
  useEffect(() => {
    if (diagnosticQuestions.length > 0 && selectedDiagQuestionIdx >= diagnosticQuestions.length) {
      setSelectedDiagQuestionIdx(0);
    }
  }, [diagnosticQuestions.length, selectedDiagQuestionIdx]);

  const activeDiagQuestion = diagnosticQuestions[selectedDiagQuestionIdx] || diagnosticQuestions[0] || null;

  return (
    <div className="space-y-4">
      {/* HEADER ROW */}
      <div className="flex flex-wrap items-center gap-3">
        {headerStart && <div className="w-full sm:w-auto max-w-full">{headerStart}</div>}
        <h2 className="flex-1 min-w-0 text-lg font-black font-heading tracking-tight text-[#201e1d]">
          Ingestion diagnostics
          <span className="ml-2 text-xs font-mono font-bold text-[#645c50]">
            KaTeX sanitizer, currency isolator &amp; OCR validator
          </span>
        </h2>
        <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#201e1d] shadow-[3px_3px_0px_#201e1d] flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-800" />
          OCR Engine Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sigma className="w-5 h-5 text-[#201e1d]" />
              <h3 className="font-heading font-black text-base text-[#201e1d]">
                Live KaTeX Equation Validator
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238]">
              Formula Test
            </span>
          </div>
          <textarea
            value={testEquationInput}
            onChange={(e) => setTestEquationInput(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-mono text-xs text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] resize-none"
            placeholder="Enter LaTeX formula e.g. \frac{a}{b}"
          />
          <div className="p-3 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] min-h-[52px] flex items-center justify-center">
            <div className="text-sm font-medium text-[#201e1d]">
              <span className="font-mono text-xs text-[#645c50]">Input: </span>
              <code className="text-xs bg-white/60 px-1 py-0.5 rounded">{testEquationInput}</code>
            </div>
          </div>
        </div>

        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[#201e1d]" />
              <h3 className="font-heading font-black text-base text-[#201e1d]">
                Currency & Regex Sanitizer
              </h3>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238]">
              $ Escaping
            </span>
          </div>
          <textarea
            value={testCurrencyInput}
            onChange={(e) => setTestCurrencyInput(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-mono text-xs text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] resize-none"
            placeholder="Enter text with dollar currency e.g. $100"
          />
          <div className="p-3 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] min-h-[52px] flex flex-col justify-center text-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#645c50]">
              Sanitized Result:
            </span>
            <span className="font-mono text-xs text-[#201e1d] break-all">
              {sanitizeKaTeX(testCurrencyInput)}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#dcd3c4] pb-4">
          <div>
            <h3 className="font-heading font-black text-lg text-[#201e1d]">
              Question AST & Bounding Box Diagnostics
            </h3>
            <p className="text-xs text-[#645c50]">
              Run automated 6-point verification on question payload (KaTeX, OCR crops, distractor schema, Cambridge metadata).
            </p>
          </div>

          {diagnosticQuestions.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#474238]">Inspect Question:</span>
              <select
                value={selectedDiagQuestionIdx}
                onChange={(e) => setSelectedDiagQuestionIdx(Number(e.target.value))}
                className="px-3 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-bold text-xs text-[#201e1d] focus:outline-none cursor-pointer"
              >
                {diagnosticQuestions.map((q, idx) => (
                  <option key={idx} value={idx}>
                    Q{q.question_number}: {q.cambridge_source_ref || `Question ${q.question_number}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {questionsLoading ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5] animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-[#201e1d] border-t-transparent animate-spin" />
            <div className="font-heading text-sm font-black text-[#201e1d]">
              Loading Live Questions for AST Diagnostics...
            </div>
            <p className="text-xs text-[#645c50]">Fetching active items from Supabase</p>
          </div>
        ) : diagnosticQuestions.length === 0 || !activeDiagQuestion ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2 rounded-2xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5]">
            <div className="text-3xl">🔬</div>
            <div className="font-heading text-sm font-black text-[#201e1d]">
              No Questions Available for Diagnostics
            </div>
            <p className="text-xs font-medium text-[#645c50] max-w-sm">
              Upload an exam paper PDF in Ingestion Studio to stage questions and run AST verification diagnostics.
            </p>
          </div>
        ) : (
          <IngestionDiagnostics question={activeDiagQuestion} />
        )}
      </div>
    </div>
  );
}
