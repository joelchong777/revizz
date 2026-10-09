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

export interface AdminCMSProps {
  initialView?: 'editor' | 'flagged' | 'staged';
  questionId?: string;
}

export default function AdminCMS({
  initialView = 'editor',
  questionId = 'PHY-0502',
}: AdminCMSProps) {
  const [activeTab, setActiveTab] = useState<'editor' | 'flagged' | 'staged'>(initialView);

  // Question Editor state (2g)
  const [paper, setPaper] = useState('0625/12');
  const [session, setSession] = useState('M/J/24');
  const [qNumber, setQNumber] = useState('27');
  const [difficulty, setDifficulty] = useState('Hard');
  const [topic, setTopic] = useState('Electricity & magnetism · Resistance');
  const [formula, setFormula] = useState('\\frac{1}{R} = \\frac{1}{R_1} + \\frac{1}{R_2}');
  const [stem, setStem] = useState('Two resistors of 4.0 Ω and 6.0 Ω are connected in parallel. What is their combined resistance?');

  const [options, setOptions] = useState([
    { letter: 'A', text: '0.42 Ω', reason: 'Stops at 1/R = 0.42 and forgets to invert.', isCorrect: false },
    { letter: 'B', text: '2.4 Ω', reason: 'Correct answer', isCorrect: true },
    { letter: 'C', text: '5.0 Ω', reason: 'Averages the two resistors.', isCorrect: false },
    { letter: 'D', text: '10 Ω', reason: 'Adds them as if in series.', isCorrect: false },
  ]);

  const [explanationSteps, setExplanationSteps] = useState([
    'For resistors in parallel, 1/R = 1/R₁ + 1/R₂.',
    '1/R = 1/4.0 + 1/6.0 = 0.25 + 0.167 = 0.417 Ω⁻¹.',
    'R = 1 ÷ 0.417 = 2.4 Ω, which is less than the smaller resistor, as expected.',
  ]);

  const [selectedPreviewOption, setSelectedPreviewOption] = useState<string>('B');
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Flagged questions state (2h)
  const [selectedFlag, setSelectedFlag] = useState<string>('PHY-0418');
  const flaggedItems = [
    { id: 'PHY-0418', title: 'Free fall · stone dropped 20 m', reason: 'Answer seems wrong', n: 3, age: '2h', verdict: 'Not an error', vCls: 'bg-[#ccdbb2] text-[#272e1b]' },
    { id: 'CHM-0211', title: 'Moles of CO₂ from 4.4 g', reason: 'Two answers correct', n: 5, age: '1d', verdict: 'Likely valid', vCls: 'bg-[#ffe1d0] text-[#8c491a]' },
    { id: 'PHY-0377', title: 'Rate of evaporation', reason: 'Unclear wording', n: 2, age: '2d', verdict: 'Reword', vCls: 'bg-[#eee7db] text-[#474238]' },
    { id: 'ECO-0140', title: 'Price elasticity of demand', reason: 'Typo in option C', n: 1, age: '3d', verdict: 'Auto-fixable', vCls: 'bg-[#ccdbb2] text-[#272e1b]' },
    { id: 'BIO-0098', title: 'Enzyme optimum temperature', reason: 'Diagram missing', n: 4, age: '4d', verdict: 'Likely valid', vCls: 'bg-[#ffe1d0] text-[#8c491a]' },
  ];

  const studentReports = [
    { who: 'Student · 10A', when: '2h ago', text: 'Shouldn’t g be 9.8? I got 2.02 s, not 2.0 s.' },
    { who: 'Student · 10B', when: '5h ago', text: 'My calculator says 2.02 so I picked none of them.' },
    { who: 'Student · Global', when: '1d ago', text: 'Answer wrong??' },
  ];

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
          <span className="px-1.5 py-0.5 rounded-full bg-[#b2622d] text-white text-[10px]">8</span>
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
        <div className="flex flex-col gap-5">
          {/* Editor Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">
                Question bank / {questionId}
              </span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                Combined resistance in parallel
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-[#ffe1d0] text-[#8c491a] text-xs font-bold">
                Agent draft · needs human review
              </span>
              <button
                onClick={() => alert('Question draft rejected and sent back for revision.')}
                className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5"
              >
                Reject
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
              Question PHY-0502 successfully approved, verified and published to Live Bank!
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
                    <span>Answer checked numerically: 2.4 Ω</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#3d472b]">
                    <span className="font-black text-[#728157]">✓</span>
                    <span>Each distractor maps to a known misconception</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#8c491a]">
                    <span className="font-black">!</span>
                    <span>
                      Citation mismatch: in source paper, Q27 of 0625/12 M/J/24 is about a
                      transformer. Did you mean Q24?
                    </span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[#8c491a]">
                    <span className="font-black">!</span>
                    <span>82% similar to PHY-0288. Merge, or keep both as variants?</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    onClick={() => setQNumber('24')}
                    className="px-3 py-1 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5"
                  >
                    Fix citation → Q24
                  </button>
                  <button
                    onClick={() => alert('Comparing with PHY-0288...')}
                    className="px-3 py-1 rounded-full border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5"
                  >
                    Compare PHY-0288
                  </button>
                </div>
              </div>

              {/* Student Live Preview Card */}
              <div className="p-5 rounded-[28px] bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[3px_3px_0_#201e1d] flex flex-col gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                  Student preview
                </span>
                <span className="self-start px-2.5 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-[10px] font-bold">
                  Cambridge IGCSE Physics {paper} {session} Q{qNumber}
                </span>
                <p className="font-semibold text-xs text-[#201e1d] leading-snug">{stem}</p>

                {/* Formula Highlight */}
                <div className="p-2.5 rounded-xl bg-white border-[1.5px] border-dashed border-[#a19786] text-center font-serif italic text-sm text-[#201e1d]">
                  1/R = 1/R₁ + 1/R₂
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
                Drafted by agent from 10B&apos;s homework request · 9 Oct, 08:14 · version 2
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODE 2: FLAGGED & REPORTED QUESTIONS (Mockup 2h)
          ======================================================== */}
      {activeTab === 'flagged' && (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          {/* Reports List */}
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Flagged</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                8 open reports
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <span className="px-3 py-1 rounded-full bg-[#201e1d] text-[#f9f4ed]">Open</span>
              <span className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] text-[#645c50]">
                Agent-resolved 23
              </span>
              <span className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] text-[#645c50]">
                Closed
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {flaggedItems.map((f) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedFlag(f.id)}
                  className={`p-3.5 rounded-2xl border-[1.5px] cursor-pointer transition-all flex flex-col gap-1.5 ${
                    selectedFlag === f.id
                      ? 'bg-[#ffe1d0] border-[#201e1d] shadow-sm'
                      : 'bg-[#f9f4ed] border-[#dcd3c4] hover:bg-[#eee7db]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-[#201e1d]">{f.id}</span>
                    <span className="text-[11px] text-[#645c50]">
                      {f.n} reports · {f.age}
                    </span>
                  </div>
                  <span className="font-bold text-xs text-[#201e1d]">{f.title}</span>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#645c50] italic truncate">“{f.reason}”</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold ${f.vCls}`}>
                      {f.verdict}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Report Triage Detail */}
          <div className="flex flex-col gap-4">
            {/* Question Snapshot */}
            <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-[10px] font-bold">
                  0625/12 F/M/24 Q3
                </span>
                <span className="text-xs font-bold text-[#c67139] hover:underline cursor-pointer">
                  Open in editor →
                </span>
              </div>
              <p className="font-semibold text-xs text-[#201e1d] leading-relaxed">
                A stone is dropped from rest and hits the water 20 m below. Air resistance is
                negligible and g = 10 m/s². How long does the fall take?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold">
                <span className="p-2 rounded-full border-[1.5px] border-[#c0b6a5] text-center">
                  A · 1.0 s · 9%
                </span>
                <span className="p-2 rounded-full border-[1.5px] border-[#201e1d] bg-[#ccdbb2] text-center font-bold">
                  B · 2.0 s · 52%
                </span>
                <span className="p-2 rounded-full border-[1.5px] border-[#c0b6a5] text-center">
                  C · 4.0 s · 31%
                </span>
                <span className="p-2 rounded-full border-[1.5px] border-[#c0b6a5] text-center">
                  D · 0.5 s · 8%
                </span>
              </div>
            </div>

            {/* Student Reports List */}
            <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] shadow-sm">
              <span className="font-heading text-sm font-black text-[#201e1d] block mb-2">
                Student reports
              </span>
              <div className="divide-y divide-[#eee7db]">
                {studentReports.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 py-2 text-xs">
                    <span className="w-24 font-bold text-[#645c50] shrink-0">{r.who}</span>
                    <span className="flex-1 text-[#201e1d]">{r.text}</span>
                    <span className="text-[#82796a] text-[11px] shrink-0">{r.when}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent Triage Card */}
            <div className="p-5 rounded-3xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] flex flex-col gap-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#728157]" />
                <span className="font-heading text-sm font-black text-[#201e1d] flex-1">
                  Agent triage
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#272e1b] text-[10px] font-bold">
                  Not an error · high confidence
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#3d472b]">
                The stem gives g = 10 m/s², so the answer is 2.0 s. All 3 reporters used g = 9.8 and got
                2.02 s. 31% of students chose C (4.0 s) because they forgot the square root, which is
                the intended distractor.
              </p>
              <div className="p-2.5 rounded-xl bg-[#f9f4ed] border border-[#dcd3c4] text-xs text-[#201e1d]">
                <b>Suggested edit:</b> put <b>&ldquo;Take g = 10 m/s²&rdquo;</b> in its own sentence at
                the start of the stem, and add a note to explanation: &ldquo;Cambridge papers give the
                value of g to use.&rdquo;
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button
                  onClick={() => alert('Applied edit and sent clarification reply to reporting students!')}
                  className="px-3.5 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5"
                >
                  Apply edit &amp; reply to students
                </button>
                <button
                  onClick={() => alert('Reports dismissed')}
                  className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5"
                >
                  Dismiss reports
                </button>
                <button
                  onClick={() => alert('Escalated to senior syllabus examiner')}
                  className="text-xs font-bold text-[#645c50] hover:text-[#201e1d] px-2 py-1"
                >
                  Escalate
                </button>
              </div>
            </div>
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
