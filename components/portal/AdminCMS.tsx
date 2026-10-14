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
  Plus
} from 'lucide-react';
import StagingReview from './StagingReview';
import { useQuestions, Question } from '@/lib/questions';

export interface AdminCMSProps {
  initialView?: 'editor' | 'flagged' | 'staged';
  questionId?: string;
}

export default function AdminCMS({
  initialView = 'editor',
  questionId,
}: AdminCMSProps) {
  const { questions, loading: loadingQuestions } = useQuestions();
  const [activeTab, setActiveTab] = useState<'editor' | 'flagged' | 'staged'>(initialView);
  const [isAuthoringNew, setIsAuthoringNew] = useState(false);

  const defaultQuestion = questions.find((q) => q.id === questionId) || questions[0];

  // Question Editor state (2g)
  const [paper, setPaper] = useState('0455');
  const [session, setSession] = useState('');
  const [qNumber, setQNumber] = useState('1');
  const [difficulty, setDifficulty] = useState('Medium');
  const [topic, setTopic] = useState('General');
  const [formula, setFormula] = useState('');
  const [stem, setStem] = useState('');

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

  React.useEffect(() => {
    const q = questions.find((item) => item.id === questionId) || questions[0];
    if (q) {
      setTopic(q.topic || 'General');
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
        <button
          onClick={() => setActiveTab('staged')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeTab === 'staged'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          📑 Staged Paper Review
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
                  setStem('');
                  setPaper('0455');
                  setSession('');
                  setQNumber('1');
                  setTopic('General');
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
                onClick={() => alert('Question revision saved.')}
                className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5"
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
              {/* Metadata Box */}
              <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] grid grid-cols-2 sm:grid-cols-4 gap-3.5 shadow-sm text-xs">
                <div>
                  <label className="block text-[#645c50] font-bold mb-1">Paper</label>
                  <input
                    type="text"
                    value={paper}
                    onChange={(e) => setPaper(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d]"
                  />
                </div>
                <div>
                  <label className="block text-[#645c50] font-bold mb-1">Session</label>
                  <input
                    type="text"
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d]"
                  />
                </div>
                <div>
                  <label className="block text-[#645c50] font-bold mb-1">Question #</label>
                  <input
                    type="text"
                    value={qNumber}
                    onChange={(e) => setQNumber(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#c67139] font-black text-[#201e1d]"
                  />
                </div>
                <div>
                  <label className="block text-[#645c50] font-bold mb-1">Difficulty</label>
                  <input
                    type="text"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#645c50] font-bold mb-1">Topic</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-semibold text-[#201e1d]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[#645c50] font-bold mb-1">Formula (LaTeX)</label>
                  <input
                    type="text"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] font-mono text-xs text-[#201e1d]"
                  />
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <label className="block text-[#645c50] font-bold mb-1">Stem</label>
                  <textarea
                    rows={3}
                    value={stem}
                    onChange={(e) => setStem(e.target.value)}
                    className="w-full p-3 rounded-2xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] leading-relaxed outline-none focus:border-[#c67139]"
                  />
                </div>
              </div>

              {/* Options & Distractor Explanations */}
              <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-3 shadow-sm">
                <div className="grid grid-cols-[36px_140px_1fr] gap-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                  <span></span>
                  <span>Option</span>
                  <span>Why it&apos;s wrong (shown after answering)</span>
                </div>

                {options.map((opt, idx) => (
                  <div
                    key={opt.letter}
                    className="grid grid-cols-[36px_140px_1fr] gap-2.5 items-center text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleSetCorrectOption(idx)}
                      title={`Mark ${opt.letter} as correct`}
                      className={`w-8 h-8 rounded-full border-[1.5px] border-[#201e1d] font-heading font-black grid place-items-center transition-all ${
                        opt.isCorrect
                          ? 'bg-[#728157] text-[#f9f4ed]'
                          : 'bg-white text-[#201e1d] hover:bg-[#eee7db]'
                      }`}
                    >
                      {opt.letter}
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                      className={`px-3 py-2 rounded-xl bg-white border-[1.5px] text-xs font-bold text-[#201e1d] ${
                        opt.isCorrect ? 'border-[#728157] bg-[#f0fae1]' : 'border-[#dcd3c4]'
                      }`}
                    />
                    {opt.isCorrect ? (
                      <span className="text-[#3d472b] font-bold px-2 py-1 bg-[#f0fae1] rounded-lg border border-[#8fa073]/40 w-fit">
                        ✓ Correct answer
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={opt.reason}
                        onChange={(e) => handleOptionReasonChange(idx, e.target.value)}
                        placeholder="Misconception reason..."
                        className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs text-[#474238]"
                      />
                    )}
                  </div>
                ))}
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
              <div className="p-5 rounded-[28px] bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[3px_3px_0_#201e1d] flex flex-col gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                  Student preview
                </span>
                <span className="self-start px-2.5 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-[10px] font-bold">
                  Cambridge IGCSE Economics {paper} {session} Q{qNumber}
                </span>
                <p className="font-semibold text-xs text-[#201e1d] leading-snug">{stem}</p>

                {/* Formula Highlight */}
                <div className="p-2.5 rounded-xl bg-white border-[1.5px] border-dashed border-[#a19786] text-center font-serif italic text-sm text-[#201e1d]">
                  {formula}
                </div>

                {/* Options 2x2 Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                  {options.map((opt) => (
                    <button
                      key={opt.letter}
                      onClick={() => setSelectedPreviewOption(opt.letter)}
                      className={`p-2 rounded-full border-[1.5px] border-[#201e1d] text-left transition-all ${
                        selectedPreviewOption === opt.letter
                          ? 'bg-[#ccdbb2] text-[#272e1b] shadow-sm'
                          : 'bg-white text-[#201e1d] hover:bg-[#eee7db]'
                      }`}
                    >
                      {opt.letter} · {opt.text}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-[#645c50]">
                Verified Cambridge Past Paper Question · Syllabus 0455
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

      {/* ========================================================
          MODE 3: STAGED PAPER REVIEW
          ======================================================== */}
      {activeTab === 'staged' && (
        <div className="p-2">
          <StagingReview />
        </div>
      )}
    </div>
  );
}
