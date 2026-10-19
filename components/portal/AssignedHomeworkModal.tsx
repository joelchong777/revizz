'use client';

import React, { useState, useMemo } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  Copy, 
  Calendar, 
  Clock, 
  Download, 
  Users, 
  HelpCircle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock4
} from 'lucide-react';
import { AssignedHomeworkRound, StudentSubmission, saveAssignedHomework } from '@/lib/portal/assignedHomework';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS, Question } from '@/lib/questions';
import { SUBJECT_CATALOG } from '@/lib/testCompiler';

interface NewHomeworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacherId: string;
  teacherName: string;
  onCreated?: (newRound: AssignedHomeworkRound) => void;
}

const DEFAULT_COHORTS = [
  '10B Physics',
  '10A Physics',
  '11A Physics',
  '10 Economics',
  '11 Economics',
  '10 Chemistry',
  '10 Biology',
];

const SUBJECT_TOPICS: Record<string, string[]> = {
  '0455': [
    'The basic economic problem',
    'The allocation of resources',
    'Microeconomic decision makers',
    'Government and the macroeconomy',
    'Economic development',
    'International trade and globalisation',
  ],
  '0625': [
    'General physics',
    'Thermal physics',
    'Properties of waves, including light and sound',
    'Electricity and magnetism',
    'Atomic physics',
    'Space physics',
  ],
  '0610': [
    'Characteristics and classification of living organisms',
    'Cell structure and organisation',
    'Movement into or out of cells',
    'Biological molecules',
    'Enzymes',
    'Plant and human nutrition',
  ],
  '0620': [
    'States of matter',
    'Atoms, elements and compounds',
    'Stoichiometry',
    'Chemical energetics',
    'Chemical reactions',
    'Acids, bases and salts',
  ],
};

