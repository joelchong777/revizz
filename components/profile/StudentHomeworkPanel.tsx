'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RichMarkdown } from '@/components/ui/RichMarkdown';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Award,
  HelpCircle,
  Zap,
  TrendingUp,
  FileCheck2,
  Eye,
} from 'lucide-react';

import { Question } from '@/lib/questions';
import { applyReveal, gradeHomework, labelOf } from '@/lib/quizApi';
import type { AnswerReveal } from '@/types/quiz';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { playChime, playFanfare, playPop } from '@/lib/audio';
import {
  HomeworkItem,
  HomeworkStatus,
  HomeworkSubmission,
  getHomeworkAssignments,
  saveHomeworkSubmission,
  subscribeHomeworkChanges,
  findAssignmentByTestCode,
} from '@/lib/homework';
import { OnlineQuizAssignment } from '@/types/testCompiler';

interface StudentHomeworkPanelProps {
  questions?: Question[];
}

type FilterTab = 'all' | 'pending' | 'completed' | 'overdue';

function getGradeBadge(percentage: number): { grade: string; color: string; border: string } {
  if (percentage >= 90) return { grade: 'Grade A*', color: 'bg-[#86EFAC] text-[#14532D]', border: 'border-[#16A34A]' };
  if (percentage >= 80) return { grade: 'Grade A', color: 'bg-[#BBF7D0] text-[#14532D]', border: 'border-[#22C55E]' };
  if (percentage >= 70) return { grade: 'Grade B', color: 'bg-[#FEF08A] text-[#713F12]', border: 'border-[#EAB308]' };
  if (percentage >= 60) return { grade: 'Grade C', color: 'bg-[#FED7AA] text-[#7C2D12]', border: 'border-[#F97316]' };
  if (percentage >= 50) return { grade: 'Grade D', color: 'bg-[#FECDD3] text-[#881337]', border: 'border-[#FB7185]' };
  return { grade: 'Grade E/U', color: 'bg-[#FEE2E2] text-[#991B1B]', border: 'border-[#F87171]' };
}

function formatDueDateBadge(item: HomeworkItem): { text: string; badgeClass: string; isUrgent: boolean } {
  if (item.status === 'completed' && item.submission) {
    const d = new Date(item.submission.completedAt);
    const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return {
      text: `Completed on ${dateStr}`,
      badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#86EFAC]',
      isUrgent: false,
    };
  }

  if (item.status === 'overdue') {
    const daysAgo = Math.abs(item.daysRemaining);
    return {
      text: daysAgo === 0 ? 'Overdue today' : `Overdue by ${daysAgo}d`,
      badgeClass: 'bg-[#FFE4E6] text-[#9F1239] border-[#FDA4AF]',
      isUrgent: true,
    };
  }

  if (item.daysRemaining === 0) {
    return {
      text: 'Due today!',
      badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]',
      isUrgent: true,
    };
  }

  if (item.daysRemaining === 1) {
    return {
      text: 'Due tomorrow',
      badgeClass: 'bg-[#FEF9C3] text-[#854D0E] border-[#FACC15]',
      isUrgent: false,
    };
  }

  return {
    text: `Due in ${item.daysRemaining} days`,
    badgeClass: 'bg-[#EFF6FF] text-[#1E40AF] border-[#93C5FD]',
    isUrgent: false,
  };
}

