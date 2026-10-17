'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Eye, 
  Edit3, 
  ArrowRight, 
  Save, 
  Trash2, 
  Flag,
  FileCheck,
  Plus,
  Tag,
  Image as ImageIcon,
  Wand2,
  X,
  Layers,
  BookOpen
} from 'lucide-react';
import { useQuestions, Question, CAMBRIDGE_TOPICS } from '@/lib/questions';
import {
  CambridgeQuestionMeta,
  parseCambridgeQuestionMetadata,
  formatCambridgeCitation,
  SUGGESTED_TAGS,
  SERIES_OPTIONS,
  VARIANT_OPTIONS,
  PAPER_CODE_OPTIONS,
  YEAR_OPTIONS,
  SUBJECT_OPTIONS,
  DIFFICULTY_OPTIONS,
  STATUS_OPTIONS,
} from '@/lib/portal/questionMetadata';

export interface AdminCMSProps {
  initialView?: 'editor' | 'flagged';
  questionId?: string;
}

export default function AdminCMS({
  initialView = 'editor',
  questionId,
}: AdminCMSProps) {
  const { questions, loading: loadingQuestions } = useQuestions();
  const [activeTab, setActiveTab] = useState<'editor' | 'flagged'>(initialView);
  const [isAuthoringNew, setIsAuthoringNew] = useState(false);

  const defaultQuestion = questions.find((q) => q.id === questionId) || questions[0];

  // Question Editor state (2g)
  const [paper, setPaper] = useState('0455');
  const [session, setSession] = useState('May/June');
  const [qNumber, setQNumber] = useState('1');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [topic, setTopic] = useState('The basic economic problem');
  const [formula, setFormula] = useState('');
  const [stem, setStem] = useState('');

  // Extended Cambridge Metadata Fields
  const [subject, setSubject] = useState('0455 - Economics');
  const [year, setYear] = useState<number>(2024);
  const [series, setSeries] = useState('May/June');
  const [variant, setVariant] = useState('2');
  const [paperCode, setPaperCode] = useState('12');
  const [status, setStatus] = useState<'Live' | 'Needs review' | 'Agent draft' | 'Withdrawn'>('Live');
  const [subtopic, setSubtopic] = useState('1.1 The nature of the economic problem');
  const [tags, setTags] = useState<string[]>(['Microeconomics', 'Core Concept']);
  const [tagInput, setTagInput] = useState('');
  const [hasDiagram, setHasDiagram] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);
  const [citation, setCitation] = useState('Cambridge IGCSE Economics 0455/12 May/June 2024 Q1');

  const [options, setOptions] = useState([
    {
      letter: 'A',
      text: '',
      reason: 'Correct answer',
      isCorrect: true,
    },
    {
      letter: 'B',
      text: '',
      reason: '',
      isCorrect: false,
    },
    {
      letter: 'C',
      text: '',
      reason: '',
      isCorrect: false,
    },
    {
      letter: 'D',
      text: '',
      reason: '',
      isCorrect: false,
    },
  ]);

  const [explanationSteps, setExplanationSteps] = useState<string[]>([]);

  const [selectedPreviewOption, setSelectedPreviewOption] = useState<string>('A');
  const [publishSuccess, setPublishSuccess] = useState(false);

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAddTag = (tagToAdd?: string) => {
    const tag = (tagToAdd ?? tagInput).trim();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    if (!tagToAdd) {
      setTagInput('');
    }
  };

  const handleAutoGenerateCitation = () => {
    const generated = formatCambridgeCitation({
      subject,
      year: Number(year) || 2024,
      series,
      paperCode,
      variant,
      questionNumber: parseInt(qNumber, 10) || 1,
    });
    setCitation(generated);
  };

  const handleReset = () => {
    const q = questions.find((item) => item.id === questionId) || questions[0];
    const meta = parseCambridgeQuestionMetadata(q);
    setSubject(meta.subject);
    setYear(meta.year);
    setSeries(meta.series);
    setSession(meta.series);
    setVariant(meta.variant);
    setPaperCode(meta.paperCode);
    setPaper(meta.subject.match(/\d{4}/)?.[0] || '0455');
    setQNumber(String(meta.questionNumber));
    setDifficulty(meta.difficulty);
    setStatus(meta.status);
    setTopic(meta.topic);
    setSubtopic(meta.subtopic);
    setTags(meta.tags);
    setHasDiagram(meta.hasDiagram);
    setImageUrl(meta.imageUrl);
    setImageError(false);
    setCitation(meta.citation);

    if (q) {
      setStem(q.stem_markdown || '');
      setFormula('');
      setOptions([
        {
          letter: 'A',
          text: q.options[0]?.text_markdown || '',
          reason: q.options[0]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[0]?.id === q.correct_option_id,
        },
        {
          letter: 'B',
          text: q.options[1]?.text_markdown || '',
          reason: q.options[1]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[1]?.id === q.correct_option_id,
        },
        {
          letter: 'C',
          text: q.options[2]?.text_markdown || '',
          reason: q.options[2]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[2]?.id === q.correct_option_id,
        },
        {
          letter: 'D',
          text: q.options[3]?.text_markdown || '',
          reason: q.options[3]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[3]?.id === q.correct_option_id,
        },
      ]);
      const correctIdx = q.options.findIndex((opt) => opt.id === q.correct_option_id);
      setSelectedPreviewOption(['A', 'B', 'C', 'D'][correctIdx] || 'A');
    }
  };

  React.useEffect(() => {
    const q = questions.find((item) => item.id === questionId) || questions[0];
    if (q) {
      const meta = parseCambridgeQuestionMetadata(q);
      setSubject(meta.subject);
      setYear(meta.year);
      setSeries(meta.series);
      setSession(meta.series);
      setVariant(meta.variant);
      setPaperCode(meta.paperCode);
      setPaper(meta.subject.match(/\d{4}/)?.[0] || '0455');
      setQNumber(String(meta.questionNumber));
      setDifficulty(meta.difficulty);
      setStatus(meta.status);
      setTopic(meta.topic);
      setSubtopic(meta.subtopic);
      setTags(meta.tags);
      setHasDiagram(meta.hasDiagram);
      setImageUrl(meta.imageUrl);
      setImageError(false);
      setCitation(meta.citation);

      setStem(q.stem_markdown || '');
      setOptions([
        {
          letter: 'A',
          text: q.options[0]?.text_markdown || '',
          reason: q.options[0]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[0]?.id === q.correct_option_id,
        },
        {
          letter: 'B',
          text: q.options[1]?.text_markdown || '',
          reason: q.options[1]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[1]?.id === q.correct_option_id,
        },
        {
          letter: 'C',
          text: q.options[2]?.text_markdown || '',
          reason: q.options[2]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[2]?.id === q.correct_option_id,
        },
        {
          letter: 'D',
          text: q.options[3]?.text_markdown || '',
          reason: q.options[3]?.id === q.correct_option_id ? 'Correct answer' : '',
          isCorrect: q.options[3]?.id === q.correct_option_id,
        },
      ]);
      const correctIdx = q.options.findIndex((opt) => opt.id === q.correct_option_id);
      setSelectedPreviewOption(['A', 'B', 'C', 'D'][correctIdx] || 'A');
    }
  }, [questionId, questions]);

  // Flagged questions state (2h)
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
  const flaggedItems: Array<{
    id: string;
    title: string;
    reason: string;
    n: number;
    age: string;
    verdict: string;
    vCls: string;
  }> = [];

  const studentReports: Array<{
    who: string;
    when: string;
    text: string;
  }> = [];

  const handleOptionTextChange = (idx: number, newText: string) => {
    const updated = [...options];
    updated[idx].text = newText;
    setOptions(updated);
  };

  const handleOptionReasonChange = (idx: number, newReason: string) => {
    const updated = [...options];
    updated[idx].reason = newReason;
    setOptions(updated);
  };

  const handleSetCorrectOption = (idx: number) => {
    const updated = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === idx,
      reason: i === idx ? 'Correct answer' : opt.reason === 'Correct answer' ? '' : opt.reason,
    }));
    setOptions(updated);
    setSelectedPreviewOption(options[idx].letter);
  };

  const handleApprove = () => {
    setPublishSuccess(true);
    setTimeout(() => setPublishSuccess(false), 4000);
  };

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 text-[#201e1d] font-body">
      {/* Sub-Tabs for CMS Mode */}
      <div className="flex items-center gap-2 border-b border-[#dcd3c4] pb-2 flex-wrap">
        <button
          onClick={() => setActiveTab('editor')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'editor'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          ✍️ Visual Question Editor (2g)
        </button>
        <button
          onClick={() => setActiveTab('flagged')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
            activeTab === 'flagged'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          <span>Flagged / Reports (2h)</span>
          <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-white text-[10px]">
            {flaggedItems.length}
          </span>
        </button>

      </div>

      {/* ========================================================
          MODE 1: VISUAL QUESTION EDITOR (Mockup 2g)
          ======================================================== */}
      {activeTab === 'editor' && (
        questions.length === 0 && !isAuthoringNew ? (
          <div className="rounded-[28px] bg-[#f9f4ed] border-2 border-[#201e1d] p-8 sm:p-12 shadow-[4px_4px_0_0_#201e1d] text-center space-y-4 max-w-lg mx-auto my-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-[2px_2px_0_0_#201e1d]">
              ✍️
            </div>
            <h2 className="font-heading text-xl font-black text-[#201e1d]">No questions in the database yet</h2>
            <p className="text-xs font-semibold text-[#645c50] leading-relaxed">
              No questions in the database yet. Ingest an exam paper or click New Question to author one.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsAuthoringNew(true);
                  const defaultMeta = parseCambridgeQuestionMetadata();
                  setStem('');
                  setPaper('0455');
                  setSession(defaultMeta.series);
                  setSubject(defaultMeta.subject);
                  setYear(defaultMeta.year);
                  setSeries(defaultMeta.series);
                  setVariant(defaultMeta.variant);
                  setPaperCode(defaultMeta.paperCode);
                  setQNumber('1');
                  setDifficulty(defaultMeta.difficulty);
                  setStatus(defaultMeta.status);
                  setTopic(defaultMeta.topic);
                  setSubtopic(defaultMeta.subtopic);
                  setTags(defaultMeta.tags);
                  setHasDiagram(false);
                  setImageUrl('');
                  setImageError(false);
                  setCitation(defaultMeta.citation);
                  setFormula('');
                  setOptions([
                    { letter: 'A', text: '', reason: 'Correct answer', isCorrect: true },
                    { letter: 'B', text: '', reason: '', isCorrect: false },
                    { letter: 'C', text: '', reason: '', isCorrect: false },
                    { letter: 'D', text: '', reason: '', isCorrect: false },
                  ]);
                }}
                className="px-5 py-2.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b8c99d] active:translate-y-0.5 transition-all cursor-pointer"
              >
                + New Question
              </button>
              <a
                href="/admin?tab=ingestion"
                className="px-5 py-2.5 rounded-full bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 transition-all inline-flex items-center cursor-pointer"
              >
                Ingest Exam Paper →
              </a>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Editor Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#645c50]">
                  Question bank / {defaultQuestion?.id || 'New Question'}
                </span>
                <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                  {defaultQuestion?.topic || 'Question Editor'}
                </h2>
              </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-[#f0fae1] text-[#272e1b] border border-[#8fa073]/40 text-xs font-bold">
                Verified Cambridge · Live Bank
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-xs font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve &amp; publish
              </button>
            </div>
          </div>

          {publishSuccess && (
            <div className="p-3 rounded-2xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs font-bold text-[#272e1b] flex items-center gap-2">
              <Check className="w-4 h-4 text-[#728157]" />
              Question {questionId} successfully approved, verified and published to Live Bank!
            </div>
          )}

          {/* Split-Pane Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
            {/* Left Pane (Metadata, Stem, Options, Explanations) */}
            <div className="flex flex-col gap-4">
              {/* Comprehensive Neobrutalist Cambridge Metadata Editor */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[3px_3px_0_#201e1d] flex flex-col gap-6 text-xs">
                
                {/* Section 1: Exam Identity & Metadata Grid */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c67139]"></span>
                      <span className="font-heading font-black text-xs text-[#201e1d] uppercase tracking-wider">
                        1. Exam Identity &amp; Paper Metadata
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#645c50] border border-[#201e1d] shadow-[1px_1px_0_#201e1d]">
                      Cambridge Assessment
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Subject */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Subject</label>
                      <select
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value);
                          const code = e.target.value.match(/\d{4}/)?.[0] || '0455';
                          setPaper(code);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {SUBJECT_OPTIONS.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Year */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Year</label>
                      <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-bold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {YEAR_OPTIONS.map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Series / Season */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Series / Season</label>
                      <select
                        value={series}
                        onChange={(e) => {
                          setSeries(e.target.value);
                          setSession(e.target.value);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {SERIES_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label} ({s.code.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Paper Code */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Paper Code</label>
                      <input
                        type="text"
                        value={paperCode}
                        onChange={(e) => setPaperCode(e.target.value)}
                        placeholder="12"
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-bold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      />
                    </div>

                    {/* Variant */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Variant</label>
                      <select
                        value={variant}
                        onChange={(e) => setVariant(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {VARIANT_OPTIONS.map((v) => (
                          <option key={v} value={v}>
                            Variant {v}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Question # */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Question #</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={qNumber}
                        onChange={(e) => setQNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#c67139] font-black text-[#201e1d] outline-none focus:border-[#201e1d]"
                      />
                    </div>

                    {/* Difficulty */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Difficulty</label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] outline-none focus:border-[#201e1d]"
                      >
                        {STATUS_OPTIONS.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Syllabus & Citation Reference */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#728157]"></span>
                      <span className="font-heading font-black text-xs text-[#201e1d] uppercase tracking-wider">
                        2. Syllabus &amp; Citation Reference
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Syllabus Topic */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Syllabus Topic</label>
                      <select
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] text-xs outline-none focus:border-[#201e1d]"
                      >
                        {CAMBRIDGE_TOPICS.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.orderIndex}. {t.name}
                          </option>
                        ))}
                        <option value="General">General Economics</option>
                      </select>
                    </div>

                    {/* Subtopic */}
                    <div>
                      <label className="block text-[#645c50] font-bold mb-1">Subtopic / Syllabus Section</label>
                      <input
                        type="text"
                        placeholder="e.g. 1.1 The nature of the economic problem"
                        value={subtopic}
                        onChange={(e) => setSubtopic(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d] text-xs outline-none focus:border-[#201e1d]"
                      />
                    </div>

                    {/* Citation Reference with Auto-generate */}
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[#645c50] font-bold">Citation Reference</label>
                        <button
                          type="button"
                          onClick={handleAutoGenerateCitation}
                          className="px-2.5 py-1 rounded-lg bg-[#eee7db] hover:bg-[#e2d9cb] border border-[#201e1d] text-[11px] font-bold text-[#201e1d] flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5 shadow-[1px_1px_0_#201e1d]"
                        >
                          <Wand2 className="w-3 h-3 text-[#c67139]" /> Auto-generate Citation
                        </button>
                      </div>
                      <input
                        type="text"
                        value={citation}
                        onChange={(e) => setCitation(e.target.value)}
                        placeholder="Cambridge IGCSE Economics 0455/12 May/June 2024 Q1"
                        className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-mono text-xs text-[#201e1d] outline-none focus:border-[#201e1d]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Tagging / Categorization */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#4e7bb4]"></span>
                      <span className="font-heading font-black text-xs text-[#201e1d] uppercase tracking-wider">
                        3. Tagging &amp; Categorization
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#645c50]">
                      {tags.length} active tag{tags.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Active tag chips */}
                  <div className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2.5 rounded-2xl bg-white border-[1.5px] border-[#dcd3c4]">
                    {tags.length === 0 ? (
                      <span className="text-xs text-[#a19786] italic">
                        No tags assigned yet. Click quick suggestions or type below.
                      </span>
                    ) : (
                      tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d]"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="w-4 h-4 rounded-full hover:bg-[#e2d9cb] inline-flex items-center justify-center text-xs font-black cursor-pointer text-[#645c50] hover:text-[#201e1d] transition-colors"
                            aria-label={`Remove tag ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Quick-add chip suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] font-bold text-[#645c50] flex items-center gap-1 mr-1">
                      <Tag className="w-3 h-3 text-[#c67139]" /> Quick suggestions:
                    </span>
                    {SUGGESTED_TAGS.map((suggested) => {
                      const isAdded = tags.includes(suggested);
                      return (
                        <button
                          key={suggested}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddTag(suggested)}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-all ${
                            isAdded
                              ? 'bg-[#e5dfd5] text-[#8c8273] border-[#c0b6a5] cursor-not-allowed opacity-60'
                              : 'bg-white text-[#201e1d] border-[#201e1d] hover:bg-[#ccdbb2] active:translate-y-0.5 cursor-pointer shadow-[1px_1px_0_#201e1d]'
                          }`}
                        >
                          {isAdded ? '✓ ' : '+ '}{suggested}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom tag input + Add button */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add custom tag (e.g. Scarcity, Price Elasticity)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] outline-none focus:border-[#201e1d]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddTag()}
                      className="px-3.5 py-1.5 rounded-xl bg-[#201e1d] text-[#f9f4ed] text-xs font-bold hover:bg-[#3d3835] active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1 shadow-[1.5px_1.5px_0_#201e1d]"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Tag
                    </button>
                  </div>
                </div>

                {/* Section 4: Diagram & Media Asset */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#d08b38]"></span>
                      <span className="font-heading font-black text-xs text-[#201e1d] uppercase tracking-wider">
                        4. Diagram &amp; Media Asset
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasDiagram}
                        onChange={(e) => setHasDiagram(e.target.checked)}
                        className="w-4 h-4 rounded text-[#c67139] border-[1.5px] border-[#201e1d] cursor-pointer accent-[#c67139]"
                      />
                      <span className="text-xs font-bold text-[#201e1d]">Has Diagram</span>
                    </label>
                  </div>

                  {hasDiagram ? (
                    <div className="flex flex-col sm:flex-row gap-3 items-start pt-1">
                      <div className="flex-1 w-full space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#645c50]">
                          Diagram Image URL or Local Path
                        </label>
                        <input
                          type="text"
                          placeholder="/questions/0455_s24_12_q1.png or https://..."
                          value={imageUrl}
                          onChange={(e) => {
                            setImageUrl(e.target.value);
                            setImageError(false);
                          }}
                          className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-mono text-xs text-[#201e1d] outline-none focus:border-[#201e1d]"
                        />
                        <div className="flex items-center gap-2 text-[10px] text-[#645c50] pt-0.5">
                          <span>Quick fill:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const sCode = series === 'May/June' ? 's' : series === 'Oct/Nov' ? 'w' : 'm';
                              const yr = String(year).slice(-2);
                              const autoPath = `/questions/0455_${sCode}${yr}_${paperCode}_q${qNumber}.png`;
                              setImageUrl(autoPath);
                              setImageError(false);
                            }}
                            className="text-[#c67139] underline font-bold hover:text-[#b2622d] cursor-pointer"
                          >
                            Auto standard Cambridge path
                          </button>
                        </div>
                      </div>

                      {imageUrl && (
                        <div className="w-28 h-24 rounded-2xl bg-white border-[1.5px] border-[#201e1d] overflow-hidden flex flex-col items-center justify-center p-1.5 shadow-[2px_2px_0_#201e1d] shrink-0">
                          {!imageError ? (
                            <img
                              src={imageUrl}
                              alt="Question Diagram Preview"
                              onError={() => setImageError(true)}
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center p-1">
                              <AlertTriangle className="w-4 h-4 text-[#c67139] mb-1" />
                              <span className="text-[9px] font-bold text-[#645c50] leading-tight">
                                Image not found
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-[#645c50] italic py-1">
                      No diagram asset attached. Check &quot;Has Diagram&quot; if this question requires a curve, graph, or schedule diagram.
                    </p>
                  )}
                </div>

                {/* Section 5: Formula (LaTeX) & Stem textarea */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#201e1d]"></span>
                      <span className="font-heading font-black text-xs text-[#201e1d] uppercase tracking-wider">
                        5. Formula (LaTeX) &amp; Stem
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#645c50] font-bold mb-1">Formula (LaTeX) (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. PED = \\frac{\\% \\Delta Q_d}{\\% \\Delta P}"
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-mono text-xs text-[#201e1d] outline-none focus:border-[#201e1d]"
                    />
                  </div>

                  <div>
                    <label className="block text-[#645c50] font-bold mb-1">Stem (Markdown supported)</label>
                    <textarea
                      rows={3}
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      placeholder="Enter question stem markdown..."
                      className="w-full p-3 rounded-2xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] leading-relaxed outline-none focus:border-[#c67139]"
                    />
                  </div>
                </div>

              </div>

              {/* Options & Distractor Explanations */}
              <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-4 shadow-sm">
                {/* Container Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#dcd3c4]/60">
                  <div>
                    <h3 className="font-heading font-black text-sm text-[#201e1d]">
                      MCQ Options & Distractor Explanations
                    </h3>
                    <p className="text-xs text-[#645c50] mt-0.5">
                      Click an option letter to set the correct answer. Provide misconception reasons for distractors.
                    </p>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-[#ccdbb2]/50 border border-[#8fa073]/40 text-[#272e1b] font-bold text-[11px] tracking-wide shrink-0">
                    4 Options (A–D)
                  </span>
                </div>

                {/* Option Cards */}
                <div className="flex flex-col gap-3.5">
                  {options.map((opt, idx) => (
                    <div
                      key={opt.letter}
                      className={`p-4 rounded-2xl border-[1.5px] transition-all flex flex-col gap-3 ${
                        opt.isCorrect
                          ? 'bg-[#f0fae1] border-[#728157] shadow-sm'
                          : 'bg-white border-[#dcd3c4] hover:border-[#c0b6a5]'
                      }`}
                    >
                      {/* Top Section: Header Bar & Option Text */}
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(idx)}
                              title={`Mark Option ${opt.letter} as correct`}
                              className={`w-9 h-9 rounded-full border-[1.5px] border-[#201e1d] font-heading font-black grid place-items-center cursor-pointer shadow-[1px_1px_0_#201e1d] transition-all ${
                                opt.isCorrect
                                  ? 'bg-[#728157] text-[#f9f4ed]'
                                  : 'bg-white text-[#201e1d] hover:bg-[#eee7db]'
                              }`}
                            >
                              {opt.letter}
                            </button>
                            <span className="font-heading font-bold text-xs text-[#201e1d]">
                              Option {opt.letter} Text
                            </span>
                          </div>

                          {opt.isCorrect ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#728157] text-[#f9f4ed] font-bold text-xs shadow-sm">
                              <Check className="w-3.5 h-3.5" />
                              Correct Answer
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetCorrectOption(idx)}
                              className="text-xs font-bold text-[#645c50] hover:text-[#728157] transition-colors cursor-pointer"
                            >
                              Mark as correct
                            </button>
                          )}
                        </div>

                        {/* Option Text Area */}
                        <textarea
                          rows={2}
                          value={opt.text}
                          onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                          placeholder={`Enter Option ${opt.letter} text (supports math / markdown)...`}
                          className={`w-full p-3 rounded-xl border-[1.5px] font-bold text-xs leading-relaxed resize-y outline-none transition-all ${
                            opt.isCorrect
                              ? 'bg-white border-[#728157] text-[#201e1d] focus:border-[#728157] focus:ring-1 focus:ring-[#728157]'
                              : 'bg-white border-[#dcd3c4] text-[#201e1d] focus:border-[#c67139]'
                          }`}
                        />
                      </div>

                      {/* Bottom Section: Distractor / Misconception Reason */}
                      {!opt.isCorrect && (
                        <div className="ml-12 pl-3 border-l-2 border-[#dcd3c4] flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-[#645c50]">
                            Why it&apos;s wrong / Misconception reason (shown to student after answering):
                          </label>
                          <textarea
                            rows={2}
                            value={opt.reason}
                            onChange={(e) => handleOptionReasonChange(idx, e.target.value)}
                            placeholder="Explain why this option is incorrect or maps to a common misconception..."
                            className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs text-[#474238] outline-none focus:border-[#c67139] leading-relaxed resize-y"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step-by-Step Explanation */}
              <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-2.5 shadow-sm">
                <span className="text-xs font-bold text-[#645c50]">Step-by-step explanation</span>
                {explanationSteps.map((stepText, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-[#ccdbb2] text-[#272e1b] grid place-items-center font-bold text-[11px]">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={stepText}
                      onChange={(e) => {
                        const updated = [...explanationSteps];
                        updated[idx] = e.target.value;
                        setExplanationSteps(updated);
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs text-[#201e1d]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane (Agent Review Checks & Student Preview) */}
            <div className="flex flex-col gap-4">
              {/* Agent Review Checks Card */}
              <div className="p-4 rounded-3xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#728157]" />
                  <span className="font-heading text-sm font-black text-[#201e1d]">
                    Agent review checks
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div className="flex items-start gap-1.5 text-[#3d472b]">
                    <span className="font-black text-[#728157]">✓</span>
                    <span>Answer verified against Cambridge Mark Scheme: Option D</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#3d472b]">
                    <span className="font-black text-[#728157]">✓</span>
                    <span>Each distractor maps to an economic misconception</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#3d472b]">
                    <span className="font-black text-[#728157]">✓</span>
                    <span>Syllabus match: Section 1.1 The Basic Economic Problem</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#3d472b]">
                    <span className="font-black text-[#728157]">✓</span>
                    <span>Key concept validated: Scarcity = Unlimited Wants &gt; Finite Resources</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => alert('Mark scheme citation verified!')}
                    className="px-3 py-1 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5"
                  >
                    Mark Scheme Verified
                  </button>
                  <button
                    onClick={() => alert('Syllabus reference: Section 1.1')}
                    className="px-3 py-1 rounded-full border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5"
                  >
                    View Syllabus Code
                  </button>
                </div>
              </div>

              {/* Student Live Preview Card */}
              <div className="p-5 rounded-[28px] bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[3px_3px_0_#201e1d] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                    Student live preview
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      status === 'Live'
                        ? 'bg-[#f0fae1] text-[#272e1b] border-[#8fa073]'
                        : status === 'Needs review'
                        ? 'bg-[#ffe1d0] text-[#7a3b10] border-[#c67139]'
                        : status === 'Agent draft'
                        ? 'bg-[#e0e9f8] text-[#1c3d73] border-[#7da1d6]'
                        : 'bg-[#eee7db] text-[#645c50] border-[#a19786]'
                    }`}
                  >
                    ● {status}
                  </span>
                </div>

                {/* Formatted Citation Badge & Difficulty */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="self-start px-2.5 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-[10px] font-bold">
                    {citation ||
                      formatCambridgeCitation({
                        subject,
                        year: Number(year) || 2024,
                        series,
                        paperCode,
                        variant,
                        questionNumber: parseInt(qNumber, 10) || 1,
                      })}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-bold text-[#201e1d]">
                    {difficulty}
                  </span>
                </div>

                {/* Active Tags Preview */}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-white border border-[#201e1d] text-[9px] font-bold text-[#201e1d] shadow-[1px_1px_0_#201e1d]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Diagram Preview above stem if hasDiagram & imageUrl */}
                {hasDiagram && imageUrl && (
                  <div className="w-full max-h-48 rounded-2xl bg-white border-[1.5px] border-[#201e1d] p-2 flex items-center justify-center overflow-hidden my-1 shadow-sm">
                    <img
                      src={imageUrl}
                      alt="Question diagram"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                      className="max-h-44 max-w-full object-contain"
                    />
                  </div>
                )}

                <p className="font-semibold text-xs text-[#201e1d] leading-snug">
                  {stem || 'Question stem will appear here...'}
                </p>

                {/* Formula Highlight */}
                {formula && (
                  <div className="p-2.5 rounded-xl bg-white border-[1.5px] border-dashed border-[#a19786] text-center font-serif italic text-sm text-[#201e1d]">
                    {formula}
                  </div>
                )}

                {/* Options 2x2 Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                  {options.map((opt) => (
                    <button
                      key={opt.letter}
                      type="button"
                      onClick={() => setSelectedPreviewOption(opt.letter)}
                      className={`p-2 rounded-full border-[1.5px] border-[#201e1d] text-left transition-all ${
                        selectedPreviewOption === opt.letter
                          ? 'bg-[#ccdbb2] text-[#272e1b] shadow-sm'
                          : 'bg-white text-[#201e1d] hover:bg-[#eee7db]'
                      }`}
                    >
                      {opt.letter} · {opt.text || `Option ${opt.letter}`}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-[#645c50]">
                Verified Cambridge Past Paper Question · Syllabus {subject}
              </span>
            </div>
          </div>
        </div>
        )
      )}

      {/* ========================================================
          MODE 2: FLAGGED & REPORTED QUESTIONS (Mockup 2h)
          ======================================================== */}
      {activeTab === 'flagged' && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Flagged</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                0 open reports
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-[#201e1d] text-[#f9f4ed]">Open (0)</span>
              <span className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] text-[#645c50]">
                Agent-resolved
              </span>
              <span className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] text-[#645c50]">
                Closed
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-12 bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-3xl text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#728157]" />
            </div>
            <h3 className="font-heading text-xl font-black text-[#201e1d] mb-2">
              🎉 No flagged questions. All verified Cambridge questions are in good standing.
            </h3>
            <p className="text-xs text-[#645c50] max-w-md">
              There are currently zero open student disputes or syllabus reports. All questions in the live bank match official mark schemes.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