export function NewHomeworkModal({
  isOpen,
  onClose,
  teacherId,
  teacherName,
  onCreated,
}: NewHomeworkModalProps) {
  const [cohortName, setCohortName] = useState('10B Physics');
  const [customCohort, setCustomCohort] = useState('');
  const [isCustomCohort, setIsCustomCohort] = useState(false);

  const [subjectCode, setSubjectCode] = useState('0625');
  const [title, setTitle] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(['Thermal physics', 'General physics']);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [timerMode, setTimerMode] = useState<'Chill' | 'Exam' | 'Standard'>('Exam');
  const [durationMinutes, setDurationMinutes] = useState<number>(15);
  
  // Set default due date to 5 days from now at 23:59
  const defaultDueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    d.setHours(23, 59, 0, 0);
    return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  }, []);
  const [dueDateString, setDueDateString] = useState(defaultDueDate);

  // Settings
  const [allowRetry, setAllowRetry] = useState(true);
  const [retryXpPercentage, setRetryXpPercentage] = useState(50);
  const [addToReviewPile, setAddToReviewPile] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [totalStudents, setTotalStudents] = useState<number>(0);

  // AI prompt assistant
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAppliedTag, setAiAppliedTag] = useState(false);

  // Subject details
  const currentSubject = useMemo(() => {
    return SUBJECT_CATALOG.find((s) => s.code === subjectCode) || {
      code: subjectCode,
      name: subjectCode === '0625' ? 'Physics' : subjectCode === '0455' ? 'Economics' : 'Science',
    };
  }, [subjectCode]);

  const availableTopics = useMemo(() => {
    return SUBJECT_TOPICS[subjectCode] || [
      'Core Principles',
      'Theory & Practice',
      'Data Analysis',
      'Exam Paper Review',
    ];
  }, [subjectCode]);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length > 1) {
        setSelectedTopics(selectedTopics.filter((t) => t !== topic));
      }
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  // Matched preview questions
  const previewQuestions = useMemo(() => {
    let pool = [...CAMBRIDGE_QUESTIONS];
    // Filter by topic if possible
    const topicFiltered = pool.filter((q) => q.topic && selectedTopics.includes(q.topic));
    if (topicFiltered.length > 0) {
      pool = topicFiltered;
    }
    return pool.slice(0, questionCount);
  }, [selectedTopics, questionCount]);

  const handleApplyAiPreset = (presetType: 'physics_exam' | 'econ_chill' | 'quick_5') => {
    setIsAiLoading(true);
    setTimeout(() => {
      if (presetType === 'physics_exam') {
        setSubjectCode('0625');
        setCohortName('10B Physics');
        setIsCustomCohort(false);
        setTitle('Kinematics & Thermal Motion Drill');
        setSelectedTopics(['Thermal physics', 'General physics']);
        setQuestionCount(10);
        setTimerMode('Exam');
        setDurationMinutes(15);
        setAllowRetry(true);
      } else if (presetType === 'econ_chill') {
        setSubjectCode('0455');
        setCohortName('10 Economics');
        setIsCustomCohort(false);
        setTitle('Macroeconomic Fiscal Policy & Inflation Quiz');
        setSelectedTopics(['Government and the macroeconomy', 'The allocation of resources']);
        setQuestionCount(8);
        setTimerMode('Chill');
        setDurationMinutes(0);
        setAllowRetry(true);
      } else {
        setSubjectCode('0455');
        setTitle('Microeconomics Flash Check');
        setSelectedTopics(['The basic economic problem']);
        setQuestionCount(5);
        setTimerMode('Standard');
        setDurationMinutes(5);
      }
      setAiAppliedTag(true);
      setIsAiLoading(false);
    }, 250);
  };

  const handlePublish = () => {
    const finalCohort = isCustomCohort && customCohort.trim() ? customCohort.trim() : cohortName;
    const testCodeNum = Math.floor(100 + Math.random() * 900);
    const testCode = `REV-${testCodeNum}`;
    const homeworkId = `hw-${Date.now()}-${testCode.toLowerCase()}`;

    // Extract real question IDs
    let qIds = previewQuestions.map((q) => q.id);
    if (qIds.length === 0) {
      qIds = CAMBRIDGE_QUESTIONS.slice(0, questionCount).map((q) => q.id);
    }

    const newRound: AssignedHomeworkRound = {
      id: homeworkId,
      teacherId,
      teacherName,
      title: title.trim() || `${currentSubject.name} Assignment`,
      subjectCode,
      subjectName: currentSubject.name,
      cohortName: finalCohort,
      testCode,
      createdAt: new Date().toISOString(),
      dueDate: new Date(dueDateString).toISOString(),
      durationMinutes: timerMode === 'Chill' ? null : durationMinutes,
      timerMode,
      roundLength: questionCount,
      topics: selectedTopics,
      questionIds: qIds,
      status: 'active',
      settings: {
        allowRetry,
        retryXpPercentage,
        addToReviewPile,
        shuffleOptions,
      },
      totalStudents: totalStudents || 0,
      submissions: [],
    };

    saveAssignedHomework(teacherId, newRound);
    if (onCreated) {
      onCreated(newRound);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#201e1d]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#f9f4ed] border-2 sm:border-3 border-[#201e1d] rounded-[24px] sm:rounded-[32px] shadow-[6px_6px_0_0_#201e1d] max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-homework-title"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 pb-4 border-b-2 border-[#201e1d] bg-[#fffaf5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl shrink-0">
              📝
            </div>
            <div>
              <h2 id="new-homework-title" className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                Assign Class Homework Round
              </h2>
              <p className="text-xs font-semibold text-[#645c50]">
                Private to your educator profile &bull; Instant student code generation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] hover:bg-[#ffe1d0] transition-colors cursor-pointer active:translate-y-0.5"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-sm">
          {/* AI Fast Preset Bar */}
          <div className="p-3 bg-[#e0f2fe] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d] space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-black text-[#0369a1] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Prompt Assistant &amp; Presets</span>
              </span>
              {aiAppliedTag && (
                <span className="text-[10px] font-bold bg-[#bae6fd] text-[#0369a1] px-2 py-0.5 rounded-full border border-[#0284c7]">
                  Config Applied ✨
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. 10 questions on Price Elasticity for 10 Economics due Friday"
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden focus:ring-2 focus:ring-[#0284c7]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleApplyAiPreset('physics_exam')}
                disabled={isAiLoading}
                className="px-2.5 py-1 text-xs font-bold bg-white text-[#201e1d] rounded-lg border-1.5 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#bae6fd] active:translate-y-0.5 cursor-pointer"
              >
                ⚡ 10B Physics Exam Drill (10Q)
              </button>
              <button
                type="button"
                onClick={() => handleApplyAiPreset('econ_chill')}
                disabled={isAiLoading}
                className="px-2.5 py-1 text-xs font-bold bg-white text-[#201e1d] rounded-lg border-1.5 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#bae6fd] active:translate-y-0.5 cursor-pointer"
              >
                🌿 10 Econ Fiscal Policy (Chill)
              </button>
              <button
                type="button"
                onClick={() => handleApplyAiPreset('quick_5')}
                disabled={isAiLoading}
                className="px-2.5 py-1 text-xs font-bold bg-white text-[#201e1d] rounded-lg border-1.5 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#bae6fd] active:translate-y-0.5 cursor-pointer"
              >
                🎯 5-Question Quick Check
              </button>
            </div>
          </div>

          {/* Title & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Assignment Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 2 Supply & Demand Quiz"
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden focus:ring-2 focus:ring-[#f97316]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Subject
              </label>
              <select
                value={subjectCode}
                onChange={(e) => {
                  const newCode = e.target.value;
                  setSubjectCode(newCode);
                  const subTopics = SUBJECT_TOPICS[newCode] || [];
                  setSelectedTopics(subTopics.slice(0, 2));
                }}
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden cursor-pointer"
              >
                {SUBJECT_CATALOG.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cohort Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Target Class / Cohort
              </label>
              <button
                type="button"
                onClick={() => setIsCustomCohort(!isCustomCohort)}
                className="text-xs font-bold text-[#f97316] hover:underline cursor-pointer"
              >
                {isCustomCohort ? 'Select from list' : '+ Custom class name'}
              </button>
            </div>
            {isCustomCohort ? (
              <input
                type="text"
                value={customCohort}
                onChange={(e) => setCustomCohort(e.target.value)}
                placeholder="e.g. 10C Accelerated Physics"
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COHORTS.map((c) => {
                  const active = cohortName === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCohortName(c)}
                      className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold text-xs transition-all cursor-pointer ${
                        active
                          ? 'bg-[#ffe1d0] text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] translate-y-[-1px]'
                          : 'bg-white text-[#645c50] hover:bg-[#fff5ee]'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Topics Multi-Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider flex items-center justify-between">
              <span>Syllabus Topics</span>
              <span className="text-[11px] font-semibold text-[#645c50]">
                {selectedTopics.length} selected
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-white border-2 border-[#201e1d] rounded-xl max-h-32 overflow-y-auto">
              {availableTopics.map((top) => {
                const isSelected = selectedTopics.includes(top);
                return (
                  <button
                    key={top}
                    type="button"
                    onClick={() => toggleTopic(top)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#fef08a] border-[#201e1d] text-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                        : 'bg-[#f9f4ed] border-[#e2d9cd] text-[#645c50] hover:bg-[#eee7db]'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {top}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Count & Timer Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Question count */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Question Count
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[5, 8, 10, 15, 20].map((num) => {
                  const active = questionCount === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`py-2 rounded-xl border-2 border-[#201e1d] font-black text-sm transition-all cursor-pointer ${
                        active
                          ? 'bg-[#fed7aa] text-[#431407] shadow-[2px_2px_0_0_#201e1d] translate-y-[-1px]'
                          : 'bg-white text-[#645c50] hover:bg-[#fff5ee]'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timer mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Timer & Exam Mode
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Exam', 'Standard', 'Chill'] as const).map((mode) => {
                  const active = timerMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setTimerMode(mode);
                        if (mode === 'Exam') setDurationMinutes(15);
                        else if (mode === 'Standard') setDurationMinutes(10);
                        else setDurationMinutes(0);
                      }}
                      className={`py-2 rounded-xl border-2 border-[#201e1d] font-black text-xs transition-all cursor-pointer ${
                        active
                          ? 'bg-[#ffe1d0] text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] translate-y-[-1px]'
                          : 'bg-white text-[#645c50] hover:bg-[#fff5ee]'
                      }`}
                    >
                      {mode === 'Exam' ? '⏱️ Exam' : mode === 'Standard' ? '⚡ Standard' : '🌿 Chill'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Due Date & Enrolled Count */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#f97316]" />
                <span>Due Date & Time</span>
              </label>
              <input
                type="datetime-local"
                value={dueDateString}
                onChange={(e) => setDueDateString(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black text-[#201e1d] uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#f97316]" />
                <span>Enrolled Class Size</span>
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={totalStudents || ''}
                onChange={(e) => setTotalStudents(parseInt(e.target.value, 10) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs"
              />
            </div>
          </div>

          {/* Rules & Switches */}
          <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d] space-y-2">
            <div className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
              Scoring & Pedagogical Rules
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-[#201e1d] cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRetry}
                  onChange={(e) => setAllowRetry(e.target.checked)}
                  className="rounded border-[#201e1d] text-[#f97316] focus:ring-[#f97316] w-4 h-4"
                />
                <span>Allow 2nd Try (50% XP)</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-[#201e1d] cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToReviewPile}
                  onChange={(e) => setAddToReviewPile(e.target.checked)}
                  className="rounded border-[#201e1d] text-[#f97316] focus:ring-[#f97316] w-4 h-4"
                />
                <span>Feed Spaced Review</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-[#201e1d] cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={(e) => setShuffleOptions(e.target.checked)}
                  className="rounded border-[#201e1d] text-[#f97316] focus:ring-[#f97316] w-4 h-4"
                />
                <span>Shuffle Distractors</span>
              </label>
            </div>
          </div>

          {/* Question preview strip */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Question Bank Preview ({previewQuestions.length} questions)
              </span>
              <span className="text-[11px] text-[#645c50] font-semibold">
                Cambridge IGCSE Verified
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {previewQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="p-2.5 bg-white border border-[#201e1d] rounded-xl text-xs font-medium text-[#201e1d] flex items-center justify-between gap-3 shadow-[1px_1px_0_0_#201e1d]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono font-black text-[11px] text-[#f97316] shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="truncate">{q.stem_markdown || 'Question stem preview'}</span>
                  </div>
                  {q.topic && (
                    <span className="px-2 py-0.5 rounded-full bg-[#fef08a] border border-[#201e1d] text-[10px] font-bold shrink-0">
                      {q.topic}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t-2 border-[#201e1d] bg-[#fffaf5] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[#645c50] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Assigned rounds will appear in this educator&apos;s unique history</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white font-bold text-xs text-[#201e1d] hover:bg-[#eee7db] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border-2 border-[#201e1d] bg-[#ffe1d0] hover:bg-[#ffc6a5] font-black text-xs sm:text-sm text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚀 Publish to Class</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Submissions Detail Modal
// ------------------------------------------------------------------------------------------------

interface SubmissionsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  homework: AssignedHomeworkRound | null;
}

export function SubmissionsDetailModal({
  isOpen,
  onClose,
  homework,
}: SubmissionsDetailModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen || !homework) return null;

  const completedCount = homework.submissions.length;
  const pendingCount = Math.max(0, homework.totalStudents - completedCount);
  const avgAccuracy = completedCount > 0
    ? Math.round(
        homework.submissions.reduce((acc, curr) => acc + curr.accuracyPercentage, 0) /
          completedCount
      )
    : 0;

  const copyStudentLink = () => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const link = `${origin}/?assignmentId=${encodeURIComponent(homework.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const exportCSV = () => {
    if (typeof window === 'undefined') return;
    const headers = [
      'Student Name',
      'Student ID',
      'Score',
      'Total Questions',
      'Accuracy %',
      'XP Earned',
      'Time Spent (s)',
      'Completed At',
    ];
    const rows = homework.submissions.map((s) => [
      `"${s.studentName}"`,
      `"${s.studentId}"`,
      s.score,
      s.totalQuestions,
      `${s.accuracyPercentage}%`,
      s.xpEarned,
      s.timeSpentSeconds,
      `"${s.completedAt}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${homework.testCode}_${homework.cohortName.replace(/\s+/g, '_')}_submissions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSubmissions = homework.submissions.filter((s) =>
    s.studentName.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#201e1d]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-[#f9f4ed] border-2 sm:border-3 border-[#201e1d] rounded-[24px] sm:rounded-[32px] shadow-[6px_6px_0_0_#201e1d] max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submissions-detail-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 pb-4 border-b-2 border-[#201e1d] bg-[#fffaf5] flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#fed7aa] border-1.5 border-[#201e1d] font-mono text-[11px] font-black text-[#431407]">
                {homework.testCode}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#fef08a] border-1.5 border-[#201e1d] text-[11px] font-black text-[#201e1d]">
                {homework.cohortName}
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] border-1.5 border-[#201e1d] text-[11px] font-bold text-[#645c50]">
                {homework.subjectCode} {homework.subjectName}
              </span>
            </div>
            <h2 id="submissions-detail-title" className="text-xl sm:text-2xl font-black text-[#201e1d] font-heading">
              {homework.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] hover:bg-[#ffe1d0] transition-colors cursor-pointer shrink-0 active:translate-y-0.5"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick KPI stats */}
        <div className="p-4 sm:p-6 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#fdf9f3] border-b-2 border-[#201e1d]">
          <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
            <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider">Completed</div>
            <div className="text-xl font-black text-[#201e1d] mt-0.5">
              {completedCount} <span className="text-xs font-semibold text-[#645c50]">/ {homework.totalStudents}</span>
            </div>
          </div>
          <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
            <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider">Pending</div>
            <div className="text-xl font-black text-[#f97316] mt-0.5">
              {pendingCount}
            </div>
          </div>
          <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
            <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider">Avg Accuracy</div>
            <div className="text-xl font-black text-[#15803d] mt-0.5">
              {avgAccuracy}%
            </div>
          </div>
          <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
            <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider">Due Date</div>
            <div className="text-xs font-bold text-[#201e1d] mt-1.5 truncate">
              {new Date(homework.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {/* Toolbar & Filter */}
        <div className="p-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#201e1d] bg-[#fffaf5]">
          <input
            type="text"
            placeholder="Search student name..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="px-3 py-1.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden min-w-[200px]"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyStudentLink}
              className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[#201e1d]" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Student Link'}</span>
            </button>
            <button
              type="button"
              onClick={exportCSV}
              disabled={completedCount === 0}
              className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#ffe1d0] text-xs font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#ffc6a5] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#201e1d]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Submissions List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
          {completedCount === 0 ? (
            <div className="p-8 text-center bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d] space-y-2">
              <div className="text-3xl">⏳</div>
              <h3 className="font-heading font-black text-base text-[#201e1d]">No submissions received yet.</h3>
              <p className="text-xs text-[#645c50] max-w-sm mx-auto">
                Share test code <b>{homework.testCode}</b> or the student link with your {homework.cohortName} cohort so students can complete the round!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubmissions.map((sub, idx) => {
                const minutes = Math.floor(sub.timeSpentSeconds / 60);
                const seconds = sub.timeSpentSeconds % 60;
                const timeString = `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;

                return (
                  <div
                    key={sub.studentId || idx}
                    className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#fef08a] border-1.5 border-[#201e1d] font-mono font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-black text-sm text-[#201e1d]">{sub.studentName}</div>
                        <div className="text-[11px] font-semibold text-[#645c50] flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock4 className="w-3 h-3" />
                            {timeString}
                          </span>
                          <span>&bull;</span>
                          <span>{new Date(sub.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <div className="text-xs font-black text-[#201e1d]">
                          {sub.score} / {sub.totalQuestions} marks
                        </div>
                        <div className="text-[10px] font-bold text-[#f97316]">
                          +{sub.xpEarned} XP
                        </div>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-xl border-1.5 border-[#201e1d] font-mono font-black text-xs ${
                          sub.accuracyPercentage >= 80
                            ? 'bg-[#bbf7d0] text-[#14532d]'
                            : sub.accuracyPercentage >= 60
                            ? 'bg-[#fef08a] text-[#713f12]'
                            : 'bg-[#fecdd3] text-[#881337]'
                        }`}
                      >
                        {sub.accuracyPercentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-[#201e1d] bg-[#fffaf5] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl border-2 border-[#201e1d] bg-[#ffe1d0] hover:bg-[#ffc6a5] font-black text-xs text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
