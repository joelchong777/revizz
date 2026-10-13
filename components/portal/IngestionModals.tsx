"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Download,
  Upload,
  Database,
  FileCode,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings2,
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Code2,
} from "lucide-react";
import type { StagingPaper, StagingSyllabusTopic } from "@/types/ingestion";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface IngestionModalsProps {
  paper: StagingPaper | null;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onSaveSettings: (updatedPaperMeta: Partial<StagingPaper>) => void;
  isPayloadOpen: boolean;
  onClosePayload: () => void;
  onUploadJson: (file: File) => void;
  onPasteJson: (jsonString: string) => void;
}

export interface IngestionSettingsModalProps {
  paper: StagingPaper | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedPaperMeta: Partial<StagingPaper>) => void;
}

export interface IngestionPayloadModalProps {
  paper: StagingPaper | null;
  isOpen: boolean;
  onClose: () => void;
  onUploadJson: (file: File) => void;
  onPasteJson: (jsonString: string) => void;
}

// ============================================================================
// SQL Generator Utility
// ============================================================================

/**
 * Generates an idempotent, transacted PostgreSQL upsert script for a StagingPaper.
 * Uses DO $$ blocks, dollar-quotes for multi-line markdown/LaTeX safety, and ON CONFLICT.
 */
export function generatePostgresUpsertSql(paper: StagingPaper | null): string {
  if (!paper) {
    return `-- No paper is currently loaded.\n-- Upload a JSON file or load a preset to generate the PostgreSQL batch script.`;
  }

  const subjectCode = paper.subject?.code?.trim() || "0455";
  const subjectName = paper.subject?.name?.trim() || "Economics";
  const subjectIcon = paper.subject?.icon?.trim() || "📈";

  const series = paper.paper?.series?.trim().toLowerCase() || "s";
  const paperCode = paper.paper?.paper_code?.trim() || "12";
  const year = Number(paper.paper?.year) || 2024;

  const topics = paper.syllabus_topics || [];
  const questions = paper.questions || [];

  const esc = (str: string | undefined | null) => (str ? str.replace(/'/g, "''") : "");

  // 1. Topics upsert values
  const allTopicNames = new Set<string>();
  topics.forEach((t) => allTopicNames.add(t.name.trim()));
  questions.forEach((q) => {
    if (q.topic_name?.trim()) allTopicNames.add(q.topic_name.trim());
  });

  const topicRows = Array.from(allTopicNames).map((name, idx) => {
    const existing = topics.find((t) => t.name.trim() === name);
    const orderIndex = existing?.order_index ?? idx + 1;
    return `    ('${esc(name)}', ${orderIndex})`;
  });

  const topicsSql =
    topicRows.length > 0
      ? `INSERT INTO public.topics (subject_id, name, order_index)
SELECT s.id, t.name, t.order_index
FROM public.subjects s, (VALUES
${topicRows.join(",\n")}
) AS t(name, order_index)
WHERE s.code = '${esc(subjectCode)}'
ON CONFLICT (subject_id, name)
DO UPDATE SET order_index = EXCLUDED.order_index;`
      : `-- No topics defined.`;

  // 2. Questions SQL loop
  const questionsSqlList = questions.map((q, idx) => {
    const qNum = q.question_number || idx + 1;
    const stem = q.stem_markdown || "";
    const explanation = q.explanation_markdown || "";
    const topicName = q.topic_name?.trim() || "General";
    const citation = q.cambridge_source_ref || `${subjectCode}/${series}${year} Q${qNum}`;

    const diagObj = {
      has_diagram: Boolean(q.diagram?.has_diagram),
      image_url: q.diagram?.image_url || null,
      storage_path: q.diagram?.storage_path || null,
      alt_description: q.diagram?.alt_description || null,
    };
    const diagJson = JSON.stringify(diagObj).replace(/'/g, "''");

    const optArray = (q.options || []).map((o) => ({
      label: o.label,
      content_markdown: o.content_markdown || "",
      is_correct: Boolean(o.is_correct),
    }));
    const optJson = JSON.stringify(optArray).replace(/'/g, "''");

    return `  -- Question ${qNum}
  INSERT INTO public.questions (
    paper_id,
    topic_id,
    question_number,
    cambridge_source_ref,
    stem_markdown,
    options,
    explanation_markdown,
    diagram,
    status
  )
  SELECT
    p.id,
    t.id,
    ${qNum},
    '${esc(citation)}',
    $stem_${qNum}$${stem}$stem_${qNum}$,
    '${optJson}'::jsonb,
    $exp_${qNum}$${explanation}$exp_${qNum}$,
    '${diagJson}'::jsonb,
    'active'
  FROM public.papers p
  JOIN public.subjects s ON s.id = p.subject_id
  LEFT JOIN public.topics t ON t.subject_id = s.id AND t.name = '${esc(topicName)}'
  WHERE s.code = '${esc(subjectCode)}'
    AND p.year = ${year}
    AND p.series = '${esc(series)}'
    AND p.paper_code = '${esc(paperCode)}'
  ON CONFLICT (paper_id, question_number)
  DO UPDATE SET
    topic_id = EXCLUDED.topic_id,
    cambridge_source_ref = EXCLUDED.cambridge_source_ref,
    stem_markdown = EXCLUDED.stem_markdown,
    options = EXCLUDED.options,
    explanation_markdown = EXCLUDED.explanation_markdown,
    diagram = EXCLUDED.diagram,
    status = EXCLUDED.status,
    updated_at = NOW();`;
  });

  return `-- ============================================================================
-- Revizz Ingestion Studio - Automated Database Upsert Batch
-- Target: Supabase Postgres
-- Subject: ${subjectCode} (${subjectName})
-- Paper: ${series.toUpperCase()}${year} Paper ${paperCode}
-- Total Staged Questions: ${questions.length}
-- ============================================================================

BEGIN;

-- 1. Ensure Subject exists
INSERT INTO public.subjects (code, name, icon)
VALUES ('${esc(subjectCode)}', '${esc(subjectName)}', '${esc(subjectIcon)}')
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- 2. Ensure Paper exists
INSERT INTO public.papers (subject_id, year, series, paper_code)
SELECT id, ${year}, '${esc(series)}', '${esc(paperCode)}'
FROM public.subjects
WHERE code = '${esc(subjectCode)}'
ON CONFLICT (subject_id, year, series, paper_code)
DO NOTHING;

-- 3. Upsert Syllabus Topics
${topicsSql}

-- 4. Upsert Questions Batch (${questions.length} questions)
${questionsSqlList.join("\n\n")}

COMMIT;
`;
}

/**
 * Downloads a string as a browser file.
 */
function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// Internal Code Viewer Subcomponent
// ============================================================================

function CodeViewer({ code, language }: { code: string; language: "sql" | "json" }) {
  const lines = useMemo(() => code.split("\n"), [code]);

  const renderHighlightedLine = (line: string, lineIndex: number) => {
    if (language === "sql") {
      if (line.trim().startsWith("--")) {
        return <span className="text-[#aebf92] italic">{line}</span>;
      }
      const keywords =
        /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|ON|CONFLICT|DO|UPDATE|SET|LEFT|JOIN|BEGIN|COMMIT|AND|OR|EXCLUDED|NOW|jsonb)\b/g;
      const parts = line.split(keywords);
      return (
        <span>
          {parts.map((part, i) =>
            keywords.test(part) ? (
              <span key={i} className="text-[#facc15] font-bold">
                {part}
              </span>
            ) : (
              <span key={i} className="text-[#f9f4ed]">
                {part}
              </span>
            )
          )}
        </span>
      );
    }

    if (line.trim().startsWith('"') && line.includes(":")) {
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx);
      const val = line.slice(colonIdx);
      return (
        <span>
          <span className="text-[#facc15]">{key}</span>
          <span className="text-[#f9f4ed]">{val}</span>
        </span>
      );
    }
    return <span className="text-[#f9f4ed]">{line}</span>;
  };

  return (
    <div className="flex-1 w-full overflow-auto bg-slate-900 rounded-2xl border-2 border-b-4 border-slate-800 font-mono text-xs sm:text-sm p-4 text-[#ffe1d0] shadow-chunky select-text">
      <div className="min-w-max flex flex-col">
        {lines.map((line, idx) => (
          <div key={idx} className="flex hover:bg-slate-800 px-1 py-0.5 rounded transition-colors">
            <span className="w-10 select-none text-slate-500 text-right pr-4 font-mono text-xs opacity-60 flex-shrink-0">
              {idx + 1}
            </span>
            <span className="whitespace-pre font-mono flex-1">{renderHighlightedLine(line, idx)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Component: IngestionSettingsModal
// ============================================================================

export function IngestionSettingsModal({
  paper,
  isOpen,
  onClose,
  onSave,
}: IngestionSettingsModalProps) {
  const [subjectCode, setSubjectCode] = useState("0455");
  const [subjectName, setSubjectName] = useState("Economics");
  const [subjectIcon, setSubjectIcon] = useState("📈");

  const [series, setSeries] = useState("s");
  const [year, setYear] = useState<number | string>(2024);
  const [paperCode, setPaperCode] = useState("12");

  const [topics, setTopics] = useState<StagingSyllabusTopic[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Sync state whenever modal opens or paper changes
  useEffect(() => {
    if (isOpen && paper) {
      setSubjectCode(paper.subject?.code || "0455");
      setSubjectName(paper.subject?.name || "Economics");
      setSubjectIcon(paper.subject?.icon || "📈");

      setSeries(paper.paper?.series || "s");
      setYear(paper.paper?.year ?? 2024);
      setPaperCode(paper.paper?.paper_code || "12");

      setTopics(
        paper.syllabus_topics && paper.syllabus_topics.length > 0
          ? [...paper.syllabus_topics]
          : []
      );
      setFormError(null);
    }
  }, [isOpen, paper]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Topic handlers
  const handleAddTopic = () => {
    const trimmed = newTopicName.trim();
    if (!trimmed) return;
    if (topics.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setFormError(`Topic "${trimmed}" already exists.`);
      return;
    }
    const updated = [
      ...topics,
      { name: trimmed, order_index: topics.length + 1 },
    ];
    setTopics(updated);
    setNewTopicName("");
    setFormError(null);
  };

  const handleRemoveTopic = (index: number) => {
    const filtered = topics.filter((_, idx) => idx !== index);
    const reordered = filtered.map((t, idx) => ({ ...t, order_index: idx + 1 }));
    setTopics(reordered);
    setFormError(null);
  };

  const handleMoveTopic = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    const updated = [...topics];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((t, idx) => ({ ...t, order_index: idx + 1 }));
    setTopics(reordered);
  };

  const handleTopicNameChange = (index: number, val: string) => {
    const updated = [...topics];
    updated[index] = { ...updated[index], name: val };
    setTopics(updated);
  };

  const handleSave = () => {
    if (!subjectCode.trim()) {
      setFormError("Subject code cannot be blank (e.g. 0455).");
      return;
    }
    if (!subjectName.trim()) {
      setFormError("Subject name cannot be blank (e.g. Economics).");
      return;
    }
    if (!paperCode.trim()) {
      setFormError("Paper code cannot be blank (e.g. 12).");
      return;
    }
    const parsedYear = Number(year);
    if (!parsedYear || isNaN(parsedYear) || parsedYear < 1990 || parsedYear > 2100) {
      setFormError("Please enter a valid 4-digit year (e.g. 2024).");
      return;
    }

    const payload: Partial<StagingPaper> = {
      subject: {
        code: subjectCode.trim(),
        name: subjectName.trim(),
        icon: subjectIcon.trim() || "📈",
      },
      paper: {
        series: series.trim().toLowerCase(),
        paper_code: paperCode.trim(),
        year: parsedYear,
      },
      syllabus_topics: topics.map((t, idx) => ({
        name: t.name.trim(),
        order_index: idx + 1,
      })),
    };

    onSave(payload);
    onClose();
  };

  const emojiPresets = ["📈", "🧪", "🧬", "🔢", "🏛️", "🌍", "💻", "🎨", "📚"];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div className="bg-[#f9f4ed] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky p-6 w-full max-w-2xl max-h-[92vh] flex flex-col gap-6 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-yellow border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky">
              <Settings2 className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="font-heading text-2xl text-slate-800">
                Paper &amp; Syllabus Settings
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 font-bold">
                Configure Cambridge metadata, subject identifiers, and syllabus structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-2 rounded-xl bg-white border-2 border-b-4 border-slate-800 shadow-chunky hover:bg-neutral-100 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer text-slate-800"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-[#fee2e2] border-2 border-slate-800 rounded-xl flex items-center gap-2 text-xs sm:text-sm text-rose-800 font-black">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
          {/* Section: Subject Metadata */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-lg text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-yellow border border-slate-800" />
              Subject Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  placeholder="0455"
                  className="w-full bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Economics"
                  className="w-full bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Subject Icon
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={subjectIcon}
                    onChange={(e) => setSubjectIcon(e.target.value)}
                    placeholder="📈"
                    className="w-16 text-center text-lg bg-white border-2 border-slate-800 rounded-xl px-2 py-1.5 font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  />
                  <div className="flex gap-1 flex-wrap flex-1">
                    {emojiPresets.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setSubjectIcon(emoji)}
                        className="px-2 py-1 text-sm bg-white border-2 border-b-3 border-slate-800 rounded-lg shadow-xs hover:bg-neutral-100 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Paper Parameters */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-lg text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-green border border-slate-800" />
              Paper Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Series
                </label>
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                >
                  <option value="s">s (May / June)</option>
                  <option value="w">w (Oct / Nov)</option>
                  <option value="m">m (Feb / March)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2024"
                  min="2000"
                  max="2035"
                  className="w-full bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-600 uppercase mb-1">
                  Paper Code
                </label>
                <input
                  type="text"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  placeholder="12"
                  className="w-full bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                />
              </div>
            </div>
          </div>

          {/* Section: Syllabus Topics Manager */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-indigo border border-slate-800" />
                Syllabus Topics Manager ({topics.length})
              </h3>
              <span className="text-xs text-slate-600 font-bold">
                Order determines taxonomy in game
              </span>
            </div>

            {/* Add Topic Input Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTopic();
                  }
                }}
                placeholder="Enter new syllabus topic name..."
                className="flex-1 bg-white border-2 border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 bg-brand-yellow hover:bg-[#fde047] border-2 border-b-4 border-slate-800 rounded-xl font-heading font-black text-xs sm:text-sm text-slate-900 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                Add Topic
              </button>
            </div>

            {/* Topics List */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {topics.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-white/60 text-sm text-slate-600 font-bold">
                  No syllabus topics registered yet. Add your first syllabus unit above.
                </div>
              ) : (
                topics.map((topic, idx) => (
                  <div
                    key={`${topic.name}-${idx}`}
                    className="flex items-center gap-2 p-2.5 bg-white border-2 border-b-3 border-slate-800 rounded-xl shadow-xs"
                  >
                    <span className="w-7 h-7 flex items-center justify-center bg-brand-yellow border-2 border-slate-800 rounded-lg text-xs font-black text-slate-900 flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={topic.name}
                      onChange={(e) => handleTopicNameChange(idx, e.target.value)}
                      className="flex-1 bg-transparent border-0 text-sm font-bold text-slate-800 focus:outline-none focus:bg-[#f9f4ed] px-2 py-1 rounded"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveTopic(idx, "up")}
                        disabled={idx === 0}
                        aria-label="Move topic up"
                        className="p-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 border border-slate-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTopic(idx, "down")}
                        disabled={idx === topics.length - 1}
                        aria-label="Move topic down"
                        className="p-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-30 border border-slate-800 transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(idx)}
                        aria-label="Remove topic"
                        className="p-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 border border-slate-800 transition-all cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex justify-end items-center gap-3 pt-3 border-t-2 border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-neutral-100 border-2 border-b-4 border-slate-800 rounded-xl font-heading font-black text-xs sm:text-sm text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-brand-green hover:bg-emerald-600 text-white border-2 border-b-4 border-slate-800 rounded-xl font-heading font-black text-xs sm:text-sm shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Component: IngestionPayloadModal
// ============================================================================

export function IngestionPayloadModal({
  paper,
  isOpen,
  onClose,
  onUploadJson,
  onPasteJson,
}: IngestionPayloadModalProps) {
  const [activeTab, setActiveTab] = useState<"sql" | "json">("sql");
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate SQL and formatted JSON strings
  const sqlContent = useMemo(() => generatePostgresUpsertSql(paper), [paper]);
  const jsonContent = useMemo(() => (paper ? JSON.stringify(paper, null, 2) : "{}"), [paper]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentContent = activeTab === "sql" ? sqlContent : jsonContent;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const handleDownload = () => {
    const filenamePrefix = paper
      ? `${paper.subject?.code || "paper"}_${paper.paper?.series || "s"}${paper.paper?.year || "24"}_${paper.paper?.paper_code || "12"}`
      : "paper";

    if (activeTab === "sql") {
      downloadTextFile(sqlContent, `${filenamePrefix}.sql`, "text/plain;charset=utf-8");
    } else {
      downloadTextFile(jsonContent, `${filenamePrefix}.json`, "application/json;charset=utf-8");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJson(file);
      e.target.value = "";
      onClose();
    }
  };

  const handleApplyPastedJson = () => {
    const trimmed = pastedJson.trim();
    if (!trimmed) {
      setPasteError("Please paste valid JSON text into the area.");
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      const targetPaper = (parsed?.paper && Array.isArray(parsed.paper.questions))
        ? parsed.paper
        : (Array.isArray(parsed?.questions) ? parsed : (Array.isArray(parsed) ? parsed : (parsed?.paper || parsed)));
      if (!targetPaper || (typeof targetPaper !== "object" && !Array.isArray(targetPaper))) {
        setPasteError("JSON must contain a staging paper object or questions array.");
        return;
      }
      onPasteJson(trimmed);
      setIsPasteMode(false);
      setPastedJson("");
      setPasteError(null);
      onClose();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPasteError(`Invalid JSON syntax: ${errMsg}`);
    }
  };

  const handleFormatPastedJson = () => {
    try {
      const parsed = JSON.parse(pastedJson);
      setPastedJson(JSON.stringify(parsed, null, 2));
      setPasteError(null);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setPasteError(`Cannot format: ${errMsg}`);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="payload-dialog-title"
    >
      <div className="bg-[#f9f4ed] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky p-6 w-full max-w-4xl h-[92vh] flex flex-col gap-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-yellow border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky">
              <Database className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="payload-dialog-title" className="font-heading text-2xl text-slate-800">
                  Raw Payloads &amp; SQL Inspector
                </h2>
                {paper && (
                  <span className="px-2.5 py-0.5 bg-brand-yellow border border-slate-800 rounded-full text-xs font-black text-slate-900 shadow-xs">
                    {paper.subject?.code} {paper.paper?.series}{paper.paper?.year}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-600 font-bold">
                Inspect generated idempotent transacted PostgreSQL queries or view and paste raw JSON
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close payload dialog"
            className="p-2 rounded-xl bg-white border-2 border-b-4 border-slate-800 shadow-chunky hover:bg-neutral-100 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer text-slate-800"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Tab & Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky">
          {/* Main Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("sql");
                setIsPasteMode(false);
              }}
              className={`px-4 py-2 border-2 border-b-4 border-slate-800 rounded-xl font-heading font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "sql"
                  ? "bg-brand-yellow text-slate-900 shadow-chunky"
                  : "bg-white text-slate-800 hover:bg-neutral-100"
              }`}
            >
              <Database className="w-4 h-4" />
              Batch SQL
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={`px-4 py-2 border-2 border-b-4 border-slate-800 rounded-xl font-heading font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "json"
                  ? "bg-brand-yellow text-slate-900 shadow-chunky"
                  : "bg-white text-slate-800 hover:bg-neutral-100"
              }`}
            >
              <FileCode className="w-4 h-4" />
              Raw JSON
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {activeTab === "json" && (
              <>
                <button
                  onClick={() => setIsPasteMode(!isPasteMode)}
                  className={`px-3 py-1.5 border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isPasteMode
                      ? "bg-brand-green text-white shadow-chunky"
                      : "bg-[#f5ead8] text-slate-800 hover:bg-neutral-200"
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  {isPasteMode ? "View JSON" : "Paste Raw JSON"}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white hover:bg-neutral-100 border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload JSON
                </button>
                <input
                  type="file"
                  accept=".json,application/json,text/json"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </>
            )}

            {!isPasteMode && (
              <>
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-brand-yellow hover:bg-[#fde047] border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black text-slate-900 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copyFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-700 stroke-[3]" />
                      <span className="text-green-800">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy to Clipboard</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownload}
                  className="px-3 py-1.5 bg-brand-green hover:bg-emerald-600 text-white border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download {activeTab === "sql" ? "paper.sql" : "paper.json"}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Viewer / Paste Sub-View */}
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === "json" && isPasteMode ? (
            <div className="flex-1 flex flex-col gap-3 bg-[#f5ead8] p-4 rounded-2xl border-2 border-b-4 border-slate-800 shadow-chunky">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-slate-800" />
                  <span className="font-heading text-base text-slate-800">
                    Paste Staging Paper JSON Directly
                  </span>
                </div>
                <button
                  onClick={handleFormatPastedJson}
                  className="text-xs font-black px-2.5 py-1 bg-white border-2 border-b-3 border-slate-800 rounded-lg hover:bg-neutral-100 transition-all cursor-pointer shadow-xs active:translate-y-0.5"
                >
                  Prettify
                </button>
              </div>

              {pasteError && (
                <div className="p-2.5 bg-rose-100 border-2 border-slate-800 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{pasteError}</span>
                </div>
              )}

              <textarea
                value={pastedJson}
                onChange={(e) => {
                  setPastedJson(e.target.value);
                  setPasteError(null);
                }}
                placeholder={`{\n  "subject": { "code": "0455", "name": "Economics", "icon": "📈" },\n  "paper": { "series": "s", "year": 2024, "paper_code": "12" },\n  "syllabus_topics": [],\n  "questions": []\n}`}
                className="flex-1 w-full p-4 bg-slate-900 text-[#ffe1d0] font-mono text-xs sm:text-sm rounded-xl border-2 border-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsPasteMode(false)}
                  className="px-4 py-2 bg-white border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black hover:bg-neutral-100 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyPastedJson}
                  className="px-5 py-2 bg-brand-green hover:bg-emerald-600 text-white border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Validate &amp; Load JSON
                </button>
              </div>
            </div>
          ) : (
            <CodeViewer code={currentContent} language={activeTab} />
          )}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-2 border-t-2 border-slate-800">
          <div className="flex items-center gap-3">
            <span>
              {activeTab === "sql" ? "PostgreSQL Idempotent Batch" : "Cambridge MCQ Staging JSON"}
            </span>
            <span>•</span>
            <span>{currentContent.split("\n").length} lines</span>
            <span>•</span>
            <span>{(new Blob([currentContent]).size / 1024).toFixed(1)} KB</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-neutral-100 border-2 border-b-4 border-slate-800 rounded-xl text-xs font-black text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Combined Root IngestionModals Component
// ============================================================================

export function IngestionModals({
  paper,
  isSettingsOpen,
  onCloseSettings,
  onSaveSettings,
  isPayloadOpen,
  onClosePayload,
  onUploadJson,
  onPasteJson,
}: IngestionModalsProps) {
  return (
    <>
      <IngestionSettingsModal
        paper={paper}
        isOpen={isSettingsOpen}
        onClose={onCloseSettings}
        onSave={onSaveSettings}
      />
      <IngestionPayloadModal
        paper={paper}
        isOpen={isPayloadOpen}
        onClose={onClosePayload}
        onUploadJson={onUploadJson}
        onPasteJson={onPasteJson}
      />
    </>
  );
}

export default IngestionModals;