function formatTimeSpent(totalSeconds?: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '< 1 min';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function StudentHomeworkPanel({ questions = [] }: StudentHomeworkPanelProps): React.ReactElement {
  // =========================================================================
  // Unconditional React hook declarations (React Error #310 Defense)
  // =========================================================================
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [quickCodeInput, setQuickCodeInput] = useState<string>('');
  const [quickCodeError, setQuickCodeError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Active runner modal state
  const [activeModalItem, setActiveModalItem] = useState<OnlineQuizAssignment | null>(null);
  const [modalMode, setModalMode] = useState<'quiz' | 'review' | 'result'>('quiz');
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [quizTimeRemaining, setQuizTimeRemaining] = useState<number>(0);
  const [quizTimerActive, setQuizTimerActive] = useState<boolean>(false);
  const [quizSubmittedResult, setQuizSubmittedResult] = useState<HomeworkSubmission | null>(null);

  // Answer keys revealed by the server after grading (never shipped with the questions)
  const [reveals, setReveals] = useState<Record<string, AnswerReveal>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  // Pool of available questions
  const questionPool = useMemo(() => questions || [], [questions]);

  // Load and subscribe to homework changes
  const reloadHomework = useCallback(() => {
    const items = getHomeworkAssignments(questionPool);
    setHomeworkList(items);
  }, [questionPool]);

  useEffect(() => {
    reloadHomework();
    const unsubscribe = subscribeHomeworkChanges(() => {
      reloadHomework();
    });
    return () => unsubscribe();
  }, [reloadHomework]);

  // Quick-code search handler
  const handleQuickJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setQuickCodeError(null);
    const code = quickCodeInput.trim().toUpperCase();
    if (!code) {
      setQuickCodeError('Please enter a test code (e.g. REV-101).');
      return;
    }
    const found = findAssignmentByTestCode(code);
    if (!found) {
      setQuickCodeError(`Test code "${code}" not found. Verify the code with your teacher.`);
      return;
    }

    // Check if already completed
    const existing = homeworkList.find(
      (h) => (h.testCode.toUpperCase() === code || h.id.toUpperCase() === code) && h.submission
    );

    setQuickCodeInput('');
    openModalForAssignment(found, existing?.submission ? 'review' : 'quiz', existing?.submission);
  };

  // Open modal runner for an assignment
  const openModalForAssignment = (
    assignment: OnlineQuizAssignment,
    mode: 'quiz' | 'review',
    existingSubmission?: HomeworkSubmission
  ) => {
    playPop();
    setActiveModalItem(assignment);
    setCurrentQuestionIdx(0);
    setModalMode(mode);

    if (mode === 'quiz') {
      setSelectedAnswers({});
      setQuizTimeRemaining(assignment.durationMinutes * 60);
      setQuizTimerActive(true);
      setQuizSubmittedResult(null);
    } else {
      setQuizTimerActive(false);
      setSelectedAnswers(existingSubmission?.answers || {});
      setQuizSubmittedResult(existingSubmission || null);
      if (existingSubmission) {
        const qs = assignment.questionIds
          .map((id) => questionPool.find((q) => q.id === id))
          .filter((q): q is Question => Boolean(q));
        gradeAnswers(qs, existingSubmission.answers || {})
          .then(({ found }) => setReveals((prev) => ({ ...prev, ...found })))
          .catch(() => setGradeError('Could not load the answer key. Try again later.'));
      }
    }
    setGradeError(null);
  };

  const closeModal = () => {
    playPop();
    setActiveModalItem(null);
    setQuizTimerActive(false);
    setQuizSubmittedResult(null);
    reloadHomework();
  };

  // Timer countdown hook
  useEffect(() => {
    if (!quizTimerActive || quizTimeRemaining <= 0) return;

    const interval = setInterval(() => {
      setQuizTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setQuizTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [quizTimerActive, quizTimeRemaining]);

  // Copy code helper
  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    playPop();
    setTimeout(() => {
      setCopiedCode(null);
    }, 2000);
  };

  // Resolve questions for active modal assignment
  const modalQuestions = useMemo(() => {
    if (!activeModalItem) return [];
    return activeModalItem.questionIds
      .map((id) => questionPool.find((q) => q.id === id))
      .filter((q): q is Question => Boolean(q))
      .map((q) => (reveals[q.id] ? applyReveal(q, reveals[q.id]) : q));
  }, [activeModalItem, questionPool, reveals]);

  // Grade answers on the server (no writes). Returns score and per-question reveals.
  const gradeAnswers = async (qs: Question[], answers: Record<string, string>) => {
    let score = 0;
    const found: Record<string, AnswerReveal> = {};
    for (let i = 0; i < qs.length; i += 60) {
      const chunk = qs.slice(i, i + 60);
      const resp = await gradeHomework(
        chunk.map((q) => ({
          questionId: q.id,
          optionLabel: answers[q.id] ? labelOf(q, answers[q.id]) : null,
        }))
      );
      score += resp.score;
      for (const r of resp.results) found[r.questionId] = r.reveal;
    }
    return { score, found };
  };

  // Handle quiz answer selection
  const handleSelectOption = (questionId: string, optionId: string) => {
    if (modalMode !== 'quiz') return;
    playPop();
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  // Handle quiz submission
  const handleSubmitQuiz = async () => {
    if (!activeModalItem || isGrading) return;

    const totalQuestions = modalQuestions.length;
    let score = 0;
    setIsGrading(true);
    setGradeError(null);
    try {
      const graded = await gradeAnswers(modalQuestions, selectedAnswers);
      score = graded.score;
      setReveals((prev) => ({ ...prev, ...graded.found }));
    } catch {
      setGradeError('Could not submit. Check your connection and try again.');
      setIsGrading(false);
      return;
    }
    setIsGrading(false);

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const timeSpentSeconds = Math.max(0, activeModalItem.durationMinutes * 60 - quizTimeRemaining);

    const submission: HomeworkSubmission = {
      assignmentId: activeModalItem.id,
      testCode: activeModalItem.testCode,
      completedAt: new Date().toISOString(),
      score,
      totalQuestions,
      percentage,
      timeSpentSeconds,
      answers: selectedAnswers,
    };

    saveHomeworkSubmission(submission);
    setQuizSubmittedResult(submission);
    setQuizTimerActive(false);
    setModalMode('result');

    // Feedback: Audio + Confetti
    if (percentage >= 70) {
      playFanfare();
    } else {
      playChime();
    }

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.6 },
          colors: ['#FEF08A', '#86EFAC', '#93C5FD', '#201e1d', '#FB7185'],
        });
      }
    }

    reloadHomework();
  };

  // Stats calculations
  const totalAssigned = homeworkList.length;
  const pendingCount = homeworkList.filter((h) => h.status === 'pending').length;
  const overdueCount = homeworkList.filter((h) => h.status === 'overdue').length;
  const completedCount = homeworkList.filter((h) => h.status === 'completed').length;
  const todoCount = pendingCount + overdueCount;

  const averageAccuracy = useMemo(() => {
    const completedItems = homeworkList.filter((h) => h.submission);
    if (completedItems.length === 0) return null;
    const sum = completedItems.reduce((acc, curr) => acc + (curr.submission?.percentage || 0), 0);
    return Math.round(sum / completedItems.length);
  }, [homeworkList]);

  // Unique subjects for filter chips
  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    homeworkList.forEach((h) => {
      map.set(h.subjectCode, h.subjectName);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [homeworkList]);

  // Filtered assignments
  const filteredHomework = useMemo(() => {
    return homeworkList
      .filter((item) => {
        // Tab filter: 'pending' shows all tasks needing completion (pending + overdue)
        if (filterTab === 'pending' && item.status === 'completed') return false;
        if (filterTab === 'completed' && item.status !== 'completed') return false;
        if (filterTab === 'overdue' && item.status !== 'overdue') return false;

        // Subject filter
        if (selectedSubject !== 'all' && item.subjectCode !== selectedSubject) return false;

        // Search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(query);
          const matchCode = item.testCode.toLowerCase().includes(query);
          const matchCohort = item.cohortName.toLowerCase().includes(query);
          const matchSubject = item.subjectName.toLowerCase().includes(query);
          if (!matchTitle && !matchCode && !matchCohort && !matchSubject) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort: overdue first, then pending by closest due date, then completed
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (b.status === 'overdue' && a.status !== 'overdue') return 1;
        if (a.status === 'pending' && b.status === 'completed') return -1;
        if (b.status === 'pending' && a.status === 'completed') return 1;
        return a.daysRemaining - b.daysRemaining;
      });
  }, [homeworkList, filterTab, selectedSubject, searchQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 select-none pb-12">
      {/* ===================================================================
          1. TOP STATS BAR
         =================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Assigned */}
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-heading font-black text-neutral-500 uppercase tracking-wider">
              Total Assigned
            </span>
            <span className="w-6 h-6 rounded-lg bg-[#FEF08A] border border-[#201e1d] flex items-center justify-center text-xs">
              📋
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#201e1d]">{totalAssigned}</span>
            <span className="text-xs font-bold text-neutral-600">tasks</span>
          </div>
        </div>

        {/* To Do / Action Needed */}
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-heading font-black text-neutral-500 uppercase tracking-wider">
              To Do
            </span>
            {overdueCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-[#FFE4E6] text-[#9F1239] border border-[#FDA4AF] text-[10px] font-black">
                {overdueCount} overdue
              </span>
            ) : (
              <span className="w-6 h-6 rounded-lg bg-[#EFF6FF] border border-[#201e1d] flex items-center justify-center text-xs">
                ⏳
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-heading font-black ${overdueCount > 0 ? 'text-[#E11D48]' : 'text-[#201e1d]'}`}>
              {todoCount}
            </span>
            <span className="text-xs font-bold text-neutral-600">pending</span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-heading font-black text-neutral-500 uppercase tracking-wider">
              Completed
            </span>
            <span className="w-6 h-6 rounded-lg bg-[#DCFCE7] border border-[#201e1d] flex items-center justify-center text-xs">
              ✅
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#16A34A]">{completedCount}</span>
            <span className="text-xs font-bold text-neutral-600">done</span>
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-heading font-black text-neutral-500 uppercase tracking-wider">
              Average Score
            </span>
            <span className="w-6 h-6 rounded-lg bg-[#C7D2FE] border border-[#201e1d] flex items-center justify-center text-xs">
              🎯
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-heading font-black text-[#2563EB]">
              {averageAccuracy !== null ? `${averageAccuracy}%` : '--'}
            </span>
            <span className="text-xs font-bold text-neutral-600">accuracy</span>
          </div>
        </div>
      </div>

      {/* ===================================================================
          2. QUICK-JOIN / TEST CODE SEARCH CARD
         =================================================================== */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
          <div className="space-y-0.5">
            <h2 className="text-base sm:text-lg font-heading font-black text-[#201e1d] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#EAB308]" />
              Quick-Join Assignment
            </h2>
            <p className="text-xs font-medium text-neutral-600">
              Enter the unique test code provided by your teacher to jump straight into the assessment.
            </p>
          </div>
        </div>

        <form onSubmit={handleQuickJoin} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={quickCodeInput}
              onChange={(e) => {
                setQuickCodeInput(e.target.value.toUpperCase());
                if (quickCodeError) setQuickCodeError(null);
              }}
              placeholder="Enter Test Code (e.g. REV-101)"
              className="w-full px-4 py-3 bg-white border-2 border-[#201e1d] rounded-xl text-sm font-mono font-bold text-[#201e1d] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FEF08A] shadow-[2px_2px_0_0_#201e1d]"
            />
            {quickCodeInput && (
              <button
                type="button"
                onClick={() => setQuickCodeInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-[#201e1d] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="shrink-0 px-6 py-3 min-h-[44px] bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Find &amp; Start
          </button>
        </form>

        {quickCodeError && (
          <div className="mt-2.5 p-2.5 bg-[#FFF1F2] border-2 border-[#FDA4AF] rounded-xl text-xs font-bold text-[#E11D48] flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quickCodeError}</span>
          </div>
        )}
      </div>

      {/* ===================================================================
          3. FILTER TABS & SEARCH
         =================================================================== */}
      <div className="space-y-3">
        {/* Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#FFFDF7] border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0_0_#201e1d]">
            <button
              type="button"
              onClick={() => {
                playPop();
                setFilterTab('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-black transition-all cursor-pointer min-h-[36px] ${
                filterTab === 'all'
                  ? 'bg-[#201e1d] text-[#FFDE59] shadow-xs'
                  : 'text-[#201e1d] hover:bg-neutral-100'
              }`}
            >
              All Tasks ({totalAssigned})
            </button>

            <button
              type="button"
              onClick={() => {
                playPop();
                setFilterTab('pending');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-black transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
                filterTab === 'pending'
                  ? 'bg-[#201e1d] text-[#FFDE59] shadow-xs'
                  : 'text-[#201e1d] hover:bg-neutral-100'
              }`}
            >
              <span>To Do ({todoCount})</span>
              {overdueCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#E11D48] animate-pulse" />
              )}
            </button>

            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  playPop();
                  setFilterTab('overdue');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-black transition-all cursor-pointer min-h-[36px] flex items-center gap-1.5 ${
                  filterTab === 'overdue'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'text-[#E11D48] hover:bg-rose-50'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Overdue ({overdueCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                playPop();
                setFilterTab('completed');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-heading font-black transition-all cursor-pointer min-h-[36px] ${
                filterTab === 'completed'
                  ? 'bg-[#201e1d] text-[#FFDE59] shadow-xs'
                  : 'text-[#201e1d] hover:bg-neutral-100'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or test code..."
              className="w-full pl-9 pr-3 py-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-medium text-[#201e1d] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#FEF08A] shadow-[2px_2px_0_0_#201e1d]"
            />
          </div>
        </div>

        {/* Subject Chips */}
        {subjectOptions.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-heading font-black text-neutral-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Subject:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSubject('all')}
              className={`px-3 py-1 rounded-lg text-xs font-heading font-bold border transition-all cursor-pointer ${
                selectedSubject === 'all'
                  ? 'bg-[#201e1d] text-white border-[#201e1d]'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#201e1d]'
              }`}
            >
              All Subjects
            </button>
            {subjectOptions.map((subj) => (
              <button
                key={subj.code}
                type="button"
                onClick={() => setSelectedSubject(subj.code)}
                className={`px-3 py-1 rounded-lg text-xs font-heading font-bold border transition-all cursor-pointer ${
                  selectedSubject === subj.code
                    ? 'bg-[#201e1d] text-white border-[#201e1d]'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#201e1d]'
                }`}
              >
                {subj.name} ({subj.code})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===================================================================
          4. ASSIGNMENT CARDS LIST
         =================================================================== */}
      <div className="space-y-4">
        {filteredHomework.length === 0 ? (
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-8 text-center space-y-3 shadow-[3px_3px_0_0_#201e1d]">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[2px_2px_0_0_#201e1d]">
              📝
            </div>
            <h3 className="text-base font-heading font-black text-[#201e1d]">No Homework Found</h3>
            <p className="text-xs font-medium text-neutral-600 max-w-sm mx-auto">
              {searchQuery || selectedSubject !== 'all' || filterTab !== 'all'
                ? 'No assignments match your active filters. Try clearing the search query or selecting "All Tasks".'
                : 'All caught up! You have no assigned homework pending at this time.'}
            </p>
          </div>
        ) : (
          filteredHomework.map((item) => {
            const dueInfo = formatDueDateBadge(item);
            const isCompleted = item.status === 'completed';
            const gradeInfo = item.submission ? getGradeBadge(item.submission.percentage) : null;

            return (
              <div
                key={item.id}
                className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] hover:shadow-[4px_4px_0_0_#201e1d] transition-all space-y-3"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Subject badge */}
                    <span className="px-2.5 py-1 rounded-lg bg-[#201e1d] text-[#FFDE59] text-xs font-heading font-black uppercase tracking-wider">
                      {item.subjectName} ({item.subjectCode})
                    </span>

                    {/* Test Code Pill with Copy */}
                    <button
                      type="button"
                      onClick={() => handleCopyCode(item.testCode)}
                      title="Click to copy test code"
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] flex items-center gap-1.5 transition-all shadow-[1px_1px_0_0_#201e1d] cursor-pointer"
                    >
                      <span>{item.testCode}</span>
                      {copiedCode === item.testCode ? (
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-neutral-500" />
                      )}
                    </button>
                  </div>

                  {/* Due Date Badge */}
                  <span
                    className={`px-3 py-1 rounded-lg border-2 text-xs font-heading font-black flex items-center gap-1.5 ${dueInfo.badgeClass}`}
                  >
                    {item.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" />
                    ) : item.status === 'overdue' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-[#9F1239]" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    {dueInfo.text}
                  </span>
                </div>

                {/* Title & Cohort */}
                <div>
                  <h3 className="text-base sm:text-lg font-heading font-black text-[#201e1d] leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs font-bold text-neutral-500 mt-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{item.cohortName}</span>
                  </p>
                </div>

                {/* Details & Actions row */}
                <div className="pt-2.5 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-neutral-600">
                    <span className="flex items-center gap-1 font-semibold">
                      <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />
                      {item.questionIds.length} Cambridge questions
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {item.durationMinutes} mins allocated
                    </span>
                  </div>

                  {/* Action / Results button */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isCompleted && item.submission ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Score Badge */}
                        <div
                          className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-heading font-black flex items-center gap-1.5 shadow-[2px_2px_0_0_#201e1d] ${gradeInfo?.color || 'bg-[#DCFCE7]'}`}
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#166534]" />
                          <span>
                            {item.submission.score}/{item.submission.totalQuestions} ({item.submission.percentage}%) •{' '}
                            {gradeInfo?.grade}
                          </span>
                        </div>

                        {/* Review Answers Button */}
                        <button
                          type="button"
                          onClick={() => openModalForAssignment(item, 'review', item.submission)}
                          className="px-3.5 py-2 min-h-[44px] bg-white hover:bg-neutral-100 border-2 border-[#201e1d] rounded-xl text-xs font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Review Answers
                        </button>

                        {/* Practice Again Button */}
                        <button
                          type="button"
                          onClick={() => openModalForAssignment(item, 'quiz')}
                          className="px-3.5 py-2 min-h-[44px] bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] rounded-xl text-xs font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                          title="Retake this homework assessment to test your mastery"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Practice Again
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openModalForAssignment(item, 'quiz')}
                        className={`px-5 py-2.5 min-h-[44px] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer ${
                          item.status === 'overdue'
                            ? 'bg-[#FDA4AF] hover:bg-[#FB7185]'
                            : 'bg-[#FFDE59] hover:bg-[#FDE047]'
                        }`}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Homework
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===================================================================
          5. BUILT-IN HOMEWORK QUIZ RUNNER MODAL (MOBILE & TABLET OPTIMIZED)
         =================================================================== */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="w-full h-full sm:h-auto sm:max-h-[92vh] max-w-3xl bg-[#FFFDF7] sm:rounded-3xl border-0 sm:border-3 border-[#201e1d] flex flex-col shadow-none sm:shadow-[6px_6px_0_0_#201e1d] overflow-hidden animate-fadeIn">
            {/* Sticky Modal Top Bar */}
            <div className="sticky top-0 z-20 px-4 sm:px-6 py-3.5 sm:py-4 border-b-2 border-[#201e1d] bg-[#FFF8E7] flex items-center justify-between shrink-0">
              <div className="space-y-0.5 pr-2 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#201e1d] text-[#FFDE59] text-[10px] sm:text-xs font-mono font-bold shrink-0">
                    {activeModalItem.testCode}
                  </span>
                  <span className="text-xs sm:text-sm font-heading font-black text-[#201e1d] truncate">
                    {activeModalItem.title}
                  </span>
                </div>
                {modalMode !== 'result' && (
                  <p className="text-xs font-bold text-neutral-600">
                    {modalMode === 'review' ? 'Reviewing ' : 'Question '}
                    <span className="font-heading font-black text-[#201e1d]">
                      {currentQuestionIdx + 1} of {modalQuestions.length}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {modalMode === 'quiz' && (
                  <div
                    className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-mono font-black flex items-center gap-1.5 shadow-[1.5px_1.5px_0_0_#201e1d] ${
                      quizTimeRemaining < 120
                        ? 'bg-[#FFE4E6] text-[#9F1239] animate-pulse border-[#FDA4AF]'
                        : 'bg-white text-[#201e1d]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {Math.floor(quizTimeRemaining / 60)}:
                      {(quizTimeRemaining % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 min-w-[36px] min-h-[36px] rounded-xl border-2 border-[#201e1d] bg-white hover:bg-neutral-100 text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  title="Close Assessment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Visual Progress Bar (under header) */}
            {modalMode !== 'result' && modalQuestions.length > 0 && (
              <div className="w-full bg-neutral-200 h-1.5 shrink-0">
                <div
                  className="bg-[#14B8A6] h-full transition-all duration-300 ease-out"
                  style={{
                    width: `${((currentQuestionIdx + 1) / modalQuestions.length) * 100}%`,
                  }}
                />
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 overscroll-contain">
              {modalMode === 'result' && quizSubmittedResult ? (
                /* Celebration Result Card */
                <div className="text-center space-y-5 py-4 max-w-lg mx-auto animate-fadeIn">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-[#86EFAC] border-3 border-[#201e1d] flex items-center justify-center text-3xl sm:text-4xl shadow-[4px_4px_0_0_#201e1d]">
                    🎉
                  </div>

                  <div>
                    <h2 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d]">
                      Homework Completed!
                    </h2>
                    <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-1">
                      Your answers have been saved and recorded to your Cambridge revision profile.
                    </p>
                  </div>

                  {/* Summary Metric Card */}
                  <div className="w-full p-4 sm:p-6 rounded-2xl bg-white border-2 border-[#201e1d] shadow-[4px_4px_0_0_#201e1d] space-y-4">
                    <div>
                      <span className="text-[11px] font-heading font-black text-neutral-400 uppercase tracking-widest">
                        Final Score
                      </span>
                      <div className="text-4xl sm:text-5xl font-heading font-black text-[#201e1d] mt-1">
                        {quizSubmittedResult.score}{' '}
                        <span className="text-2xl text-neutral-400">/ {quizSubmittedResult.totalQuestions}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-neutral-100">
                      <div className="p-2 rounded-xl bg-neutral-50 text-center">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase block">Accuracy</span>
                        <span className="text-sm sm:text-base font-heading font-black text-[#201e1d]">
                          {quizSubmittedResult.percentage}%
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-neutral-50 text-center">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase block">Boundary</span>
                        <span className="text-xs sm:text-sm font-heading font-black text-[#166534]">
                          {getGradeBadge(quizSubmittedResult.percentage).grade}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-neutral-50 text-center">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase block">Time</span>
                        <span className="text-xs sm:text-sm font-heading font-black text-[#201e1d]">
                          {formatTimeSpent(quizSubmittedResult.timeSpentSeconds)}
                        </span>
                      </div>
                    </div>

                    {/* XP Bonus Pill */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FEF08A] border-2 border-[#201e1d] text-xs font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d]">
                      <Zap className="w-4 h-4 fill-[#201e1d]" />
                      <span>
                        +{quizSubmittedResult.score * 15 + (quizSubmittedResult.percentage >= 80 ? 25 : 0)} XP Earned
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('review')}
                      className="px-5 py-3 min-h-[44px] bg-white hover:bg-neutral-100 border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Review Answers
                    </button>
                    <button
                      type="button"
                      onClick={() => openModalForAssignment(activeModalItem, 'quiz')}
                      className="px-5 py-3 min-h-[44px] bg-[#C7D2FE] hover:bg-[#A5B4FC] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#312E81] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Practice Again
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-3 min-h-[44px] bg-[#FFDE59] hover:bg-[#FDE047] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      Back to Homework
                    </button>
                  </div>
                </div>
              ) : (
                /* Question View (Quiz Mode or Review Mode) */
                (() => {
                  const currentQ = modalQuestions[currentQuestionIdx];
                  if (!currentQ) {
                    return <p className="text-sm font-bold text-neutral-500">Question unavailable.</p>;
                  }

                  const selectedOptId = selectedAnswers[currentQ.id];
                  const rawImageUrl = currentQ.image_url || currentQ.diagram?.image_url;
                  const diagramUrl = rawImageUrl ? resolveDiagramUrl(rawImageUrl) || rawImageUrl : null;

                  return (
                    <div className="space-y-5">
                      {/* Stem Box */}
                      <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] space-y-3">
                        <div className="flex items-center justify-between text-xs font-heading font-black text-neutral-400">
                          <span>QUESTION STEM</span>
                          {currentQ.citation && (
                            <span className="font-mono text-neutral-500 text-[11px] truncate max-w-xs">{currentQ.citation}</span>
                          )}
                        </div>

                        <div className="prose prose-sm sm:prose-base max-w-none text-[#201e1d] font-semibold leading-relaxed">
                          <RichMarkdown
                            content={currentQ.stem_markdown}
                            variant="neobrutalist"
                          />
                        </div>

                        {/* Optional Diagram */}
                        {diagramUrl && (
                          <div className="mt-3 p-2 bg-neutral-50 rounded-xl border border-neutral-300 text-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={diagramUrl}
                              alt="Question Diagram"
                              className="max-h-60 sm:max-h-72 mx-auto rounded-lg object-contain shadow-xs"
                            />
                          </div>
                        )}
                      </div>

                      {/* Options List */}
                      <div className="space-y-3">
                        {currentQ.options.map((opt, optIdx) => {
                          const optionLabels = ['A', 'B', 'C', 'D'];
                          const label = optionLabels[optIdx] || 'A';
                          const isSelected = selectedOptId === opt.id;
                          const isCorrect = Boolean(currentQ.correct_option_id) && opt.id === currentQ.correct_option_id;

                          let optionBtnStyle =
                            'bg-white border-[#201e1d] hover:bg-[#FEF08A]/30 text-[#201e1d] shadow-[2px_2px_0_0_#201e1d]';

                          if (modalMode === 'quiz') {
                            if (isSelected) {
                              optionBtnStyle =
                                'bg-[#FEF08A] hover:bg-[#FDE047] border-[#201e1d] text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] ring-2 ring-[#201e1d]';
                            }
                          } else if (modalMode === 'review') {
                            if (isCorrect) {
                              optionBtnStyle =
                                'bg-[#DCFCE7] border-[#16A34A] text-[#14532D] shadow-[2px_2px_0_0_#16A34A] ring-2 ring-[#16A34A]';
                            } else if (isSelected && !isCorrect) {
                              optionBtnStyle =
                                'bg-[#FFE4E6] border-[#E11D48] text-[#881337] shadow-[2px_2px_0_0_#E11D48] ring-2 ring-[#E11D48]';
                            } else {
                              optionBtnStyle = 'bg-white/60 opacity-60 border-neutral-300 text-neutral-600';
                            }
                          }

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={modalMode === 'review'}
                              onClick={() => handleSelectOption(currentQ.id, opt.id)}
                              className={`w-full min-h-[52px] sm:min-h-[56px] p-3.5 sm:p-4 rounded-xl border-2 text-left font-medium flex items-start gap-3 transition-all cursor-pointer ${optionBtnStyle} ${
                                modalMode === 'quiz' ? 'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none' : ''
                              }`}
                            >
                              <span
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-heading font-black text-xs sm:text-sm flex items-center justify-center shrink-0 border border-[#201e1d] ${
                                  isSelected
                                    ? 'bg-[#201e1d] text-[#FFDE59]'
                                    : 'bg-[#FFFDF7] text-[#201e1d]'
                                }`}
                              >
                                {label}
                              </span>

                              <div className="flex-1 text-xs sm:text-sm font-semibold leading-relaxed pt-0.5">
                                <RichMarkdown
                                  content={opt.text_markdown}
                                  variant="plain"
                                />
                              </div>

                              {modalMode === 'review' && isCorrect && (
                                <span className="text-[11px] font-heading font-black px-2.5 py-1 rounded-lg bg-[#16A34A] text-white shrink-0 flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  Correct
                                </span>
                              )}
                              {modalMode === 'review' && isSelected && !isCorrect && Boolean(currentQ.correct_option_id) && (
                                <span className="text-[11px] font-heading font-black px-2.5 py-1 rounded-lg bg-[#E11D48] text-white shrink-0 flex items-center gap-1">
                                  <X className="w-3 h-3 stroke-[3]" />
                                  Your Choice
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Review Mode: Cambridge Explanation Box */}
                      {modalMode === 'review' && currentQ.explanation_markdown && (
                        <div className="p-4 rounded-2xl bg-[#F0FDF4] border-2 border-[#86EFAC] text-xs sm:text-sm space-y-2 shadow-[2px_2px_0_0_#86EFAC]">
                          <span className="font-heading font-black text-[#166534] uppercase tracking-wider block flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[#16A34A]" />
                            Cambridge Mark Scheme Rationale &amp; Key Explanation:
                          </span>
                          <div className="prose prose-xs sm:prose-sm max-w-none text-[#14532D] leading-relaxed">
                            <RichMarkdown
                              content={currentQ.explanation_markdown}
                              variant="neobrutalist"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Sticky Modal Bottom Controls */}
            {modalMode !== 'result' && (
              <div className="sticky bottom-0 z-20 px-4 sm:px-6 py-3 sm:py-3.5 border-t-2 border-[#201e1d] bg-[#FFF8E7] flex flex-wrap items-center justify-between gap-2 shrink-0 pb-safe">
                <button
                  type="button"
                  disabled={currentQuestionIdx === 0}
                  onClick={() => {
                    playPop();
                    setCurrentQuestionIdx((prev) => Math.max(0, prev - 1));
                  }}
                  className={`px-4 py-2 min-h-[44px] rounded-xl border-2 border-[#201e1d] text-xs font-heading font-black flex items-center gap-1.5 transition-all ${
                    currentQuestionIdx === 0
                      ? 'bg-neutral-100 text-neutral-400 border-neutral-300 cursor-not-allowed'
                      : 'bg-white hover:bg-neutral-100 text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer'
                  }`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Previous
                </button>

                {/* Question dots / indicator pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-xs py-1">
                  {modalQuestions.map((q, idx) => {
                    const isAnswered = Boolean(selectedAnswers[q.id]);
                    const isCurrent = idx === currentQuestionIdx;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => {
                          playPop();
                          setCurrentQuestionIdx(idx);
                        }}
                        className={`w-7 h-7 rounded-lg text-xs font-heading font-black border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#201e1d] text-[#FFDE59] border-[#201e1d] ring-2 ring-[#FFDE59]'
                            : isAnswered
                            ? 'bg-[#86EFAC] text-[#14532D] border-[#201e1d]'
                            : 'bg-white text-neutral-500 border-neutral-300'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2">
                  {currentQuestionIdx < modalQuestions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        playPop();
                        setCurrentQuestionIdx((prev) => Math.min(modalQuestions.length - 1, prev + 1));
                      }}
                      className="px-4 py-2 min-h-[44px] bg-white hover:bg-neutral-100 border-2 border-[#201e1d] rounded-xl text-xs font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      Next
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : null}

                  {modalMode === 'quiz' && gradeError && (
                    <span role="alert" className="text-xs font-bold text-[#881337]">{gradeError}</span>
                  )}
                  {modalMode === 'quiz' && (
                    <button
                      type="button"
                      disabled={isGrading}
                      onClick={handleSubmitQuiz}
                      className="px-5 py-2 min-h-[44px] bg-[#86EFAC] hover:bg-[#4ADE80] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-heading font-black text-[#14532D] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      {isGrading ? 'Checking...' : 'Submit Assignment'}
                    </button>
                  )}

                  {modalMode === 'review' && (
                    <button
                      type="button"
                      onClick={() => setModalMode('result')}
                      className="px-4 py-2 min-h-[44px] bg-[#FFDE59] hover:bg-[#FDE047] border-2 border-[#201e1d] rounded-xl text-xs font-heading font-black text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      View Summary
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
