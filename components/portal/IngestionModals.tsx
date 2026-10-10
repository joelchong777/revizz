"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
ON CONFLICT (subject_id, name) DO UPDATE SET
  order_index = EXCLUDED.order_index;`
      : `-- No syllabus topics defined`;

  // 2. Questions and Options in a single idempotent DO $$ block
  const questionBlocks = questions.map((q) => {
    const qNum = q.question_number;
    const ref = q.cambridge_source_ref || `${subjectCode}/${paperCode}/${series.toUpperCase()}/${String(year).slice(-2)} Q${qNum}`;
    const active = q.status !== "withdrawn";
    const imageUrl = q.diagram?.has_diagram && q.diagram.image_url ? `'${esc(q.diagram.image_url)}'` : "NULL";

    const optInserts = (q.options || []).map((opt) => {
      return `  INSERT INTO public.question_options (question_id, label, content_markdown, is_correct)
  VALUES (v_q_id, '${esc(opt.label)}', $q${qNum}_opt_${opt.label}$${opt.content_markdown || ""}$q${qNum}_opt_${opt.label}$, ${opt.is_correct})
  ON CONFLICT (question_id, label) DO UPDATE SET
    content_markdown = EXCLUDED.content_markdown,
    is_correct = EXCLUDED.is_correct;`;
    });

    return `  -- -------------------------------------------------------------------------
  -- Question ${qNum}: ${esc(ref)}
  -- -------------------------------------------------------------------------
  SELECT id INTO v_topic_id FROM public.topics
  WHERE subject_id = v_subject_id AND name = '${esc(q.topic_name)}';

  INSERT INTO public.questions (
    subject_id, paper_id, topic_id, question_number, stem_markdown,
    image_url, explanation_markdown, cambridge_source_ref, active
  ) VALUES (
    v_subject_id,
    v_paper_id,
    v_topic_id,
    ${qNum},
    $q${qNum}_stem$${q.stem_markdown || ""}$q${qNum}_stem$,
    ${imageUrl},
    $q${qNum}_exp$${q.explanation_markdown || ""}$q${qNum}_exp$,
    '${esc(ref)}',
    ${active}
  )
  ON CONFLICT (paper_id, question_number) DO UPDATE SET
    subject_id = EXCLUDED.subject_id,
    topic_id = EXCLUDED.topic_id,
    stem_markdown = EXCLUDED.stem_markdown,
    image_url = EXCLUDED.image_url,
    explanation_markdown = EXCLUDED.explanation_markdown,
    cambridge_source_ref = EXCLUDED.cambridge_source_ref,
    active = EXCLUDED.active
  RETURNING id INTO v_q_id;

${optInserts.join("\n")}`;
  });

  return `-- =============================================================================
-- Revizz Ingestion Pipeline Idempotent Upsert Script
-- Subject: ${subjectCode} (${subjectName})
-- Paper: ${series.toUpperCase()}${year} Paper ${paperCode}
-- Total Questions: ${questions.length}
-- Generated at: ${new Date().toISOString()}
-- =============================================================================

BEGIN;

-- 1. Ensure Subject exists
INSERT INTO public.subjects (code, name, icon)
VALUES ('${esc(subjectCode)}', '${esc(subjectName)}', '${esc(subjectIcon)}')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon;

-- 2. Ensure Paper exists
INSERT INTO public.papers (subject_id, series, paper_code, year)
SELECT s.id, '${esc(series)}', '${esc(paperCode)}', ${year}
FROM public.subjects s
WHERE s.code = '${esc(subjectCode)}'
ON CONFLICT (subject_id, series, paper_code, year) DO UPDATE SET
  year = EXCLUDED.year;

-- 3. Ensure Topics exist
${topicsSql}

-- 4. Upsert Questions & Options
DO $$
DECLARE
  v_subject_id uuid;
  v_paper_id uuid;
  v_topic_id uuid;
  v_q_id uuid;
BEGIN
  -- Resolve Parent Identifiers
  SELECT id INTO v_subject_id FROM public.subjects WHERE code = '${esc(subjectCode)}';

  SELECT id INTO v_paper_id FROM public.papers
  WHERE subject_id = v_subject_id
    AND series = '${esc(series)}'
    AND paper_code = '${esc(paperCode)}'
    AND year = ${year};

  IF v_paper_id IS NULL THEN
    RAISE EXCEPTION 'Target paper record not found for subject %, series %, code %, year %',
      '${esc(subjectCode)}', '${esc(series)}', '${esc(paperCode)}', ${year};
  END IF;

