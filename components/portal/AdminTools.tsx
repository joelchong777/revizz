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
import { CAMBRIDGE_QUESTIONS } from '@/lib/questions';
import QuestionBankView from './QuestionBankView';

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
  const [aiPrompt, setAiPrompt] = useState('Build 10 Economics a homework round on their weakest Allocation of Resources subtopics');
  const [selectedClass, setSelectedClass] = useState('10 Economics · 26');
  const [subject, setSubject] = useState('📈 Economics 0455');
  const [topics, setTopics] = useState<string[]>([
    'The basic economic problem',
    'The allocation of resources',
    'Microeconomic decision makers',
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
    {
      id: CAMBRIDGE_QUESTIONS[0]?.id || '0455-s24-12-q01',
      stem: CAMBRIDGE_QUESTIONS[0]?.stem_markdown || 'Why will scarcity always exist?',
      topic: CAMBRIDGE_QUESTIONS[0]?.topic || 'The basic economic problem',
      acc: '78%',
      agent: false,
    },
    {
      id: CAMBRIDGE_QUESTIONS[1]?.id || '0455-s24-12-q02',
      stem: CAMBRIDGE_QUESTIONS[1]?.stem_markdown || 'A student decides to take up a two-year apprenticeship...',
      topic: CAMBRIDGE_QUESTIONS[1]?.topic || 'The basic economic problem',
      acc: '41%',
      agent: false,
    },
    {
      id: CAMBRIDGE_QUESTIONS[2]?.id || '0455-s24-12-q03',
      stem: CAMBRIDGE_QUESTIONS[2]?.stem_markdown || 'The diagram shows a country’s production possibility curve (PPC)...',
      topic: CAMBRIDGE_QUESTIONS[2]?.topic || 'The basic economic problem',
      acc: '38%',
      agent: false,
    },
    {
      id: CAMBRIDGE_QUESTIONS[3]?.id || '0455-s24-12-q04',
      stem: CAMBRIDGE_QUESTIONS[3]?.stem_markdown || 'What is not a macroeconomic topic?',
      topic: CAMBRIDGE_QUESTIONS[3]?.topic || 'The allocation of resources',
      acc: 'new',
      agent: true,
    },
    {
      id: CAMBRIDGE_QUESTIONS[4]?.id || '0455-s24-12-q05',
      stem: CAMBRIDGE_QUESTIONS[4]?.stem_markdown || 'What is likely to cause an extension in demand for a firm’s fruit drink?',
      topic: CAMBRIDGE_QUESTIONS[4]?.topic || 'The allocation of resources',
      acc: '52%',
      agent: false,
    },
  ];

  // Question Bank State (2f)
  const [bankSearch, setBankSearch] = useState('');
  const [bankStatusFilter, setBankStatusFilter] = useState<string>('All');

  const questionBankItems = CAMBRIDGE_QUESTIONS.map((q, idx) => {
    const qNum = idx + 1;
    let st: 'Live' | 'Agent draft' | 'Needs review' | 'Flagged' = 'Live';
    let stCls = 'bg-[#ccdbb2] text-[#272e1b]';

    if (qNum === 20 || qNum === 27) {
      st = 'Agent draft';
      stCls = 'bg-[#ffe1d0] text-[#8c491a]';
    } else if (qNum === 10 || qNum === 14) {
      st = 'Needs review';
      stCls = 'bg-[#eee7db] text-[#474238]';
    } else if (qNum === 3 || qNum === 6) {
      st = 'Flagged';
      stCls = 'bg-[#ffe1d0] text-[#643312]';
    }

    const difficulties: Array<'Easy' | 'Medium' | 'Hard'> = [
      'Easy', 'Easy', 'Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Hard', 'Medium', 'Medium',
      'Easy', 'Hard', 'Easy', 'Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Hard', 'Medium',
      'Easy', 'Medium', 'Easy', 'Hard', 'Medium', 'Easy', 'Hard', 'Hard', 'Medium', 'Hard'
    ];
    const accuracies = [
      '86%', '74%', '58%', '81%', '69%', '44%', '62%', '49%', '57%', '51%',
      '83%', '46%', '79%', '53%', '77%', '65%', '48%', '61%', '43%', '—',
      '82%', '67%', '76%', '55%', '63%', '88%', '—', '47%', '59%', '52%'
    ];
    const updateDates = [
      '2 Oct', '2 Oct', '7 Oct', '28 Sep', '28 Sep', 'Today', 'Today', '19 Sep', '2 Oct', '7 Oct',
      '28 Sep', '19 Sep', '2 Oct', '28 Sep', 'Today', '2 Oct', '19 Sep', '28 Sep', 'Today', 'Today',
      '2 Oct', '28 Sep', '2 Oct', '19 Sep', '28 Sep', '2 Oct', 'Today', '19 Sep', '28 Sep', '2 Oct'
    ];

    const diff = difficulties[idx] || 'Medium';
    const acc = accuracies[idx] || '65%';
    const upd = updateDates[idx] || '2 Oct';

    const cite = q.citation
      ? q.citation
          .replace('Cambridge IGCSE Economics ', '')
          .replace('May/June ', 'M/J/')
          .replace('October/November ', 'O/N/')
          .replace('Feb/March ', 'F/M/')
      : `0455/12 M/J/24 Q${qNum}`;

    return {
      id: q.id,
      stem: q.stem_markdown,
      cite,
      topic: q.topic || 'Economics',
      diff,
      acc,
      st,
      stCls,
      upd,
    };
  });

  const filteredBankItems = questionBankItems.filter(
    (q) =>
      (bankStatusFilter === 'All' || q.st === bankStatusFilter) &&
      (q.stem.toLowerCase().includes(bankSearch.toLowerCase()) ||
        q.id.toLowerCase().includes(bankSearch.toLowerCase()) ||
        q.topic.toLowerCase().includes(bankSearch.toLowerCase()))
  );

  const removeTopic = (topicName: string) => {
    setTopics(topics.filter((t) => t !== topicName));
  };

  const addTopic = () => {
    const newT = prompt('Enter subtopic name (e.g. Government and the macroeconomy):');
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
              Picked from the bank items 10 Economics missed most. The 1 new item stays in content review and
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
        <QuestionBankView 
          onOpenEditor={onOpenEditor || (() => {})} 
          onNavigateToCompiler={() => { window.location.href = '/portal?tab=compiler'; }} 
          onNavigateToImporter={() => { setActiveSubTab('importer'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} 
        />
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
