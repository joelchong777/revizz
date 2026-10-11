'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  Check, 
  ChevronDown,
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
import { motion, AnimatePresence } from 'framer-motion';
import IngestionHub from '@/components/portal/IngestionHub';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS } from '@/lib/questions';

export interface AdminToolsProps {
  initialView?: 'assign' | 'bank' | 'importer';
  onOpenEditor?: (questionId: string) => void;
}

interface BankFilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  minWidth?: string;
}

function BankFilterDropdown({
  label,
  value,
  onChange,
  options,
  minWidth = 'min-w-[180px]',
}: BankFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = value !== 'All';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const displayLabel = isActive ? `${label}: ${value}` : label;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
          isActive
            ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold'
            : 'bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
        }`}
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[180px]">{displayLabel}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          } ${isActive ? 'text-[#c67139]' : 'text-[#645c50]'}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-1.5 left-0 z-50 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-2xl p-1.5 ${minWidth} max-h-60 overflow-y-auto`}
          >
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-[#ffe1d0]/70' : ''
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#c67139] ml-2 shrink-0" />
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [bankPaperFilter, setBankPaperFilter] = useState<string>('All');
  const [bankSessionFilter, setBankSessionFilter] = useState<string>('All');
  const [bankTopicFilter, setBankTopicFilter] = useState<string>('All');
  const [bankDifficultyFilter, setBankDifficultyFilter] = useState<string>('All');
  const [bankPage, setBankPage] = useState(1);

  const paperOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: '0455/12 M/J/24', label: '0455/12 M/J/24' },
  ], []);

  const sessionOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: 'May/June 2024', label: 'May/June 2024' },
    { value: 'Feb/March 2024', label: 'Feb/March 2024' },
    { value: 'Oct/Nov 2024', label: 'Oct/Nov 2024' },
  ], []);

  const topicOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    ...CAMBRIDGE_TOPICS.map((t) => ({
      value: t.name,
      label: `${t.orderIndex}. ${t.name}`,
    })),
  ], []);

  const difficultyOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' },
  ], []);

  const statusOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: 'Live', label: 'Live' },
    { value: 'Agent draft', label: 'Agent draft' },
    { value: 'Needs review', label: 'Needs review' },
    { value: 'Flagged', label: 'Flagged' },
  ], []);

  const questionBankItems = useMemo(() => {
    return CAMBRIDGE_QUESTIONS.map((q, idx) => {
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

      const paper = '0455/12 M/J/24';
      const session = 'May/June 2024';

      return {
        id: q.id,
        stem: q.stem_markdown,
        cite,
        topic: q.topic || 'Economics',
        paper,
        session,
        diff,
        acc,
        st,
        stCls,
        upd,
      };
    });
  }, []);

  const filteredBankItems = useMemo(() => {
    return questionBankItems.filter((q) => {
      if (bankStatusFilter !== 'All' && q.st !== bankStatusFilter) {
        return false;
      }
      if (bankPaperFilter !== 'All' && q.paper !== bankPaperFilter) {
        return false;
      }
      if (bankSessionFilter !== 'All' && q.session !== bankSessionFilter) {
        return false;
      }
      if (bankTopicFilter !== 'All' && q.topic !== bankTopicFilter) {
        return false;
      }
      if (bankDifficultyFilter !== 'All' && q.diff !== bankDifficultyFilter) {
        return false;
      }
      if (bankSearch.trim()) {
        const query = bankSearch.toLowerCase();
        const matches =
          q.stem.toLowerCase().includes(query) ||
          q.id.toLowerCase().includes(query) ||
          q.cite.toLowerCase().includes(query) ||
          q.topic.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    questionBankItems,
    bankStatusFilter,
    bankPaperFilter,
    bankSessionFilter,
    bankTopicFilter,
    bankDifficultyFilter,
    bankSearch,
  ]);

  useEffect(() => {
    setBankPage(1);
  }, [
    bankSearch,
    bankStatusFilter,
    bankPaperFilter,
    bankSessionFilter,
    bankTopicFilter,
    bankDifficultyFilter,
  ]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredBankItems.length / pageSize));
  const paginatedBankItems = filteredBankItems.slice(
    (bankPage - 1) * pageSize,
    bankPage * pageSize
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
          🚀 Assign Rounds / Homework
        </button>
        <button
          onClick={() => setActiveSubTab('bank')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'bank'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          📚 Question Bank & Verification
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
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Question bank</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                {questionBankItems.length} questions
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  window.location.href = '/portal?tab=compiler';
                }}
                className="px-3.5 py-2 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs font-semibold text-[#3d472b] hover:bg-[#e1eecc] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Compile Test Paper (PDF)
              </button>
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
              Economics 0455 ✕
            </span>
            <BankFilterDropdown
              label="Paper"
              value={bankPaperFilter}
              onChange={setBankPaperFilter}
              options={paperOptions}
            />
            <BankFilterDropdown
              label="Session"
              value={bankSessionFilter}
              onChange={setBankSessionFilter}
              options={sessionOptions}
            />
            <BankFilterDropdown
              label="Topic"
              value={bankTopicFilter}
              onChange={setBankTopicFilter}
              options={topicOptions}
              minWidth="min-w-[260px]"
            />
            <BankFilterDropdown
              label="Difficulty"
              value={bankDifficultyFilter}
              onChange={setBankDifficultyFilter}
              options={difficultyOptions}
            />
            <BankFilterDropdown
              label="Status"
              value={bankStatusFilter}
              onChange={setBankStatusFilter}
              options={statusOptions}
            />
          </div>

          {/* Status Counter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            <button
              onClick={() => setBankStatusFilter('All')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'All' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              All {questionBankItems.length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Live')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Live' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Live {questionBankItems.filter((q) => q.st === 'Live').length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Agent draft')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                bankStatusFilter === 'Agent draft' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              <span>Agent drafts</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-[#f9f4ed] text-[10px]">
                {questionBankItems.filter((q) => q.st === 'Agent draft').length}
              </span>
            </button>
            <button
              onClick={() => setBankStatusFilter('Needs review')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Needs review' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Needs review {questionBankItems.filter((q) => q.st === 'Needs review').length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Flagged')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Flagged' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Flagged {questionBankItems.filter((q) => q.st === 'Flagged').length}
            </button>
          </div>

          {/* Bank Table */}
          <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[840px]">
                <div className="sticky top-0 z-10 bg-[#f9f4ed] grid grid-cols-[130px_2.4fr_1.1fr_1.2fr_0.7fr_0.6fr_0.9fr_0.6fr] gap-2 pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
                  <span>ID</span>
                  <span>Stem</span>
                  <span>Citation</span>
                  <span>Topic</span>
                  <span>Difficulty</span>
                  <span>1st try</span>
                  <span>Status</span>
                  <span>Updated</span>
                </div>

                <div className="max-h-[580px] overflow-y-auto divide-y divide-[#eee7db] pr-1">
                  {paginatedBankItems.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-[#645c50]">
                      No questions match the selected filters.
                    </div>
                  ) : (
                    paginatedBankItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={() => onOpenEditor?.(item.id)}
                        className="grid grid-cols-[130px_2.4fr_1.1fr_1.2fr_0.7fr_0.6fr_0.9fr_0.6fr] gap-2 items-center py-2.5 text-xs hover:bg-[#eee7db]/60 cursor-pointer rounded-xl transition-colors px-1"
                      >
                        <span className="font-mono font-bold text-[#201e1d] truncate" title={item.id}>{item.id}</span>
                        <span className="font-bold text-[#201e1d] truncate" title={item.stem}>
                          {item.stem}
                        </span>
                        <span className="text-[#645c50] truncate" title={item.cite}>{item.cite}</span>
                        <span className="text-[#474238] truncate" title={item.topic}>{item.topic}</span>
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
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Pagination Controls */}
            <div className="pt-3.5 mt-3 border-t border-[#dcd3c4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-[#645c50] font-medium">
                Showing {Math.min((bankPage - 1) * pageSize + 1, filteredBankItems.length)}–{Math.min(bankPage * pageSize, filteredBankItems.length)} of {filteredBankItems.length} questions
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBankPage((p) => Math.max(1, p - 1))}
                  disabled={bankPage === 1}
                  className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-40 disabled:cursor-not-allowed text-[#201e1d] font-bold text-xs transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[#645c50] font-medium px-1">
                  Page {bankPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setBankPage((p) => Math.min(totalPages, p + 1))}
                  disabled={bankPage === totalPages}
                  className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-40 disabled:cursor-not-allowed text-[#201e1d] font-bold text-xs transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Agent Actions Card */}
          <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs">
            <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
            <span className="flex-1 leading-snug text-[#201e1d]">
              <b>Bulk agent actions:</b> write explanations for items that have none · check
              citations against source papers · find near-duplicates
            </span>
            <button
              onClick={() => alert(`Agent scanning ${filteredBankItems.length} filtered questions in background...`)}
              className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#728157] font-bold text-xs text-[#3d472b] hover:bg-[#ccdbb2] active:translate-y-0.5 whitespace-nowrap"
            >
              Run on filtered ({filteredBankItems.length})
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