${questionBlocks.join("\n\n")}

END $$;

COMMIT;
`;
}

// ============================================================================
// Clipboard & File Download Helpers
// ============================================================================

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
// Monospace Code Viewer Component with Syntax Coloring
// ============================================================================

interface CodeViewerProps {
  code: string;
  language: "sql" | "json";
}

function CodeViewer({ code, language }: CodeViewerProps) {
  const lines = useMemo(() => code.split("\n"), [code]);

  const renderHighlightedLine = (line: string, index: number) => {
    if (language === "sql") {
      // Check for comments
      if (line.trim().startsWith("--")) {
        return (
          <span key={index} className="text-[#82796a] italic">
            {line}
          </span>
        );
      }

      // Check for SQL Keywords
      const sqlKeywordRegex =
        /\b(BEGIN|COMMIT|INSERT INTO|INSERT|INTO|VALUES|SELECT|FROM|WHERE|AND|OR|ON CONFLICT|DO UPDATE SET|DO|RETURNING|DECLARE|END|RAISE EXCEPTION|IF|THEN|uuid|boolean|integer|text|NULL|true|false)\b/g;

      const parts = line.split(sqlKeywordRegex);
      return (
        <span key={index}>
          {parts.map((part, i) => {
            if (sqlKeywordRegex.test(part)) {
              return (
                <span key={i} className="text-[#f6a06b] font-bold">
                  {part}
                </span>
              );
            }
            if (part.includes("$q")) {
              return (
                <span key={i} className="text-[#fb7185] font-semibold">
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    }

    // JSON syntax highlighting
    const jsonKeyRegex = /^(\s*)(".*?")(\s*:)/;
    const keyMatch = line.match(jsonKeyRegex);

    if (keyMatch) {
      const rest = line.slice(keyMatch[0].length);
      return (
        <span key={index}>
          <span>{keyMatch[1]}</span>
          <span className="text-[#f6a06b] font-semibold">{keyMatch[2]}</span>
          <span className="text-[#ffe1d0]">{keyMatch[3]}</span>
          <span className="text-[#ccdbb2]">{rest}</span>
        </span>
      );
    }

    return (
      <span key={index} className="text-[#ffe1d0]">
        {line}
      </span>
    );
  };

  return (
    <div className="flex-1 w-full overflow-auto bg-[#201e1d] rounded-2xl border-2 border-[#201e1d] font-mono text-xs sm:text-sm p-4 text-[#ffe1d0] shadow-inner select-text">
      <div className="min-w-max flex flex-col">
        {lines.map((line, idx) => (
          <div key={idx} className="flex hover:bg-[#2c2927] px-1 py-0.5 rounded transition-colors">
            <span className="w-10 select-none text-[#82796a] text-right pr-4 font-mono text-xs opacity-60 flex-shrink-0">
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
      <div className="bg-[#f9f4ed] border-4 border-[#201e1d] rounded-3xl shadow-offset-6 p-6 w-full max-w-2xl max-h-[92vh] flex flex-col gap-6 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#201e1d]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-2xl shadow-offset-2">
              <Settings2 className="w-6 h-6 text-[#c67139]" />
            </div>
            <div>
              <h2 id="settings-dialog-title" className="font-heading text-2xl text-[#201e1d]">
                Paper & Syllabus Settings
              </h2>
              <p className="text-sm text-[#82796a] font-medium">
                Configure Cambridge metadata, subject identifiers, and syllabus structure
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[#201e1d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {formError && (
          <div className="p-3 bg-[#fecdd3] border-2 border-[#201e1d] rounded-xl flex items-center gap-2 text-sm text-[#e11d48] font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-6">
          {/* Section: Subject Metadata */}
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-lg text-[#201e1d] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c67139]" />
              Subject Identity
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  placeholder="0455"
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Subject Name
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Economics"
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Subject Icon
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={subjectIcon}
                    onChange={(e) => setSubjectIcon(e.target.value)}
                    placeholder="📈"
                    className="w-16 text-center text-lg bg-white border-2 border-[#201e1d] rounded-xl px-2 py-1.5 font-bold shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                  />
                  <div className="flex gap-1 flex-wrap flex-1">
                    {emojiPresets.slice(0, 5).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setSubjectIcon(emoji)}
                        className="px-2 py-1 text-sm bg-white border-2 border-[#201e1d] rounded-lg shadow-offset-2 hover:bg-[#ffe1d0] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
            <h3 className="font-heading text-lg text-[#201e1d] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8fa073]" />
              Paper Parameters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Series
                </label>
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                >
                  <option value="s">s (May / June)</option>
                  <option value="w">w (Oct / Nov)</option>
                  <option value="m">m (Feb / March)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2024"
                  min="2000"
                  max="2035"
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Paper Code
                </label>
                <input
                  type="text"
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  placeholder="12"
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>
            </div>
          </div>

          {/* Section: Syllabus Topics Manager */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-lg text-[#201e1d] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                Syllabus Topics Manager ({topics.length})
              </h3>
              <span className="text-xs text-[#82796a] font-bold">
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
                className="flex-1 bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-medium text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139]"
              />
              <button
                type="button"
                onClick={handleAddTopic}
                className="px-4 py-2 bg-[#ccdbb2] hover:bg-[#aebf92] border-2 border-b-4 border-[#201e1d] rounded-xl font-bold text-sm text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Topic
              </button>
            </div>

            {/* Topics List */}
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {topics.length === 0 ? (
                <div className="p-6 text-center border-2 border-dashed border-[#82796a] rounded-2xl bg-[#f5ead8]/60 text-sm text-[#82796a] font-bold">
                  No syllabus topics registered yet. Add your first syllabus unit above.
                </div>
              ) : (
                topics.map((topic, idx) => (
                  <div
                    key={`${topic.name}-${idx}`}
                    className="flex items-center gap-2 p-2 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2"
                  >
                    <span className="w-7 h-7 flex items-center justify-center bg-[#ffe1d0] border-2 border-[#201e1d] rounded-lg text-xs font-bold text-[#c67139] flex-shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={topic.name}
                      onChange={(e) => handleTopicNameChange(idx, e.target.value)}
                      className="flex-1 bg-transparent border-0 text-sm font-semibold text-[#201e1d] focus:outline-none focus:bg-[#f9f4ed] px-2 py-1 rounded"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveTopic(idx, "up")}
                        disabled={idx === 0}
                        aria-label="Move topic up"
                        className="p-1 rounded bg-[#f5ead8] hover:bg-[#e1eecc] disabled:opacity-30 border border-[#201e1d] transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveTopic(idx, "down")}
                        disabled={idx === topics.length - 1}
                        aria-label="Move topic down"
                        className="p-1 rounded bg-[#f5ead8] hover:bg-[#e1eecc] disabled:opacity-30 border border-[#201e1d] transition-all cursor-pointer disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(idx)}
                        aria-label="Remove topic"
                        className="p-1 rounded bg-[#fecdd3] hover:bg-[#fb7185] text-[#e11d48] hover:text-white border border-[#201e1d] transition-all cursor-pointer ml-1"
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
        <div className="flex justify-end items-center gap-3 pt-3 border-t-2 border-[#201e1d]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white hover:bg-neutral-200 border-2 border-b-4 border-[#201e1d] rounded-xl font-bold text-sm text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-[#8fa073] hover:bg-[#728157] text-white border-2 border-b-4 border-[#201e1d] rounded-xl font-bold text-sm shadow-offset-2 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
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
      const targetPaper = parsed?.paper || parsed;
      if (!targetPaper || typeof targetPaper !== "object") {
        setPasteError("JSON must contain a staging paper object.");
        return;
      }
      onPasteJson(trimmed);
      setIsPasteMode(false);
      setPastedJson("");
      setPasteError(null);
      onClose();
    } catch (err: any) {
      setPasteError(`Invalid JSON syntax: ${err.message}`);
    }
  };

  const handleFormatPastedJson = () => {
    try {
      const parsed = JSON.parse(pastedJson);
      setPastedJson(JSON.stringify(parsed, null, 2));
      setPasteError(null);
    } catch (err: any) {
      setPasteError(`Cannot format: ${err.message}`);
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
      <div className="bg-[#f9f4ed] border-4 border-[#201e1d] rounded-3xl shadow-offset-6 p-6 w-full max-w-4xl h-[92vh] flex flex-col gap-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#201e1d]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#f0fae1] border-2 border-[#201e1d] rounded-2xl shadow-offset-2">
              <Database className="w-6 h-6 text-[#728157]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="payload-dialog-title" className="font-heading text-2xl text-[#201e1d]">
                  Raw Payloads & SQL Inspector
                </h2>
                {paper && (
                  <span className="px-2.5 py-0.5 bg-[#ffe1d0] border border-[#201e1d] rounded-full text-xs font-bold text-[#c67139]">
                    {paper.subject?.code} {paper.paper?.series}{paper.paper?.year}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#82796a] font-medium">
                Inspect generated idempotent transacted PostgreSQL queries or view and paste raw JSON
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close payload dialog"
            className="p-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-[#201e1d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab & Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 border-2 border-[#201e1d] rounded-2xl shadow-offset-2">
          {/* Main Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("sql");
                setIsPasteMode(false);
              }}
              className={`px-4 py-2 border-2 border-[#201e1d] rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "sql"
                  ? "bg-[#c67139] text-white shadow-offset-2"
                  : "bg-white text-[#201e1d] hover:bg-[#ffe1d0]"
              }`}
            >
              <Database className="w-4 h-4" />
              Batch SQL
            </button>
            <button
              onClick={() => setActiveTab("json")}
              className={`px-4 py-2 border-2 border-[#201e1d] rounded-xl font-bold text-sm transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === "json"
                  ? "bg-[#c67139] text-white shadow-offset-2"
                  : "bg-white text-[#201e1d] hover:bg-[#ffe1d0]"
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
                  className={`px-3 py-1.5 border-2 border-[#201e1d] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isPasteMode
                      ? "bg-[#8fa073] text-white shadow-offset-2"
                      : "bg-[#f5ead8] text-[#201e1d] hover:bg-[#e1eecc]"
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  {isPasteMode ? "View JSON" : "Paste Raw JSON"}
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-[#f0fae1] hover:bg-[#e1eecc] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload JSON
                </button>
                <input
                  type="file"
                  accept=".json,application/json"
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
                  className="px-3 py-1.5 bg-[#ffe1d0] hover:bg-[#ffc6a5] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {copyFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                      <span className="text-[#15803d]">Copied!</span>
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
                  className="px-3 py-1.5 bg-[#ccdbb2] hover:bg-[#aebf92] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
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
            <div className="flex-1 flex flex-col gap-3 bg-[#f5ead8] p-4 rounded-2xl border-2 border-[#201e1d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-[#c67139]" />
                  <span className="font-heading text-base text-[#201e1d]">
                    Paste Staging Paper JSON Directly
                  </span>
                </div>
                <button
                  onClick={handleFormatPastedJson}
                  className="text-xs font-bold px-2.5 py-1 bg-white border border-[#201e1d] rounded-lg hover:bg-[#ffe1d0] transition-colors cursor-pointer"
                >
                  Prettify
                </button>
              </div>

              {pasteError && (
                <div className="p-2.5 bg-[#fecdd3] border-2 border-[#201e1d] rounded-xl flex items-center gap-2 text-xs text-[#e11d48] font-bold">
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
                className="flex-1 w-full p-4 bg-[#201e1d] text-[#ffe1d0] font-mono text-xs sm:text-sm rounded-xl border-2 border-[#201e1d] resize-none focus:outline-none focus:ring-2 focus:ring-[#c67139]"
              />

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsPasteMode(false)}
                  className="px-4 py-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyPastedJson}
                  className="px-5 py-2 bg-[#8fa073] hover:bg-[#728157] text-white border-2 border-b-4 border-[#201e1d] rounded-xl text-xs font-bold shadow-offset-2 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Validate & Load JSON
                </button>
              </div>
            </div>
          ) : (
            <CodeViewer code={currentContent} language={activeTab} />
          )}
        </div>

        {/* Footer Meta */}
        <div className="flex items-center justify-between text-xs font-bold text-[#82796a] pt-2 border-t-2 border-[#201e1d]">
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
            className="px-4 py-1.5 bg-white hover:bg-neutral-200 border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
