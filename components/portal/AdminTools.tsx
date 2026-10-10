'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  SlidersHorizontal, 
  BookOpen, 
  Upload, 
  Edit3, 
  Trash2,
  FileText,
  Filter
} from 'lucide-react';
import IngestionHub from '@/components/portal/IngestionHub';

export interface AdminToolsProps {
  initialView?: 'assign' | 'bank' | 'importer';
  onOpenEditor?: (questionId: string) => void;
}

export default function AdminTools({ 
  initialView = 'assign',
  onOpenEditor 
}: AdminToolsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'assign' | 'bank' | 'importer'>(initialView);

  // Homework Assigner State (2c)
  const [aiPrompt, setAiPrompt] = useState('Build 10B a homework round on their weakest Electricity subtopics');
  const [selectedClass, setSelectedClass] = useState('10B Physics · 26');
  const [subject, setSubject] = useState('⚛️ Physics 0625');
  const [topics, setTopics] = useState<string[]>([
    'Electricity · Resistance',
    'Electricity · Power',
    'Electricity · Circuits',
  ]);
  const [roundLength, setRoundLength] = useState<number | 'Custom'>(8);
  const [timerMode, setTimerMode] = useState<'Chill' | 'Exam'>('Exam');
  const [opensDate, setOpensDate] = useState('Mon 12 Oct · 08:00');
  const [dueDate, setDueDate] = useState('Fri 16 Oct · 18:00');
  const [retryCredited, setRetryCredited] = useState(true);
  const [addToReviewPile, setAddToReviewPile] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [scheduledSuccess, setScheduledSuccess] = useState(false);

  // Assigned Questions Dataset
  const assignQs = [
    { id: 'PHY-0502', stem: 'Two resistors of 4.0 Ω and 6.0 Ω in parallel…', topic: 'Electricity', acc: 'new', agent: true },
    { id: 'PHY-0244', stem: 'A lamp is rated 12 V, 24 W. What current does it draw…', topic: 'Electricity', acc: '41%', agent: false },
    { id: 'PHY-0251', stem: 'Which circuit has the lowest total resistance?', topic: 'Electricity', acc: '38%', agent: false },
    { id: 'PHY-0507', stem: 'A 3.0 Ω and 6.0 Ω resistor are in series with a 9.0 V cell…', topic: 'Electricity', acc: 'new', agent: true },
    { id: 'PHY-0262', stem: 'The p.d. across a resistor doubles. What happens to…', topic: 'Electricity', acc: '52%', agent: false },
  ];

  // Question Bank State (2f)
  const [bankSearch, setBankSearch] = useState('');
  const [bankStatusFilter, setBankStatusFilter] = useState<string>('All');

  const questionBankItems = [
    { id: 'PHY-0412', stem: 'A car starts from rest and accelerates uniformly…', cite: '0625/12 M/J/23 Q4', topic: 'Motion · Kinematics', diff: 'Easy', acc: '81%', st: 'Live', stCls: 'bg-[#ccdbb2] text-[#272e1b]', upd: '2 Oct' },
    { id: 'PHY-0413', stem: 'A car of mass 1200 kg has an acceleration of 2.5 m/s²…', cite: '0625/22 O/N/22 Q6', topic: 'Motion · Forces', diff: 'Medium', acc: '64%', st: 'Live', stCls: 'bg-[#ccdbb2] text-[#272e1b]', upd: '2 Oct' },
    { id: 'PHY-0418', stem: 'A stone is dropped from rest and hits the water 20 m below…', cite: '0625/12 F/M/24 Q3', topic: 'Motion · Free fall', diff: 'Medium', acc: '52%', st: 'Flagged', stCls: 'bg-[#ffe1d0] text-[#643312]', upd: '7 Oct' },
    { id: 'PHY-0421', stem: 'A metal block has a mass of 540 g and a volume of 200 cm³…', cite: '0625/22 M/J/22 Q5', topic: 'Motion · Density', diff: 'Easy', acc: '77%', st: 'Live', stCls: 'bg-[#ccdbb2] text-[#272e1b]', upd: '28 Sep' },
    { id: 'PHY-0430', stem: 'A trolley of mass 2.0 kg moves at 3.0 m/s…', cite: '0625/12 O/N/23 Q9', topic: 'Motion · Energy', diff: 'Easy', acc: '69%', st: 'Live', stCls: 'bg-[#ccdbb2] text-[#272e1b]', upd: '28 Sep' },
    { id: 'PHY-0502', stem: 'Two resistors of 4.0 Ω and 6.0 Ω are connected in parallel…', cite: '0625/12 M/J/24 Q27', topic: 'Electricity · Resistance', diff: 'Hard', acc: '—', st: 'Agent draft', stCls: 'bg-[#ffe1d0] text-[#8c491a]', upd: 'Today' },
    { id: 'PHY-0503', stem: 'A wave has a frequency of 50 Hz and a wavelength of…', cite: '0625/22 M/J/24 Q19', topic: 'Waves · Properties', diff: 'Medium', acc: '—', st: 'Agent draft', stCls: 'bg-[#ffe1d0] text-[#8c491a]', upd: 'Today' },
    { id: 'PHY-0377', stem: 'Which change increases the rate of evaporation of a liquid?', cite: '0625/12 O/N/21 Q14', topic: 'Thermal · Particles', diff: 'Medium', acc: '58%', st: 'Needs review', stCls: 'bg-[#eee7db] text-[#474238]', upd: '19 Sep' },
  ];


  const removeTopic = (topicName: string) => {
    setTopics(topics.filter((t) => t !== topicName));
  };

  const addTopic = () => {
    const newT = prompt('Enter subtopic name (e.g. Electricity · Potential Difference):');
    if (newT && !topics.includes(newT)) {
      setTopics([...topics, newT]);
    }
  };

  const handleScheduleRound = () => {
    setScheduledSuccess(true);
    setTimeout(() => setScheduledSuccess(false), 4000);
  };

  return (
    <div className="flex flex-col gap-6 p-2 sm:p-4 text-[#201e1d] font-body">
      {/* Top View Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-[#dcd3c4] pb-2 flex-wrap">
        <button
          onClick={() => setActiveSubTab('assign')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'assign'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          🚀 Assign Rounds / Homework (2c)
        </button>
        <button
          onClick={() => setActiveSubTab('bank')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'bank'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          📚 Question Bank (2f)
        </button>
        <button
          onClick={() => setActiveSubTab('importer')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'importer'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          📦 Ingestion Studio
        </button>
      </div>

      {/* ========================================================
          SUB-TAB 1: ASSIGN ROUNDS & HOMEWORK (Mockup 2c)
          ======================================================== */}
      {activeSubTab === 'assign' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left: Assigner Form */}
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Assign rounds / New</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                New homework round
              </h2>
            </div>

            {/* Natural language AI Assignment Bar */}
            <div className="flex items-center gap-2.5 p-2.5 pl-4 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs shadow-sm">
              <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 bg-transparent font-medium text-[#201e1d] outline-none text-xs sm:text-sm"
              />
              <span className="px-3 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] font-bold text-xs shrink-0 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Agent filled this
              </span>
            </div>

            {/* Form Container */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-sm">
              {/* Assign To */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Assign to</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-xs font-bold">
                    {selectedClass}
                  </span>
                  <button
                    onClick={() => {
                      const next = prompt('Enter class name or student email:');
                      if (next) setSelectedClass(next);
                    }}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-dashed border-[#a19786] text-xs font-semibold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    + class or student
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Subject</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d]">
                  {subject}
                </div>
              </div>

              {/* Topics */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Topics</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-full bg-[#ffe1d0] text-[#643312] text-xs font-bold flex items-center gap-1.5"
                    >
                      {t}
                      <button
                        onClick={() => removeTopic(t)}
                        className="hover:text-red-600 transition-colors"
                        title="Remove topic"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={addTopic}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-dashed border-[#a19786] text-xs font-semibold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    + topic
                  </button>
                </div>
              </div>

              {/* Round Length */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Round length</label>
                <div className="flex items-center gap-1.5">
                  {[5, 8, 10, 'Custom'].map((len) => (
                    <button
                      key={len}
                      onClick={() => setRoundLength(len as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        roundLength === len
                          ? 'bg-[#201e1d] text-[#f9f4ed]'
                          : 'border-[1.5px] border-[#c0b6a5] bg-white text-[#474238] hover:bg-[#eee7db]'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer Mode */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Timer</label>
                <div className="flex items-center gap-1.5">
                  {(['Chill', 'Exam'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTimerMode(mode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        timerMode === mode
                          ? 'bg-[#201e1d] text-[#f9f4ed]'
                          : 'border-[1.5px] border-[#c0b6a5] bg-white text-[#474238] hover:bg-[#eee7db]'
                      }`}
                    >
                      {mode === 'Chill' ? 'Chill (Untimed)' : 'Exam · 90 s / Q'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opens Date */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Opens</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] flex items-center justify-between">
                  <span>{opensDate}</span>
                  <Calendar className="w-3.5 h-3.5 text-[#82796a]" />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Due</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] flex items-center justify-between">
                  <span>{dueDate}</span>
                  <Clock className="w-3.5 h-3.5 text-[#82796a]" />
                </div>
              </div>

              {/* Settings Toggles */}
              <div className="sm:col-span-2 flex flex-col gap-2.5 pt-2 border-t border-[#dcd3c4]">
                {/* 1 retry at 50% XP */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setRetryCredited(!retryCredited)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      retryCredited ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        retryCredited ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">1 retry at 50% XP</span>
                  <span className="text-[#645c50] text-[11px]">School default</span>
                </div>

                {/* Add misses to Review Pile */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setAddToReviewPile(!addToReviewPile)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      addToReviewPile ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        addToReviewPile ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">Add misses to each student&apos;s Review Pile</span>
                </div>

                {/* Shuffle option order */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setShuffleOptions(!shuffleOptions)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      shuffleOptions ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        shuffleOptions ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">Shuffle option order per student</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2.5">
              {scheduledSuccess && (
                <span className="text-xs font-bold text-[#56633f] flex items-center gap-1">
                  <Check className="w-4 h-4" /> Homework round scheduled!
                </span>
              )}
              <button
                onClick={() => alert('Draft saved successfully!')}
                className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5"
              >
                Save draft
              </button>
              <button
                onClick={handleScheduleRound}
                className="px-5 py-2.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-sm font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none"
              >
                Schedule for 26 students
              </button>
            </div>
          </div>

          {/* Right: Selected Questions Preview */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-black text-[#201e1d]">
                Questions · {roundLength === 'Custom' ? assignQs.length : roundLength}
              </span>
              <button
                onClick={() => setActiveSubTab('bank')}
                className="text-xs font-bold text-[#c67139] hover:underline"
              >
                Swap with bank
              </button>
            </div>
            <p className="text-xs text-[#645c50] leading-snug">
              Picked from the bank items 10B missed most. The 2 new items stay in content review and
              can&apos;t go live until approved.
            </p>

            <div className="flex flex-col gap-2 divide-y divide-[#eee7db]">
              {assignQs.map((q, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenEditor?.(q.id)}
                  className="pt-2 flex items-start gap-2 text-xs hover:bg-[#eee7db]/50 p-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-[#645c50] block">
                      {q.id} · {q.topic}
                    </span>
                    <span className="font-semibold text-[#201e1d] line-clamp-2 leading-tight">
                      {q.stem}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {q.agent && (
                      <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#272e1b] text-[10px] font-bold">
                        Agent · new
                      </span>
                    )}
                    <span className="font-black text-[#201e1d]">{q.acc}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 text-xs text-[#645c50] font-medium border-t border-[#dcd3c4]">
              + 3 more questions · estimated 12 min round
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: QUESTION BANK BROWSER (Mockup 2f)
          ======================================================== */}
      {activeSubTab === 'bank' && (
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Question bank</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                4,218 questions
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setActiveSubTab('importer');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" /> Import paper (PDF)
              </button>
              <button
                onClick={() => onOpenEditor?.('new')}
                className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-xs font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New question
              </button>
            </div>
          </div>

          {/* Search & Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a]" />
              <input
                type="text"
                placeholder="Search stems, IDs, citations..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139]"
              />
            </div>
            <span className="px-3 py-1.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-xs font-bold">
              Physics 0625 ✕
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-semibold cursor-pointer">
              Paper ▾
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-semibold cursor-pointer">
              Session ▾
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-semibold cursor-pointer">
              Topic ▾
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-semibold cursor-pointer">
              Difficulty ▾
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-semibold cursor-pointer">
              Status ▾
            </span>
          </div>

          {/* Status Counter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            <button
              onClick={() => setBankStatusFilter('All')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'All' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              All 1,186
            </button>
            <button
              onClick={() => setBankStatusFilter('Live')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Live' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Live 1,104
            </button>
            <button
              onClick={() => setBankStatusFilter('Agent draft')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                bankStatusFilter === 'Agent draft' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              <span>Agent drafts</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-[#f9f4ed] text-[10px]">12</span>
            </button>
            <button
              onClick={() => setBankStatusFilter('Needs review')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Needs review' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Needs review 61
            </button>
            <button
              onClick={() => setBankStatusFilter('Flagged')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Flagged' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Flagged 9
            </button>
          </div>

          {/* Bank Table */}
          <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[80px_2.4fr_1.1fr_1.2fr_0.7fr_0.6fr_0.9fr_0.6fr] gap-2 pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
                  <span>ID</span>
                  <span>Stem</span>
                  <span>Citation</span>
                  <span>Topic</span>
                  <span>Difficulty</span>
                  <span>1st try</span>
                  <span>Status</span>
                  <span>Updated</span>
                </div>

                <div className="divide-y divide-[#eee7db]">
                  {questionBankItems
                    .filter(
                      (q) =>
                        (bankStatusFilter === 'All' || q.st === bankStatusFilter) &&
                        (q.stem.toLowerCase().includes(bankSearch.toLowerCase()) ||
                          q.id.toLowerCase().includes(bankSearch.toLowerCase()) ||
                          q.topic.toLowerCase().includes(bankSearch.toLowerCase()))
                    )
                    .map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => onOpenEditor?.(item.id)}
                        className="grid grid-cols-[80px_2.4fr_1.1fr_1.2fr_0.7fr_0.6fr_0.9fr_0.6fr] gap-2 items-center py-2.5 text-xs hover:bg-[#eee7db]/60 cursor-pointer rounded-xl transition-colors px-1"
                      >
                        <span className="font-mono font-bold text-[#201e1d]">{item.id}</span>
                        <span className="font-bold text-[#201e1d] truncate" title={item.stem}>
                          {item.stem}
                        </span>
                        <span className="text-[#645c50] truncate">{item.cite}</span>
                        <span className="text-[#474238] truncate">{item.topic}</span>
                        <span className="font-medium">{item.diff}</span>
                        <span className="font-black text-[#201e1d]">{item.acc}</span>
                        <span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${item.stCls}`}
                          >
                            {item.st}
                          </span>
                        </span>
                        <span className="text-[#645c50]">{item.upd}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Agent Actions Card */}
          <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs">
            <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
            <span className="flex-1 leading-snug text-[#201e1d]">
              <b>Bulk agent actions:</b> write explanations for the 38 Live items that have none · check
              citations against source papers · find near-duplicates
            </span>
            <button
              onClick={() => alert('Agent scanning 1,186 filtered questions in background...')}
              className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#728157] font-bold text-xs text-[#3d472b] hover:bg-[#ccdbb2] active:translate-y-0.5 whitespace-nowrap"
            >
              Run on filtered (1,186)
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 3: INGESTION STUDIO
          ======================================================== */}
      {activeSubTab === 'importer' && (
        <div className="w-full">
          <IngestionHub />
        </div>
      )}
    </div>
  );
}
