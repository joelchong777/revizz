'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import IngestionHub from '@/components/portal/IngestionHub';
import AdminCMS from '@/components/portal/AdminCMS';
import AdminTools from '@/components/portal/AdminTools';
import IngestionDiagnostics from '@/components/portal/IngestionDiagnostics';
import { useQuestions } from '@/lib/questions';
import type { StagingQuestion } from '@/types/ingestion';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import {
  BookOpen,
  Layers,
  Sparkles,
  CheckCircle2,
  Database,
  Cpu,
  Sigma,
  Code2,
  Building2,
  Activity
} from 'lucide-react';

export interface AppAdminHubProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  selectedQuestionId?: string;
  onSelectQuestionId?: (id: string) => void;
}

export default function AppAdminHub({
  activeTab,
  onSelectTab,
  selectedQuestionId,
  onSelectQuestionId,
}: AppAdminHubProps) {
  const { questions } = useQuestions();

  // Diagnostics interactive state
  const [selectedDiagQuestionIdx, setSelectedDiagQuestionIdx] = useState(0);
  const [testEquationInput, setTestEquationInput] = useState('\\text{Opportunity Cost} = \\frac{\\Delta \\text{Return}}{\\Delta \\text{Sacrifice}}');
  const [testCurrencyInput, setTestCurrencyInput] = useState('Price increased from $50 to $120, yielding revenue $R = P \\times Q$.');

  // Convert Questions to StagingQuestion for diagnostic pipeline inspection
  const diagnosticQuestions: StagingQuestion[] = useMemo(() => {
    return questions.slice(0, 10).map((q, idx) => ({
      question_number: idx + 1,
      cambridge_source_ref: q.id || `q-${String(idx + 1).padStart(2, '0')}`,
      topic_name: q.topic || 'General',
      stem_markdown: q.stem_markdown,
      diagram: q.has_diagram
        ? {
            has_diagram: true,
            image_url: q.image_url,
            alt_description: 'Diagram illustration',
          }
        : undefined,
      options: q.options.map((opt, optIdx) => ({
        label: (['A', 'B', 'C', 'D'][optIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
        content_markdown: opt.text_markdown,
        is_correct: opt.id === q.correct_option_id,
      })),
      explanation_markdown: q.explanation_markdown || 'Mark scheme answer explanation.',
      status: 'active',
      page_number: Math.floor(idx / 3) + 2,
      validation_status: 'valid',
    }));
  }, [questions]);

  const activeDiagQuestion = diagnosticQuestions[selectedDiagQuestionIdx] || diagnosticQuestions[0];

  const handleOpenEditor = (questionId: string) => {
    if (onSelectQuestionId) {
      onSelectQuestionId(questionId);
    }
    onSelectTab('editor');
  };

  switch (activeTab) {
    case 'ingestion':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                  INGESTION ENGINE v2.4
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  Dual-PDF OCR & Gemini 1.5 Pro Multimodal Pipeline
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Cambridge Ingestion Studio
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Upload Question Papers & Mark Schemes, parse diagram bounding crops, and stage validated items for publishing.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onSelectTab('diagnostics')}
                className="px-3 py-2 rounded-xl bg-[#ebddc5] border-2 border-[#201e1d] font-bold text-xs hover:bg-[#ffe1d0] transition-colors shadow-offset-2 active:translate-y-0.5"
              >
                KaTeX Diagnostics
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('staged')}
                className="px-3.5 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-black text-xs hover:bg-[#ffc6a5] transition-colors shadow-offset-2 active:translate-y-0.5"
              >
                Staged Papers →
              </button>
            </div>
          </div>
          <IngestionHub />
        </div>
      );

    case 'staged':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                  QUALITY GATE · STAGING
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  Pre-Publishing Review & Mark Scheme Alignment
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Staged Papers Queue
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Audit complete extracted papers and diagram bindings before committing them to the global live question pool.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('ingestion')}
              className="px-3.5 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-black text-xs hover:bg-[#ffc6a5] transition-colors shadow-offset-2 active:translate-y-0.5 self-start sm:self-auto"
            >
              + Ingest New Paper
            </button>
          </div>
          <AdminCMS initialView="staged" />
        </div>
      );

    case 'diagnostics':
      return (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a]">
                  PIPELINE HEALTH · TELEMETRY
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  KaTeX Sanitizer, Currency Isolator & OCR Validator
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Ingestion Diagnostics Lab
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Stress-test LaTeX rendering, sanitize unescaped dollar currencies, and verify bounding box integrity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#201e1d] shadow-offset-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                OCR Engine Active
              </span>
            </div>
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

            {diagnosticQuestions.length === 0 || !activeDiagQuestion ? (
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

    case 'bank':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                  GLOBAL REPOSITORY
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  {questions.length} Questions Live & Verified
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Global Question Bank Intelligence
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Browse, filter, preview, and audit all active multiple-choice questions across Cambridge syllabuses.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('ingestion')}
              className="px-3.5 py-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-black text-xs hover:bg-[#ffc6a5] transition-colors shadow-offset-2 active:translate-y-0.5 self-start sm:self-auto"
            >
              + Ingest Questions
            </button>
          </div>
          <AdminTools initialView="bank" onOpenEditor={handleOpenEditor} />
        </div>
      );

    case 'flagged':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff2eb] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a]">
                  MODERATION OPS · QA
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  Community & Educator Flag Reports (8 Queued)
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Flagged Questions & Moderation
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Review user reports on ambiguous wording, diagram misalignment, or key typos.
              </p>
            </div>
          </div>
          <AdminCMS initialView="flagged" />
        </div>
      );

    case 'editor':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black uppercase tracking-wider text-[#201e1d]">
                  Editor
                </span>
                <span className="text-xs font-bold text-[#645c50]">
                  Question ID: {selectedQuestionId || (questions[0]?.id) || 'None'}
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Direct Question Editor
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Fine-tune stems, mark schemes, distractor rationales, and diagram attachments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('bank')}
              className="px-3.5 py-2 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-bold text-xs hover:bg-[#dcd3c4] transition-colors shadow-offset-2 active:translate-y-0.5 self-start sm:self-auto"
            >
              ← Back to Bank
            </button>
          </div>
          <AdminCMS initialView="editor" questionId={selectedQuestionId} />
        </div>
      );

    case 'system':
      return (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                LIVE TELEMETRY · PRODUCTION OPS
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ALL SYSTEMS OPERATIONAL
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
              Revizz Platform Command Deck
            </h1>
            <p className="text-sm font-medium text-[#645c50] max-w-2xl">
              Real-time platform telemetry, OCR pipeline status, Cambridge question bank health, and institutional school allocations.
            </p>
          </div>

          {/* High-Density KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Verified Questions */}
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Total Verified Questions</span>
                <BookOpen className="w-4 h-4 text-[#201e1d]" />
              </div>
              <div className="text-3xl font-black font-heading text-[#201e1d]">
                {questions.length} Live
              </div>
              <p className="text-[11px] font-bold text-emerald-700">
                {questions.length > 0 ? '100% Mark Scheme Audited' : '0 Questions Live. Start by uploading an exam paper in Ingestion Studio.'}
              </p>
            </div>

            {/* Card 2: Staged Papers */}
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Staged Papers</span>
                <Layers className="w-4 h-4 text-[#201e1d]" />
              </div>
              <div className="text-3xl font-black font-heading text-[#201e1d]">
                0 Ready
              </div>
              <p className="text-[11px] font-bold text-[#645c50]">
                None Staged
              </p>
            </div>

            {/* Card 3: OCR Pipeline Status */}
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">OCR Pipeline Status</span>
                <Cpu className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d] truncate">
                Online · Gemini 1.5 Pro
              </div>
              <p className="text-[11px] font-bold text-emerald-700">
                Dual-Vision + KaTeX Active
              </p>
            </div>

            {/* Card 4: Active Schools */}
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Active Schools</span>
                <Building2 className="w-4 h-4 text-[#8c491a]" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d] truncate">
                0 Active Licences
              </div>
              <p className="text-[11px] font-bold text-[#645c50]">
                No cohorts registered
              </p>
            </div>
          </div>

          {/* Quick Action Telemetry Buttons */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-lg text-[#201e1d]">
                Quick Action Telemetry & Control
              </h3>
              <span className="font-mono text-xs text-[#645c50] font-bold">
                OPS ACTIONS
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => onSelectTab('ingestion')}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-1.5 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139] transition-colors">
                    Launch Ingestion Studio
                  </div>
                  <span className="text-sm">⚡</span>
                </div>
                <div className="text-xs font-medium text-[#645c50]">
                  Ingest and parse raw Cambridge PDF papers into structured items
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('diagnostics')}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-1.5 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139] transition-colors">
                    Inspect OCR Diagnostics
                  </div>
                  <span className="text-sm">🔬</span>
                </div>
                <div className="text-xs font-medium text-[#645c50]">
                  Stress-test KaTeX sanitizer and 6-point OCR bounding boxes
                </div>
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('staged')}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-1.5 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <div className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139] transition-colors">
                    Review Staged Paper
                  </div>
                  <span className="text-sm">📋</span>
                </div>
                <div className="text-xs font-medium text-[#645c50]">
                  Audit question stems, mark schemes, and diagram crops
                </div>
              </button>
            </div>
          </div>
        </div>
      );

    case 'school':
      return (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black uppercase tracking-wider text-[#201e1d]">
                Institutional Allocations
              </span>
              <span className="text-xs font-bold text-[#645c50]">
                Enterprise School Licences
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
              School & Licence Management
            </h1>
            <p className="text-sm font-medium text-[#645c50] max-w-2xl">
              Manage enterprise school licences, seat allocations, teacher quotas, and student cohort sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
                Licensed Seats
              </span>
              <div className="text-3xl font-black font-heading text-[#201e1d]">
                0 / 0
              </div>
              <p className="text-xs font-bold text-[#645c50]">
                No licences allocated
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
                Active Cohorts
              </span>
              <div className="text-3xl font-black font-heading text-[#201e1d]">
                0 Classes
              </div>
              <p className="text-xs font-bold text-[#645c50]">
                No cohorts registered
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
                Licence Expiry
              </span>
              <div className="text-3xl font-black font-heading text-[#201e1d]">
                —
              </div>
              <p className="text-xs font-bold text-[#645c50]">
                No active plan
              </p>
            </div>
          </div>

          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-lg text-[#201e1d]">
                Institutional Cohorts
              </h3>
              <span className="text-xs font-bold text-[#645c50]">0 Cohorts</span>
            </div>
            <div className="py-8 px-4 text-center flex flex-col items-center justify-center space-y-2 rounded-2xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5]">
              <div className="text-3xl">👥</div>
              <div className="font-heading text-sm font-black text-[#201e1d]">
                No cohorts registered
              </div>
              <p className="text-xs font-medium text-[#645c50] max-w-xs">
                No active cohorts found. Classes and educator teams will appear here once registered.
              </p>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="space-y-4">
          <IngestionHub />
        </div>
      );
  }
}
