import React, { useState, useEffect, useRef } from 'react';
import QuestionCard from '@/components/QuestionCard';
import { normalizeStagingPayload, PublishReceipt } from '@/lib/ingestion/useIngestionStore';

interface StagedQuestion {
  id: string;
  stem_markdown: string;
  options: { id: string; text_markdown: string }[];
  correct_option_id: string;
  explanation_markdown: string;
  citation: string;
  topic_id: string;
  topic: string;
  has_diagram: boolean;
  image_url?: string;
  diagram?: {
    has_diagram?: boolean;
    image_url?: string;
    alt_description?: string;
  };
  status: 'complete' | 'review' | 'withdrawn';
}

interface StagedPaperMetadata {
  subject: {
    code: string;
    name: string;
    icon?: string;
  };
  paper: {
    series: string;
    paper_code: string;
    year: number;
  };
  syllabus_topics: { name: string; order_index: number }[];
}

const DEFAULT_PAPER_DATA: StagedPaperMetadata = {
  subject: {
    code: '0455',
    name: 'Economics',
    icon: 'trending-up',
  },
  paper: {
    series: 's',
    paper_code: '12',
    year: 2024,
  },
  syllabus_topics: [],
};

export default function StagingReview() {
  const [paperData, setPaperData] = useState<StagedPaperMetadata>(DEFAULT_PAPER_DATA);
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>([]);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishReceipt, setPublishReceipt] = useState<PublishReceipt | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/ingest/staged-paper?id=0455_s24_12')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const paper = data?.paper || data;
        if (paper && Array.isArray(paper.questions) && paper.questions.length > 0) {
          if (paper.subject && paper.paper) {
            setPaperData({
              subject: {
                code: paper.subject.code || DEFAULT_PAPER_DATA.subject.code,
                name: paper.subject.name || DEFAULT_PAPER_DATA.subject.name,
                icon: paper.subject.icon || DEFAULT_PAPER_DATA.subject.icon,
              },
              paper: {
                series: paper.paper.series || DEFAULT_PAPER_DATA.paper.series,
                paper_code: paper.paper.paper_code || DEFAULT_PAPER_DATA.paper.paper_code,
                year: Number(paper.paper.year) || DEFAULT_PAPER_DATA.paper.year,
              },
              syllabus_topics: Array.isArray(paper.syllabus_topics)
                ? paper.syllabus_topics
                : DEFAULT_PAPER_DATA.syllabus_topics,
            });
          }
          const loaded: StagedQuestion[] = paper.questions.map((q: any) => {
            const options = (q.options || []).map((opt: any) => ({
              id: opt.id || `opt-${(opt.label || 'a').toLowerCase()}`,
              text_markdown: opt.content_markdown || opt.text_markdown || '',
            }));
            const correctOpt = (q.options || []).find((opt: any) => opt.is_correct);
            const correct_option_id = correctOpt
              ? (correctOpt.id || `opt-${(correctOpt.label || 'a').toLowerCase()}`)
              : (q.correct_option_id || options[0]?.id || 'opt-a');

            return {
              id: q.id || `0455-s24-12-q${String(q.question_number || 1).padStart(2, '0')}`,
              stem_markdown: q.stem_markdown || '',
              options,
              correct_option_id,
              explanation_markdown: q.explanation_markdown || '',
              citation: q.cambridge_source_ref || q.citation || '',
              topic_id:
                q.topic_id ||
                (q.topic_name ? q.topic_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'general'),
              topic: q.topic_name || q.topic || 'General',
              has_diagram: Boolean(q.diagram?.has_diagram ?? q.has_diagram),
              image_url: q.diagram?.image_url || q.image_url,
              diagram: q.diagram || (q.image_url ? { has_diagram: Boolean(q.diagram?.has_diagram ?? q.has_diagram), image_url: q.diagram?.image_url || q.image_url } : undefined),
              status: ((q.diagram?.has_diagram ?? q.has_diagram) ? 'review' : 'complete') as
                | 'complete'
                | 'review',
            };
          });
          setStagedQuestions(loaded);
        }
      })
      .catch((err) => {
        // Fallback already initialized in state from CAMBRIDGE_QUESTIONS
        console.warn('Using fallback CAMBRIDGE_QUESTIONS for staging review:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeQuestion = stagedQuestions[selectedQuestionIdx] || stagedQuestions[0];

  const handleUpdateActiveQuestion = (updatedFields: Partial<StagedQuestion>) => {
    setStagedQuestions((prev) =>
      prev.map((q, i) => (i === selectedQuestionIdx ? { ...q, ...updatedFields } : q))
    );
  };

  const validatedCount = stagedQuestions.filter((q) => q.status === 'complete').length;
  const diagramCount = stagedQuestions.filter((q) => q.has_diagram).length;
  const totalCount = stagedQuestions.length;

  const handleExportJSON = () => {
    const exportData = {
      subject: paperData.subject,
      paper: paperData.paper,
      syllabus_topics: paperData.syllabus_topics,
      questions: stagedQuestions.map((q, idx) => ({
        question_number: idx + 1,
        cambridge_source_ref: q.citation,
        topic_name: q.topic,
        stem_markdown: q.stem_markdown,
        diagram: {
          has_diagram: q.has_diagram,
          image_url: q.image_url,
        },
        options: q.options.map((opt, optIdx) => ({
          label: ['A', 'B', 'C', 'D'][optIdx] || 'A',
          content_markdown: opt.text_markdown,
          is_correct: q.correct_option_id === opt.id,
        })),
        explanation_markdown: q.explanation_markdown,
        status: (q.status === 'withdrawn' ? 'withdrawn' : 'active') as 'active' | 'withdrawn',
      })),
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${paperData.subject.code}_${paperData.paper.series}${paperData.paper.year}_${paperData.paper.paper_code}_staged_reviewed.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleLoadJsonFile = (file: File) => {
    const isJsonExt = file.name.toLowerCase().endsWith('.json');
    const isJsonType = !file.type || file.type === 'application/json' || file.type === 'text/json';
    if (!isJsonExt && !isJsonType) {
      setPublishError(`Invalid file "${file.name}": Please select a valid .json file.`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setPublishError(`Failed to read "${file.name}".`);
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setPublishError(`"${file.name}" is an empty file.`);
          return;
        }

        const json = JSON.parse(text);
        const normalized = normalizeStagingPayload(json);
        if (!normalized || !Array.isArray(normalized.questions) || normalized.questions.length === 0) {
          setPublishError(`Could not parse "${file.name}" into a valid Cambridge paper: missing questions.`);
          return;
        }

        setPaperData({
          subject: {
            code: normalized.subject.code || DEFAULT_PAPER_DATA.subject.code,
            name: normalized.subject.name || DEFAULT_PAPER_DATA.subject.name,
            icon: normalized.subject.icon || DEFAULT_PAPER_DATA.subject.icon,
          },
          paper: {
            series: normalized.paper.series || DEFAULT_PAPER_DATA.paper.series,
            paper_code: normalized.paper.paper_code || DEFAULT_PAPER_DATA.paper.paper_code,
            year: Number(normalized.paper.year) || DEFAULT_PAPER_DATA.paper.year,
          },
          syllabus_topics: Array.isArray(normalized.syllabus_topics) && normalized.syllabus_topics.length > 0
            ? normalized.syllabus_topics
            : DEFAULT_PAPER_DATA.syllabus_topics,
        });

        const loadedQuestions: StagedQuestion[] = normalized.questions.map((q: any, idx) => {
          const options = (q.options || []).map((opt: any) => ({
            id: opt.id || `opt-${(opt.label || 'A').toLowerCase()}`,
            text_markdown: opt.content_markdown || opt.text_markdown || '',
          }));
          const correctOpt = q.options?.find((opt: any) => opt.is_correct);
          const correct_option_id = correctOpt
            ? (correctOpt.id || `opt-${(correctOpt.label || 'A').toLowerCase()}`)
            : (options[0]?.id || 'opt-a');

          return {
            id: q.id || `${normalized.subject.code}-${normalized.paper.series}${normalized.paper.year}-${normalized.paper.paper_code}-q${String(q.question_number || idx + 1).padStart(2, '0')}`,
            stem_markdown: q.stem_markdown || '',
            options,
            correct_option_id,
            explanation_markdown: q.explanation_markdown || '',
            citation: q.cambridge_source_ref || `Cambridge ${normalized.subject.code}/${normalized.paper.paper_code} Q${idx + 1}`,
            topic_id: q.topic_id || (q.topic_name ? q.topic_name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'general'),
            topic: q.topic_name || 'General',
            has_diagram: Boolean(q.diagram?.has_diagram || q.has_diagram),
            image_url: q.diagram?.image_url,
            diagram: q.diagram,
            status: ((q.diagram?.has_diagram || q.has_diagram) ? 'review' : 'complete') as 'complete' | 'review',
          };
        });

        setStagedQuestions(loadedQuestions);
        setSelectedQuestionIdx(0);
        setPublishReceipt(null);
        setPublishError(null);
        setPublishMessage(`Loaded "${file.name}" successfully (${loadedQuestions.length} questions). Ready to review and publish to Supabase!`);
      } catch (err: any) {
        setPublishError(`Failed to parse "${file.name}": ${err?.message || 'Syntax error'}`);
      }
    };
    reader.readAsText(file);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    setPublishReceipt(null);
    setPublishMessage('Publishing staged paper & questions to Supabase Live Bank...');

    const activePaperPayload = {
      id: `${paperData.subject.code}_${paperData.paper.series}${String(paperData.paper.year).slice(-2)}_${paperData.paper.paper_code}`,
      subject: paperData.subject,
      paper: paperData.paper,
      syllabus_topics: paperData.syllabus_topics,
      questions: stagedQuestions.map((q, idx) => ({
        question_number: idx + 1,
        cambridge_source_ref: q.citation || `Cambridge ${paperData.subject.code}/${paperData.paper.paper_code} ${paperData.paper.series}${paperData.paper.year} Q${idx + 1}`,
        topic_name: q.topic,
        stem_markdown: q.stem_markdown,
        diagram: {
          has_diagram: q.has_diagram,
          image_url: q.image_url,
        },
        options: q.options.map((opt, optIdx) => ({
          label: (['A', 'B', 'C', 'D'][optIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
          content_markdown: opt.text_markdown,
          is_correct: q.correct_option_id === opt.id,
        })),
        explanation_markdown: q.explanation_markdown,
        status: (q.status === 'withdrawn' ? 'withdrawn' : 'active') as 'active' | 'withdrawn',
      })),
    };

    try {
      const res = await fetch('/api/ingest/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paper: activePaperPayload }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || `Publish failed with status ${res.status}`);
      }

      setPublishReceipt(result);
      setPublishMessage(
        `Batch BATCH-${paperData.subject.code}-${paperData.paper.series.toUpperCase()}${paperData.paper.year}-${paperData.paper.paper_code} published! Upserted ${result.questions_count ?? totalCount} questions to Supabase.`
      );
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to publish staged paper to Supabase.';
      setPublishError(errorMsg);
      setPublishMessage(null);
    } finally {
      setIsPublishing(false);
    }
  };

  if (!activeQuestion || stagedQuestions.length === 0) {
    return (
      <div className="flex flex-col space-y-6">
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json,text/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleLoadJsonFile(file);
            e.target.value = '';
          }}
        />
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-4 rounded-[28px] p-12 text-center flex flex-col items-center justify-center space-y-4">
          <div className="text-6xl">📥</div>
          <h2 className="text-2xl font-black text-[#201e1d] font-heading">No Staged Questions</h2>
          <p className="text-sm font-bold text-[#645c50] max-w-md">
            No questions currently staged for review. Upload a past paper PDF in Ingestion Studio to stage questions.
          </p>
          <div className="flex flex-wrap gap-3 pt-2 justify-center">
            <button
              onClick={() => jsonInputRef.current?.click()}
              className="bg-[#ffe600] text-[#201e1d] border-2 border-[#201e1d] font-black px-5 py-2.5 rounded-full shadow-offset-2 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] transition-all text-sm"
            >
              📂 Load Staging JSON
            </button>
            <a
              href="/admin?tab=ingestion"
              className="bg-white text-[#201e1d] border-2 border-[#201e1d] font-black px-5 py-2.5 rounded-full shadow-offset-2 hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] transition-all text-sm"
            >
              🚀 Go to Ingestion Studio
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Hidden File Input for Direct JSON Upload */}
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json,text/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleLoadJsonFile(file);
          e.target.value = '';
        }}
      />

      {/* Top Bar */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-4 rounded-[28px] p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-xl font-black text-[#201e1d]">
              {paperData.subject.name} {paperData.subject.code}/{paperData.paper.paper_code}{' '}
              {paperData.paper.series.toUpperCase()}/{paperData.paper.year} (Staged)
            </h2>
            <div className="text-sm font-bold text-[#645c50] uppercase">
              Batch ID: BATCH-{paperData.subject.code}-{paperData.paper.series.toUpperCase()}
              {paperData.paper.year}-{paperData.paper.paper_code}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="px-4 py-2 bg-white hover:bg-[#eee7db] text-[#201e1d] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Upload JSON Paper 📄</span>
          </button>
          <div className="bg-emerald-100 text-emerald-800 px-3.5 py-2 rounded-xl font-bold text-xs border-2 border-emerald-300">
            {validatedCount} / {totalCount} Validated ✅
          </div>
          <div className="bg-[#ffe1d0] text-[#c67139] px-3.5 py-2 rounded-xl font-bold text-xs border-2 border-[#c67139]/40">
            {diagramCount} Diagrams Extracted 🖼️
          </div>
        </div>
      </div>

      {/* Direct JSON Dropzone */}
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleLoadJsonFile(file);
        }}
        onClick={() => jsonInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 cursor-pointer transition-all ${
          isDragging
            ? 'bg-[#ffe1d0] border-[#c67139] shadow-md scale-[1.01]'
            : 'bg-white/80 border-[#dcd3c4] hover:bg-white hover:border-[#c67139]'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#c67139] flex items-center justify-center font-bold text-lg shadow-xs">
            📄
          </div>
          <div>
            <div className="font-heading font-black text-sm text-[#201e1d]">
              Upload or Drop Staging JSON Past Paper
            </div>
            <div className="text-xs text-[#645c50] font-medium">
              Load an Antigravity JSON past paper directly into this staging reviewer to inspect questions and publish to Supabase.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            jsonInputRef.current?.click();
          }}
          className="px-4 py-2 bg-[#201e1d] hover:bg-[#3d3835] text-white text-xs font-heading font-black rounded-xl border border-[#201e1d] active:translate-y-0.5 shadow-xs transition-all shrink-0 cursor-pointer"
        >
          Select JSON File
        </button>
      </div>

      {publishReceipt && (
        <div className="bg-[#f0fae1] border-2 border-[#728157] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#728157] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <div className="font-heading font-black text-emerald-950 text-base">
                Supabase Live Upsert Receipt: {publishReceipt.paper_id}
              </div>
              <div className="text-xs text-emerald-800 font-bold mt-0.5">
                {publishReceipt.questions_count} questions • {publishReceipt.options_count} options • {publishReceipt.topics_count} topics • Status: Live in Bank
              </div>
            </div>
          </div>
          <button
            onClick={() => setPublishReceipt(null)}
            className="px-3.5 py-1.5 bg-white border border-[#728157] text-[#3d472b] rounded-xl text-xs font-bold hover:bg-[#f0fae1] cursor-pointer"
          >
            Dismiss Receipt
          </button>
        </div>
      )}

      {publishError && (
        <div className="bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <span className="font-bold text-xs sm:text-sm">⚠️ {publishError}</span>
          <button
            onClick={() => setPublishError(null)}
            className="text-xs font-bold underline ml-4 hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {publishMessage && !publishReceipt && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 p-4 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-between">
          <span>🚀 {publishMessage}</span>
          <button
            onClick={() => setPublishMessage(null)}
            className="text-emerald-700 font-bold ml-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Navigator List */}
        <div className="lg:col-span-1 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-4 rounded-[28px] p-4 max-h-[800px] overflow-y-auto">
          <h3 className="text-sm font-black text-[#201e1d] uppercase tracking-wider mb-4 border-b-2 border-[#eee7db] pb-2">
            Questions ({totalCount})
          </h3>
          <div className="space-y-2">
            {stagedQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setSelectedQuestionIdx(idx)}
                className={`w-full text-left p-3 rounded-xl font-bold text-sm flex items-center justify-between border-2 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                  selectedQuestionIdx === idx
                    ? 'border-[#c67139] bg-[#ffe1d0] text-[#201e1d] shadow-offset-2'
                    : 'border-[#dcd3c4] hover:border-[#201e1d] bg-[#f9f4ed] text-[#201e1d]'
                }`}
              >
                <span>Q{idx + 1}</span>
                <span className="flex gap-1 text-base">
                  {q.has_diagram && '🖼️'}
                  {q.status === 'complete' ? '✅' : '⚠️'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right Column: Interactive Split-pane */}
        <div className="lg:col-span-3 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-4 rounded-[28px] p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="bg-[#201e1d] text-[#f9f4ed] px-3 py-1 rounded-lg text-xs font-black">
                {activeQuestion.citation}
              </span>
              <span className="bg-[#ffe1d0] text-[#c67139] px-3 py-1 rounded-lg text-xs font-bold border border-[#c67139]/30">
                {activeQuestion.topic}
              </span>
            </div>
            <button
              onClick={() =>
                handleUpdateActiveQuestion({
                  status: activeQuestion.status === 'complete' ? 'review' : 'complete',
                })
              }
              className={`px-4 py-2 rounded-xl font-bold text-sm border-2 shadow-offset-2 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                activeQuestion.status === 'complete'
                  ? 'bg-[#eee7db] border-[#dcd3c4] text-[#645c50]'
                  : 'bg-emerald-100 border-emerald-400 text-emerald-800'
              }`}
            >
              {activeQuestion.status === 'complete' ? 'Mark as Needs Review ⚠️' : 'Mark as Complete ✅'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inline Editor */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Stem (KaTeX supported)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-[#fdfbf7] border-2 border-[#201e1d] rounded-xl px-3 py-2 font-mono text-sm text-[#201e1d] outline-none focus:border-[#c67139] shadow-offset-2"
                  value={activeQuestion.stem_markdown}
                  onChange={(e) => handleUpdateActiveQuestion({ stem_markdown: e.target.value })}
                />
              </div>

              {activeQuestion.has_diagram && activeQuestion.image_url && (
                <div className="p-3 bg-[#fdfbf7] rounded-xl border-2 border-[#dcd3c4] flex flex-col items-center">
                  <span className="text-[10px] font-bold text-[#645c50] uppercase tracking-wider mb-1">
                    Extracted Diagram
                  </span>
                  <img
                    src={activeQuestion.image_url}
                    alt="Question Diagram"
                    className="max-h-48 object-contain rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">Options</label>
                <div className="space-y-2">
                  {activeQuestion.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                          activeQuestion.correct_option_id === opt.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#eee7db] text-[#645c50]'
                        }`}
                      >
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <input
                        type="text"
                        className="flex-1 bg-[#fdfbf7] border-2 border-[#dcd3c4] rounded-lg px-2 py-1 text-sm font-medium text-[#201e1d] outline-none focus:border-[#c67139]"
                        value={opt.text_markdown}
                        onChange={(e) => {
                          const newOptions = [...activeQuestion.options];
                          newOptions[i] = { ...newOptions[i], text_markdown: e.target.value };
                          handleUpdateActiveQuestion({ options: newOptions });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#645c50] uppercase mb-1">
                  Explanation
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-[#fdfbf7] border-2 border-[#201e1d] rounded-xl px-3 py-2 font-mono text-sm text-[#201e1d] outline-none focus:border-[#c67139] shadow-offset-2"
                  value={activeQuestion.explanation_markdown}
                  onChange={(e) =>
                    handleUpdateActiveQuestion({ explanation_markdown: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-[#eee7db] p-4 rounded-[28px] border-2 border-[#dcd3c4] flex flex-col items-center">
              <div className="text-xs font-bold text-[#645c50] mb-2 uppercase tracking-widest w-full text-center">
                Live Preview
              </div>
              <div className="w-full pointer-events-auto scale-90 origin-top">
                <QuestionCard
                  question={activeQuestion}
                  questionNumber={selectedQuestionIdx + 1}
                  totalQuestions={totalCount}
                  status={activeQuestion.status === 'complete' ? 'answered' : 'unanswered'}
                  timeLeft={0}
                  isTimed={false}
                  selectedOptionId={activeQuestion.correct_option_id}
                  firstWrongOptionId={null}
                  isEndless={false}
                  onFinish={() => {}}
                  onAnswer={() => {}}
                  onNext={() => {}}
                  totalXP={0}
                  currentStreak={0}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-4 rounded-[28px] p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <a
          href="/portal?nav=ingestion"
          className="w-full sm:w-auto px-5 py-3 bg-[#f9f4ed] text-[#201e1d] font-bold text-sm rounded-2xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#eee7db] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-center"
        >
          Open Ingestion Studio 🛠️
        </a>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            onClick={handleExportJSON}
            className="w-full sm:w-auto px-6 py-3 bg-[#eee7db] text-[#201e1d] font-bold text-lg rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#dcd3c4] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
          >
            Export Staging JSON 💾
          </button>
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className={`w-full sm:w-auto px-8 py-3 bg-[#c67139] text-white font-black text-lg rounded-2xl border-2 border-[#201e1d] shadow-offset-4 hover:bg-[#b2622d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 ${
              isPublishing ? 'opacity-70 cursor-wait' : 'cursor-pointer'
            }`}
          >
            {isPublishing ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Upserting to Supabase...</span>
              </>
            ) : (
              <span>Approve & Publish to Supabase Live 🚀</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
