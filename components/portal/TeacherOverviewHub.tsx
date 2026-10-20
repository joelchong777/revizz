'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  Search,
  Plus,
  FileText,
  Printer,
  Send,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Check,
  X,
  Bell,
  BookOpen,
  Award,
  Activity,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ShieldAlert,
  ExternalLink,
  GraduationCap,
  Target,
  FileCheck,
  ArrowUpRight,
  Copy,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  findHomeworkByIdAnyTeacher,
  getAssignedHomeworkByCode,
} from '@/lib/portal/assignedHomework';
import {
  saveTestDraft,
  listTestDrafts,
  saveOnlineAssignment,
  listOnlineAssignments,
  SUBJECT_CATALOG,
  autoSelectQuestions,
  buildCompiledQuestions,
} from '@/lib/testCompiler';
import { useQuestions } from '@/lib/questions';
import { TestPaperConfig, OnlineQuizAssignment } from '@/types/testCompiler';

export interface TeacherOverviewHubProps {
  onNavigate: (tab: string, params?: { topic?: string; studentId?: string; prefill?: string }) => void;
  userDisplayName?: string;
}

export interface TriageStudent {
  id: string;
  name: string;
  initials: string;
  cohort: string;
  avatarBg: string;
  reason: 'error_rate' | 'rapid_guessing' | 'inactive';
  reasonBadge: string;
  detail: string;
  accuracy: number;
  avgTimeSeconds?: number;
  lastActive: string;
  status: 'flagged' | 'pack_assigned' | 'resolved';
}

export interface MockAssignmentStats extends OnlineQuizAssignment {
  completedCount: number;
  totalStudents: number;
  averageScorePercent: number;
}

interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'info' | 'warning';
}

const DEFAULT_FALLBACK_DRAFTS: TestPaperConfig[] = [];

const DEFAULT_FALLBACK_ASSIGNMENTS: MockAssignmentStats[] = [];

const INITIAL_TRIAGE_STUDENTS: TriageStudent[] = [];

export const TOPIC_MASTERY_WEAK: { topic: string; accuracy: number; strugglingCount: number; subject: string }[] = [];

function formatDueRelative(dateStr: string): string {
  try {
    const dueTime = new Date(dateStr).getTime();
    if (isNaN(dueTime)) return 'No due date';
    const diffMs = dueTime - Date.now();
    if (diffMs < 0) return 'Past Due';
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) return `Due in ${Math.max(1, diffHours)}h`;
    const diffDays = Math.round(diffHours / 24);
    return `Due in ${diffDays}d`;
  } catch {
    return 'Due soon';
  }
}

export default function TeacherOverviewHub({
  onNavigate,
  userDisplayName = 'Educator',
}: TeacherOverviewHubProps) {
  const { questions: dbQuestions } = useQuestions();

  // Top-level unconditional state hooks (Defends against React Error #310)
  const [selectedCohort, setSelectedCohort] = useState<string>('All Cohorts');
  const [draftsList, setDraftsList] = useState<TestPaperConfig[]>(DEFAULT_FALLBACK_DRAFTS);
  const [assignmentsList, setAssignmentsList] = useState<MockAssignmentStats[]>(DEFAULT_FALLBACK_ASSIGNMENTS);
  const [triageStudents, setTriageStudents] = useState<TriageStudent[]>(INITIAL_TRIAGE_STUDENTS);
  const [triageFilter, setTriageFilter] = useState<'all' | 'error_rate' | 'rapid_guessing' | 'inactive'>('all');
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [nudgedAssignments, setNudgedAssignments] = useState<Record<string, boolean>>({});

  // Quick Diagnostic Generator Modal state
  const [isDiagModalOpen, setIsDiagModalOpen] = useState<boolean>(false);
  const [diagSubject, setDiagSubject] = useState<string>('0455');
  const [diagCount, setDiagCount] = useState<number>(10);
  const [diagFocus, setDiagFocus] = useState<'gap' | 'mixed' | 'topic'>('gap');
  const [diagTopic, setDiagTopic] = useState<string>('');
  const [diagCohort, setDiagCohort] = useState<string>('');
  const [isGeneratingDiag, setIsGeneratingDiag] = useState<boolean>(false);

  // Toast notification helper
  const showToast = useCallback((text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToast({ id, text, type });
  }, []);

  // 1-Click Test Code Copy Helper
  const handleCopyCode = useCallback(
    (code: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(code);
        }
        setCopiedCode(code);
        showToast(`📋 Copied test code "${code}" to clipboard!`, 'info');
        setTimeout(() => {
          setCopiedCode((current) => (current === code ? null : current));
        }, 2500);
      } catch (err) {
        showToast(`Code: ${code}`, 'info');
      }
    },
    [showToast]
  );

  // Auto-dismiss toast after 3.5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Modal Escape key listener for accessible dismissal
  useEffect(() => {
    if (!isDiagModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDiagModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDiagModalOpen]);

  // Load drafts and online assignments from storage & Supabase
  useEffect(() => {
    let mounted = true;

    async function loadHubData() {
      try {
        setLoadingData(true);

        // 1. Load Test Compiler Drafts
        const storedDrafts = listTestDrafts();
        if (storedDrafts && storedDrafts.length > 0) {
          if (mounted) setDraftsList(storedDrafts);
        }

        // 2. Load Online Assignments
        const storedAssignments = listOnlineAssignments();
        if (storedAssignments && storedAssignments.length > 0) {
          const augmented: MockAssignmentStats[] = storedAssignments.map((a) => {
            const hw = findHomeworkByIdAnyTeacher(a.id) || getAssignedHomeworkByCode(a.testCode || '');
            const submissions = hw?.submissions || [];
            const completedCount = submissions.length;
            const totalStudents = hw?.totalStudents || 0;
            const averageScorePercent =
              completedCount > 0
                ? Math.round(
                    submissions.reduce((sum, s) => sum + s.accuracyPercentage, 0) / completedCount
                  )
                : 0;

            return {
              ...a,
              completedCount,
              totalStudents,
              averageScorePercent,
            };
          });
          if (mounted) setAssignmentsList(augmented);
        } else {
          if (mounted) setAssignmentsList([]);
        }

        // 3. Zero fake data invariant: Populate real triage students strictly from explicit error telemetry
        const realTriage: TriageStudent[] = [];
        const seen = new Set<string>();
        storedAssignments.forEach((a) => {
          const hw = findHomeworkByIdAnyTeacher(a.id) || getAssignedHomeworkByCode(a.testCode || '');
          if (hw && hw.submissions) {
            hw.submissions.forEach((sub) => {
              const key = sub.studentId || sub.studentName;
              if (!key || seen.has(key)) return;
              if (sub.accuracyPercentage < 50) {
                seen.add(key);
                const initials = sub.studentName
                  ? sub.studentName
                      .trim()
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'ST';
                realTriage.push({
                  id: sub.studentId || `triage-${Date.now()}-${Math.random()}`,
                  name: sub.studentName || 'Student',
                  initials,
                  cohort: a.cohortName || 'General',
                  avatarBg: '#ffe1d0',
                  reason: 'error_rate',
                  reasonBadge: 'High Error Rate',
                  detail: `Accuracy dropped to ${sub.accuracyPercentage}% on "${a.title}".`,
                  accuracy: sub.accuracyPercentage,
                  lastActive: 'Recently',
                  status: 'flagged',
                });
              }
            });
          }
        });
        if (mounted) setTriageStudents(realTriage);
      } catch (err) {
        console.warn('TeacherOverviewHub: Non-fatal error loading hub data, using fallbacks:', err);
      } finally {
        if (mounted) setLoadingData(false);
      }
    }

    loadHubData();
    return () => {
      mounted = false;
    };
  }, []);

  // Dynamically derive real cohorts from active assignments & saved teacher classes
  const availableCohorts = useMemo(() => {
    const cohortSet = new Set<string>();
    assignmentsList.forEach((a) => {
      if (a.cohortName && a.cohortName.trim()) {
        cohortSet.add(a.cohortName.trim());
      }
    });
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('revizz_teacher_classes');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((c: { name?: string }) => {
              if (c.name && c.name.trim()) cohortSet.add(c.name.trim());
            });
          }
        }
      } catch {}
    }
    return Array.from(cohortSet);
  }, [assignmentsList]);

  // Filtered Assignments based on Cohort Selector (real dynamic matching)
  const filteredAssignments = useMemo(() => {
    if (selectedCohort === 'All Cohorts') return assignmentsList;
    return assignmentsList.filter(
      (a) => a.cohortName.trim().toLowerCase() === selectedCohort.trim().toLowerCase()
    );
  }, [assignmentsList, selectedCohort]);

  // Filtered Triage Students based on Filter tabs and Cohort
  const filteredTriageStudents = useMemo(() => {
    return triageStudents.filter((student) => {
      const matchesCohort =
        selectedCohort === 'All Cohorts' ||
        student.cohort.trim().toLowerCase() === selectedCohort.trim().toLowerCase();
      const matchesFilter = triageFilter === 'all' || student.reason === triageFilter;
      return matchesCohort && matchesFilter;
    });
  }, [triageStudents, selectedCohort, triageFilter]);

  // Real dynamic topic telemetry derived from actual homework submissions
  const dynamicTopicGaps = useMemo(() => {
    const topicStatsMap: Record<string, { totalAcc: number; count: number; subject: string; struggling: number }> = {};
    assignmentsList.forEach((a) => {
      const hw = findHomeworkByIdAnyTeacher(a.id) || getAssignedHomeworkByCode(a.testCode || '');
      if (hw && hw.submissions && hw.submissions.length > 0) {
        const topicName = hw.topics && hw.topics.length > 0 ? hw.topics[0] : a.title;
        if (!topicStatsMap[topicName]) {
          topicStatsMap[topicName] = { totalAcc: 0, count: 0, subject: a.subjectCode, struggling: 0 };
        }
        hw.submissions.forEach((s) => {
          topicStatsMap[topicName].totalAcc += s.accuracyPercentage;
          topicStatsMap[topicName].count += 1;
          if (s.accuracyPercentage < 60) {
            topicStatsMap[topicName].struggling += 1;
          }
        });
      }
    });

    return Object.entries(topicStatsMap)
      .filter(([_, stats]) => stats.count > 0 && Math.round(stats.totalAcc / stats.count) < 65)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round(stats.totalAcc / stats.count),
        strugglingCount: stats.struggling,
        subject: stats.subject,
      }));
  }, [assignmentsList]);

  const dynamicTopicStrong = useMemo(() => {
    const topicStatsMap: Record<string, { totalAcc: number; count: number; subject: string }> = {};
    assignmentsList.forEach((a) => {
      const hw = findHomeworkByIdAnyTeacher(a.id) || getAssignedHomeworkByCode(a.testCode || '');
      if (hw && hw.submissions && hw.submissions.length > 0) {
        const topicName = hw.topics && hw.topics.length > 0 ? hw.topics[0] : a.title;
        if (!topicStatsMap[topicName]) {
          topicStatsMap[topicName] = { totalAcc: 0, count: 0, subject: a.subjectCode };
        }
        hw.submissions.forEach((s) => {
          topicStatsMap[topicName].totalAcc += s.accuracyPercentage;
          topicStatsMap[topicName].count += 1;
        });
      }
    });

    return Object.entries(topicStatsMap)
      .filter(([_, stats]) => stats.count > 0 && Math.round(stats.totalAcc / stats.count) >= 65)
      .map(([topic, stats]) => ({
        topic,
        accuracy: Math.round(stats.totalAcc / stats.count),
        attempts: stats.count,
        subject: stats.subject,
      }));
  }, [assignmentsList]);

  // Triage category counts for immediate dashboard visibility
  const triageCounts = useMemo(() => {
    return {
      all: triageStudents.length,
      error_rate: triageStudents.filter((s) => s.reason === 'error_rate').length,
      rapid_guessing: triageStudents.filter((s) => s.reason === 'rapid_guessing').length,
      inactive: triageStudents.filter((s) => s.reason === 'inactive').length,
    };
  }, [triageStudents]);

  // Dynamic real data metrics across active assignments
  const totalEnrolledAcrossAssignments = useMemo(() => {
    return filteredAssignments.reduce((acc, a) => acc + (a.totalStudents || 0), 0);
  }, [filteredAssignments]);

  const totalCompletedAcrossAssignments = useMemo(() => {
    return filteredAssignments.reduce((acc, a) => acc + (a.completedCount || 0), 0);
  }, [filteredAssignments]);

  const totalPendingAcrossAssignments = Math.max(
    0,
    totalEnrolledAcrossAssignments - totalCompletedAcrossAssignments
  );

  const turnInPercentage = totalEnrolledAcrossAssignments > 0
    ? Math.round((totalCompletedAcrossAssignments / totalEnrolledAcrossAssignments) * 100)
    : 0;

  const averageAccuracyPercent = useMemo(() => {
    const withSubs = filteredAssignments.filter((a) => a.completedCount > 0);
    if (withSubs.length === 0) return 0;
    const sum = withSubs.reduce((acc, a) => acc + (a.averageScorePercent || 0), 0);
    return Math.round(sum / withSubs.length);
  }, [filteredAssignments]);

  // Smooth anchor scrolling helper
  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handler: Nudge pending students with instantaneous tactile feedback
  const handleNudgePending = (assignment: MockAssignmentStats) => {
    const pendingCount = assignment.totalStudents - assignment.completedCount;
    setNudgedAssignments((prev) => ({ ...prev, [assignment.id]: true }));
    showToast(
      `🔔 Automated reminder sent to ${pendingCount} pending students in "${assignment.title}".`,
      'info'
    );
    setTimeout(() => {
      setNudgedAssignments((prev) => ({ ...prev, [assignment.id]: false }));
    }, 3000);
  };

  // Handler: Assign Recovery Pack to Flagged Student
  const handleAssignRecoveryPack = (studentId: string, studentName: string) => {
    setTriageStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'pack_assigned' } : s))
    );
    showToast(`🎯 Assigned 5-Question Recovery Pack to ${studentName}! Added to pending queue.`, 'success');
  };

  // Handler: Resolve Student Flag
  const handleResolveFlag = (studentId: string, studentName: string) => {
    setTriageStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status: 'resolved' } : s))
    );
    showToast(`✅ Flag resolved for ${studentName}. Class health record updated.`, 'success');
  };

  // Handler: Preset Test Launch
  const handleLaunchPreset = (presetType: 'weakness' | 'mock' | 'topic') => {
    if (presetType === 'weakness') {
      setDiagSubject('0455');
      setDiagCount(10);
      setDiagFocus('gap');
      setDiagTopic(dynamicTopicGaps[0]?.topic || '');
      setIsDiagModalOpen(true);
    } else if (presetType === 'mock') {
      setDiagSubject('0455');
      setDiagCount(20);
      setDiagFocus('mixed');
      setIsDiagModalOpen(true);
    } else {
      setDiagSubject('0455');
      setDiagCount(15);
      setDiagFocus('topic');
      setDiagTopic(dynamicTopicGaps[0]?.topic || '');
      setIsDiagModalOpen(true);
    }
  };

  // Handler: 1-Click Generate Remedial Round from Gap Topic
  const handleRemedialRound = (topicName: string, subjectCode: string) => {
    setDiagSubject(subjectCode);
    setDiagCount(10);
    setDiagFocus('topic');
    setDiagTopic(topicName);
    setIsDiagModalOpen(true);
  };

  // Handler: Execute Quick Diagnostic Test Generator
  const handleExecuteDiagnosticGenerator = (action: 'print' | 'assign') => {
    setIsGeneratingDiag(true);

    if (dbQuestions.length === 0) {
      showToast('⚠️ Question Bank is empty. Ingest questions in App Admin first.', 'warning');
      setIsGeneratingDiag(false);
      return;
    }

    try {
      const subjectPool = dbQuestions.filter(
        (q) => !q.citation || q.citation.includes(diagSubject) || q.id.includes(diagSubject)
      );
      const pool = subjectPool.length >= diagCount ? subjectPool : dbQuestions;

      let selectedIds: string[] = [];
      if (diagFocus === 'topic') {
        const topicMatches = pool.filter(
          (q) => q.topic && q.topic.toLowerCase().includes(diagTopic.toLowerCase().slice(0, 10))
        );
        selectedIds = autoSelectQuestions(
          { count: diagCount, questionPool: topicMatches.length >= 3 ? topicMatches : pool },
          topicMatches.length >= 3 ? topicMatches : pool
        );
      } else {
        selectedIds = autoSelectQuestions({ count: diagCount, questionPool: pool }, pool);
      }

      if (selectedIds.length === 0) {
        selectedIds = pool.slice(0, Math.min(diagCount, pool.length)).map((q) => q.id);
      }

      const subjectMeta = SUBJECT_CATALOG.find((s) => s.code === diagSubject) || {
        code: diagSubject,
        name: diagSubject === '0625' ? 'Physics' : 'Economics',
      };

      const testTitle = `${subjectMeta.name} ${
        diagFocus === 'gap' ? 'Weakness Diagnostic' : diagFocus === 'topic' ? `Topic Check: ${diagTopic}` : 'Paper 1 Simulation'
      }`;

      if (action === 'print') {
        const newDraft: TestPaperConfig = {
          id: `test-diag-${Date.now()}`,
          title: testTitle,
          subjectCode: subjectMeta.code,
          subjectName: subjectMeta.name,
          schoolName: '',
          durationMinutes: diagCount * 2,
          totalMarks: selectedIds.length,
          testCode: `DIAG-${subjectMeta.code}-${Math.floor(100 + Math.random() * 900)}`,
          dateString: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          includeCoverPage: true,
          includeCandidateHeader: true,
          includeBubbleSheet: true,
          includeMarkScheme: true,
          includeExplanations: true,
          questionIds: selectedIds,
          compiledQuestions: buildCompiledQuestions(selectedIds, pool),
          createdAt: new Date().toISOString(),
        };

        saveTestDraft(newDraft);
        setDraftsList((prev) => [newDraft, ...prev]);
        setIsDiagModalOpen(false);
        showToast(`🖨️ Test Paper "${testTitle}" generated! Opening printable PDF...`, 'success');
        if (typeof window !== 'undefined') {
          window.open(`/portal/compiler/print?testId=${newDraft.id}`, '_blank');
        }
      } else {
        const targetCohortName = diagCohort.trim() || (availableCohorts[0] || 'General Cohort');
        const newAssignment: OnlineQuizAssignment = {
          id: `asg-online-${Date.now()}`,
          title: testTitle,
          subjectCode: subjectMeta.code,
          subjectName: subjectMeta.name,
          cohortName: targetCohortName,
          dueDate: new Date(Date.now() + 3600000 * 48).toISOString(),
          durationMinutes: diagCount * 2,
          questionIds: selectedIds,
          testCode: `ASG-${subjectMeta.code}-${Math.floor(100 + Math.random() * 900)}`,
          createdAt: new Date().toISOString(),
        };

        saveOnlineAssignment(newAssignment);
        const augmented: MockAssignmentStats = {
          ...newAssignment,
          completedCount: 0,
          totalStudents: 0,
          averageScorePercent: 0,
        };
        setAssignmentsList((prev) => [augmented, ...prev]);
        setIsDiagModalOpen(false);
        showToast(`🚀 "${testTitle}" assigned to ${targetCohortName}! Students notified.`, 'success');
      }
    } catch (e) {
      console.error('Error generating diagnostic:', e);
      showToast('Could not compile test. Please try again.', 'warning');
    } finally {
      setIsGeneratingDiag(false);
    }
  };

  const activeTriageCount = triageStudents.filter((s) => s.status === 'flagged').length;

  return (
    <div className="space-y-8 pb-16">
      {/* Toast Notification Container */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-6 right-6 z-50 max-w-md w-full px-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3 p-4 bg-[#201e1d] text-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-offset-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl shrink-0">
                  {toast.type === 'info' ? '🔔' : toast.type === 'warning' ? '⚠️' : '✨'}
                </span>
                <p className="text-xs sm:text-sm font-bold leading-snug break-words">{toast.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-2 rounded-lg hover:bg-[#3d3835] transition-colors text-[#dcd3c4] hover:text-[#f9f4ed] shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero / Command Center Header */}
      <div className="relative rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 sm:p-8 shadow-offset-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ffe1d0] rounded-full blur-3xl opacity-30 pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] text-xs font-black uppercase tracking-wider shadow-offset-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#272e1b] animate-pulse" />
                Teacher Command Center
              </span>
              <span className="px-3 py-1 rounded-full bg-[#eee7db] border-2 border-[#201e1d] text-[#645c50] text-xs font-bold flex items-center gap-1.5 shadow-offset-2">
                <Calendar className="w-3.5 h-3.5 text-[#201e1d]" />
                {new Date().toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-[#201e1d] font-heading tracking-tight">
              Welcome back, {userDisplayName} 👋
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#645c50] max-w-2xl leading-relaxed font-body">
              Real-time monitoring across Cambridge IGCSE cohorts. Track homework turn-in momentum,
              review gap analytics, and deploy rapid diagnostics in 1 click.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Cohort Switcher */}
            <div className="relative">
              <select
                value={selectedCohort}
                onChange={(e) => {
                  setSelectedCohort(e.target.value);
                  showToast(`Switched view to ${e.target.value}`, 'info');
                }}
                disabled={availableCohorts.length === 0}
                className="w-full sm:w-auto appearance-none min-h-[44px] px-4 py-2.5 pr-9 bg-[#f9f4ed] text-[#201e1d] font-bold text-xs sm:text-sm rounded-xl border-2 border-border shadow-[4px_4px_0px_0px_#1E1B4B] hover:shadow-[5px_5px_0px_0px_#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#201e1d] cursor-pointer transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Filter by cohort"
              >
                {availableCohorts.length === 0 ? (
                  <option value="All Cohorts">All Cohorts (Empty)</option>
                ) : (
                  <>
                    <option value="All Cohorts">All Cohorts</option>
                    {availableCohorts.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#201e1d]">
                <Filter className="w-4 h-4" />
              </div>
            </div>

            {/* Quick Diagnostic Generator CTA */}
            <button
              type="button"
              onClick={() => setIsDiagModalOpen(true)}
              className="min-h-[44px] px-5 py-2.5 bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] font-black text-xs sm:text-sm rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-4 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
            >
              <Zap className="w-4 h-4 fill-[#201e1d]" />
              <span>+ Quick Diagnostic</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Row (4 Tactile Neobrutalist Cards with Jump-To-Section Links) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Overall Accuracy */}
        <button
          type="button"
          onClick={() => scrollToSection('section-health')}
          className="p-5 rounded-2xl border-2 border-border bg-[#f9f4ed] shadow-[4px_4px_0px_0px_#1E1B4B] transition-all duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1E1B4B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#1E1B4B] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
          title="Jump to Class Health Radar"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
              Cohort Accuracy
            </span>
            <span className="p-1.5 rounded-lg bg-[#ccdbb2] border-2 border-border text-[#272e1b] shadow-[2px_2px_0px_0px_#1E1B4B]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#201e1d] font-heading">
              {totalCompletedAcrossAssignments > 0 && averageAccuracyPercent > 0 ? `${averageAccuracyPercent}%` : '—'}
            </span>
            {totalCompletedAcrossAssignments > 0 && averageAccuracyPercent > 0 ? (
              <span className="text-xs font-bold text-[#272e1b] bg-[#ccdbb2] px-2 py-0.5 rounded-full border border-border">
                Live Average
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-[#645c50] bg-[#eee7db] px-2 py-0.5 rounded-full border border-border">
                Empty
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#645c50] mt-2 flex items-center justify-between">
            <span>
              {totalCompletedAcrossAssignments > 0
                ? `Across ${totalCompletedAcrossAssignments} completed drills`
                : 'No submissions received yet'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#201e1d]" />
          </p>
        </button>

        {/* Metric 2: Homework Completion */}
        <button
          type="button"
          onClick={() => scrollToSection('section-homework')}
          className="p-5 rounded-2xl border-2 border-border bg-[#f9f4ed] shadow-[4px_4px_0px_0px_#1E1B4B] transition-all duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1E1B4B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#1E1B4B] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
          title="Jump to Assigned Homework"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
              Homework Turn-in
            </span>
            <span className="p-1.5 rounded-lg bg-[#ffe1d0] border-2 border-border text-[#643312] shadow-[2px_2px_0px_0px_#1E1B4B]">
              <FileCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#201e1d] font-heading">
              {totalEnrolledAcrossAssignments > 0 ? `${turnInPercentage}%` : '—'}
            </span>
            {totalEnrolledAcrossAssignments > 0 ? (
              <span className="text-xs font-bold text-[#643312] bg-[#ffe1d0] px-2 py-0.5 rounded-full border border-border">
                {totalCompletedAcrossAssignments} / {totalEnrolledAcrossAssignments}
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-[#645c50] bg-[#eee7db] px-2 py-0.5 rounded-full border border-border">
                Empty
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#645c50] mt-2 flex items-center justify-between">
            <span>
              {filteredAssignments.length > 0
                ? `${totalPendingAcrossAssignments} pending across ${filteredAssignments.length} sets`
                : 'No assignments active'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#201e1d]" />
          </p>
        </button>

        {/* Metric 3: Active Tests & Quizzes */}
        <button
          type="button"
          onClick={() => scrollToSection('section-compiler')}
          className="p-5 rounded-2xl border-2 border-border bg-[#f9f4ed] shadow-[4px_4px_0px_0px_#1E1B4B] transition-all duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1E1B4B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#1E1B4B] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
          title="Jump to Test Compiler Studio"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
              Tests Compiled
            </span>
            <span className="p-1.5 rounded-lg bg-[#fed7aa] border-2 border-border text-[#201e1d] shadow-[2px_2px_0px_0px_#1E1B4B]">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#201e1d] font-heading">
              {draftsList.length + assignmentsList.length}
            </span>
            {draftsList.length + assignmentsList.length > 0 ? (
              <span className="text-xs font-bold text-[#201e1d] bg-[#fed7aa] px-2 py-0.5 rounded-full border border-border">
                {draftsList.length} Drafts
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-[#645c50] bg-[#eee7db] px-2 py-0.5 rounded-full border border-border">
                Empty
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#645c50] mt-2 flex items-center justify-between">
            <span>
              {assignmentsList.length > 0
                ? `${assignmentsList.length} live digital quizzes running`
                : 'No tests or quizzes compiled'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#201e1d]" />
          </p>
        </button>

        {/* Metric 4: Triage Attention Needed */}
        <button
          type="button"
          onClick={() => scrollToSection('section-triage')}
          className="p-5 rounded-2xl border-2 border-border bg-[#f9f4ed] shadow-[4px_4px_0px_0px_#1E1B4B] transition-all duration-150 hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#1E1B4B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#1E1B4B] text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
          title="Jump to Student Triage Hub"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
              Triage Flagged
            </span>
            <span className="p-1.5 rounded-lg bg-[#fde8e8] border-2 border-border text-[#991b1b] shadow-[2px_2px_0px_0px_#1E1B4B]">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#991b1b] font-heading">
              {activeTriageCount}
            </span>
            {activeTriageCount > 0 ? (
              <span className="text-xs font-bold text-[#991b1b] bg-[#fde8e8] px-2 py-0.5 rounded-full border border-border animate-pulse">
                Requires Action
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase text-[#272e1b] bg-[#ccdbb2] px-2 py-0.5 rounded-full border border-border">
                Empty (All Clear)
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#645c50] mt-2 flex items-center justify-between">
            <span>
              {activeTriageCount > 0
                ? 'Spikes & rapid guessing'
                : 'No students currently flagged'}
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#201e1d]" />
          </p>
        </button>
      </div>

      {/* Main Grid: Left Column (Test Compiler & Active Homework) | Right Column (Health Radar & Triage) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 cols): Test Compiler Hub & Homework Completion */}
        <div className="lg:col-span-7 space-y-8">
          {/* Section 1: Test Compiler & Preset Tests */}
          <div
            id="section-compiler"
            className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-6 scroll-mt-20"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#201e1d]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[#201e1d] font-heading tracking-tight">
                    Test Compiler &amp; Exam Paper Studio
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-[10px] font-black uppercase">
                    IGCSE Standard
                  </span>
                </div>
                <p className="text-xs font-medium text-[#645c50] mt-0.5">
                  Generate timed diagnostics, paper 1 mocks, and printable bubble sheets in seconds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('compiler')}
                className="min-h-[38px] px-4 py-2 bg-[#eee7db] hover:bg-[#dcd3c4] text-[#201e1d] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <span>Full Compiler</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Diagnostic Presets (3 tactile action cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Preset 1 */}
              <div className="p-4 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-offset-2 flex flex-col justify-between hover:bg-[#ffe1d0]/30 hover:-translate-y-0.5 transition-all duration-150">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-bold">
                      10 Qs • Diagnostic
                    </span>
                    <Zap className="w-3.5 h-3.5 text-[#201e1d]" />
                  </div>
                  <h3 className="font-heading font-black text-sm text-[#201e1d]">
                    Weakness Diagnostic
                  </h3>
                  <p className="text-[11px] text-[#645c50] mt-1 leading-snug">
                    Auto-pulls bottom 2 weak syllabus units with mixed difficulty.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchPreset('weakness')}
                  className="mt-3.5 w-full min-h-[36px] py-1.5 px-3 bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] font-black text-xs rounded-lg border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Launch
                </button>
              </div>

              {/* Preset 2 */}
              <div className="p-4 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-offset-2 flex flex-col justify-between hover:bg-[#ccdbb2]/30 hover:-translate-y-0.5 transition-all duration-150">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-bold text-[#272e1b]">
                      20 Qs • Paper 1
                    </span>
                    <FileText className="w-3.5 h-3.5 text-[#201e1d]" />
                  </div>
                  <h3 className="font-heading font-black text-sm text-[#201e1d]">
                    Paper 1 Mock Exam
                  </h3>
                  <p className="text-[11px] text-[#645c50] mt-1 leading-snug">
                    Balanced timed simulation across all core syllabus units.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchPreset('mock')}
                  className="mt-3.5 w-full min-h-[36px] py-1.5 px-3 bg-[#ccdbb2] hover:bg-[#b8c99d] text-[#272e1b] font-black text-xs rounded-lg border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Launch
                </button>
              </div>

              {/* Preset 3 */}
              <div className="p-4 rounded-xl border-2 border-border bg-[#f9f4ed] shadow-[2px_2px_0px_0px_#1E1B4B] flex flex-col justify-between hover:bg-[#fed7aa]/30 hover:-translate-y-0.5 transition-all duration-150">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-[#fed7aa] border border-border text-[10px] font-bold text-[#643312]">
                      15 Qs • Topic Sprint
                    </span>
                    <Target className="w-3.5 h-3.5 text-[#201e1d]" />
                  </div>
                  <h3 className="font-heading font-black text-sm text-[#201e1d]">
                    Targeted Topic Sprint
                  </h3>
                  <p className="text-[11px] text-[#645c50] mt-1 leading-snug">
                    Deep dive into a specific syllabus unit of your choice.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleLaunchPreset('topic')}
                  className="mt-3.5 w-full min-h-[36px] py-1.5 px-3 bg-[#fed7aa] hover:bg-[#fcd34d] text-[#201e1d] font-black text-xs rounded-lg border-2 border-border shadow-[2px_2px_0px_0px_#1E1B4B] hover:shadow-[3px_3px_0px_0px_#1E1B4B] hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Launch
                </button>
              </div>
            </div>

            {/* Recent Drafts List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                  Recent Saved Drafts &amp; Papers ({draftsList.length})
                </span>
                <span className="text-[11px] text-[#645c50] font-semibold">
                  A4 Print &amp; Bubble Sheet Ready
                </span>
              </div>

              {draftsList.length === 0 ? (
                <div className="p-8 text-center bg-[#eee7db] rounded-2xl border-2 border-border shadow-[4px_4px_0px_0px_#1E1B4B] space-y-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f9f4ed] border-2 border-border text-xs font-black text-[#201e1d] shadow-[2px_2px_0px_0px_#1E1B4B] uppercase tracking-wider mb-1">
                    Empty Notice
                  </div>
                  <FileText className="w-8 h-8 text-[#645c50] mx-auto" />
                  <p className="font-heading font-black text-base text-[#201e1d]">No draft papers saved yet</p>
                  <p className="text-xs text-[#645c50] max-w-sm mx-auto">Use the Quick Diagnostic Generator or Full Compiler to build your first exam paper.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {draftsList.slice(0, 3).map((draft) => (
                    <div
                      key={draft.id}
                      className="p-4 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-offset-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-black transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-[#201e1d] text-[#f9f4ed] text-[10px] font-mono font-bold">
                            {draft.subjectCode} {draft.subjectName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(draft.testCode)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eee7db] hover:bg-[#dcd3c4] border border-[#201e1d] text-xs font-mono font-bold text-[#645c50] transition-colors cursor-pointer"
                            title="Click to copy test code"
                          >
                            <span>{draft.testCode}</span>
                            {copiedCode === draft.testCode ? (
                              <Check className="w-3 h-3 text-[#272e1b]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#645c50]" />
                            )}
                          </button>
                          <span className="text-xs text-[#645c50]">• {draft.questionIds.length} Qs</span>
                          <span className="text-xs text-[#645c50]">• {draft.durationMinutes} min</span>
                        </div>
                        <h4 className="font-heading font-black text-sm text-[#201e1d] truncate">
                          {draft.title}
                        </h4>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => onNavigate('compiler')}
                          className="min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg bg-[#eee7db] hover:bg-[#dcd3c4] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              window.open(`/portal/compiler/print?testId=${draft.id}`, '_blank');
                            }
                          }}
                          className="min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg bg-[#ccdbb2] hover:bg-[#b8c99d] text-[#272e1b] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1 cursor-pointer"
                          title="Print paper with candidate header & bubble sheet"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('assign', { prefill: draft.title })}
                          className="min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Assign</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Assigned Homework & Quiz Completion */}
          <div
            id="section-homework"
            className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-6 scroll-mt-20"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#201e1d]">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-black text-[#201e1d] font-heading tracking-tight">
                    Assigned Homework &amp; Online Challenges
                  </h2>
                </div>
                <p className="text-xs font-medium text-[#645c50] mt-0.5">
                  Track live turn-in percentages, average scores, and nudge pending students.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('assign')}
                className="min-h-[38px] px-4 py-2 bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Assignment</span>
              </button>
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="p-8 text-center bg-[#eee7db] rounded-2xl border-2 border-border shadow-[4px_4px_0px_0px_#1E1B4B] space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f9f4ed] border-2 border-border text-xs font-black text-[#201e1d] shadow-[2px_2px_0px_0px_#1E1B4B] uppercase tracking-wider mb-1">
                  Empty Notice
                </div>
                <FileCheck className="w-8 h-8 text-[#645c50] mx-auto" />
                <h4 className="font-heading font-black text-base text-[#201e1d]">
                  {assignmentsList.length === 0
                    ? 'No active homework assignments yet'
                    : `No active assignments for ${selectedCohort}`}
                </h4>
                <p className="text-xs text-[#645c50] max-w-sm mx-auto">
                  {assignmentsList.length === 0
                    ? "Click '+ New Assignment' to create your first round for students."
                    : 'Assign a diagnostic or practice round to start tracking live student completion and submission stats.'}
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('assign')}
                  className="mt-2 min-h-[38px] px-5 py-2 bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] font-black text-xs rounded-xl border-2 border-border shadow-[2px_2px_0px_0px_#1E1B4B] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
                >
                  + New Assignment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssignments.map((asg) => {
                  const percent = asg.totalStudents > 0 ? Math.round((asg.completedCount / asg.totalStudents) * 100) : 0;
                  const pendingCount = Math.max(0, asg.totalStudents - asg.completedCount);
                  const isNudged = Boolean(nudgedAssignments[asg.id]);

                  return (
                    <div
                      key={asg.id}
                      className="p-5 rounded-2xl border-2 border-border bg-[#f9f4ed] shadow-[4px_4px_0px_0px_#1E1B4B] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full bg-[#eee7db] border border-border text-[10px] font-bold text-[#645c50]">
                              {asg.cohortName}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-border text-[10px] font-bold text-[#272e1b] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDueRelative(asg.dueDate)}
                            </span>
                            <span className="text-xs font-mono font-bold text-[#645c50]">
                              {asg.questionIds.length} Qs • {asg.durationMinutes} min
                            </span>
                          </div>
                          <h4 className="font-heading font-black text-base text-[#201e1d] truncate">
                            {asg.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="px-3 py-1 rounded-full bg-[#f9f4ed] border-2 border-border shadow-[2px_2px_0px_0px_#1E1B4B] text-xs font-black text-[#201e1d]">
                            {asg.completedCount > 0 ? `Avg ${asg.averageScorePercent}%` : 'No Submissions'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-[#645c50]">
                          <span>
                            {asg.completedCount} of {asg.totalStudents} completed ({percent}%)
                          </span>
                          <span>
                            {asg.totalStudents === 0 ? (
                              <span className="text-[#645c50] font-semibold">0 students enrolled</span>
                            ) : pendingCount > 0 ? (
                              `${pendingCount} pending`
                            ) : (
                              <span className="text-[#272e1b] font-black">All completed! 🎉</span>
                            )}
                          </span>
                        </div>
                        <div className="w-full h-3 bg-[#eee7db] rounded-full border-2 border-border overflow-hidden">
                          <div
                            className="h-full bg-[#ccdbb2] border-r-2 border-border transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          {pendingCount > 0 && (
                            <button
                              type="button"
                              onClick={() => handleNudgePending(asg)}
                              disabled={isNudged}
                              className={`min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-[#201e1d] shadow-offset-2 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 cursor-pointer ${
                                isNudged
                                  ? 'bg-[#ccdbb2] text-[#272e1b]'
                                  : 'bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] hover:shadow-offset-3 hover:-translate-y-0.5'
                              }`}
                            >
                              {isNudged ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Nudge Sent!</span>
                                </>
                              ) : (
                                <>
                                  <Bell className="w-3.5 h-3.5" />
                                  <span>Nudge Pending ({pendingCount})</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onNavigate('roster')}
                            className="min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-lg bg-[#eee7db] hover:bg-[#dcd3c4] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                          >
                            View Submissions
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(asg.testCode)}
                          className="inline-flex items-center gap-1 text-[11px] text-[#645c50] font-mono font-bold hover:text-[#201e1d] px-2 py-1 rounded bg-[#eee7db] border border-[#201e1d] transition-colors cursor-pointer"
                          title="Click to copy assignment code"
                        >
                          <span>Code: {asg.testCode}</span>
                          {copiedCode === asg.testCode ? (
                            <Check className="w-3 h-3 text-[#272e1b]" />
                          ) : (
                            <Copy className="w-3 h-3 text-[#645c50]" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Class Stats & Health Radar + Student Triage */}
        <div className="lg:col-span-5 space-y-8">
          {/* Section 3: Class Stats & Health Radar (Topic Mastery Breakdown) */}
          <div
            id="section-health"
            className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-6 scroll-mt-20"
          >
            <div className="pb-3 border-b-2 border-[#201e1d]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-[#201e1d] font-heading tracking-tight">
                  Class Health Radar 🎯
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('mastery')}
                  className="min-h-[32px] text-xs font-bold text-[#645c50] hover:text-[#201e1d] flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Full Matrix</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-0.5">
                Cognitive gap detection across Cambridge syllabus units.
              </p>
            </div>

            {dynamicTopicGaps.length === 0 && dynamicTopicStrong.length === 0 ? (
              <div className="p-8 text-center bg-[#eee7db] rounded-2xl border-2 border-border shadow-[4px_4px_0px_0px_#1E1B4B] space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f9f4ed] border-2 border-border text-xs font-black text-[#201e1d] shadow-[2px_2px_0px_0px_#1E1B4B] uppercase tracking-wider mb-1">
                  Empty Notice
                </div>
                <Target className="w-8 h-8 text-[#645c50] mx-auto" />
                <h4 className="font-heading font-black text-base text-[#201e1d]">
                  No topic mastery telemetry recorded yet
                </h4>
                <p className="text-xs text-[#645c50] max-w-sm mx-auto">
                  Cognitive gap detection and syllabus unit accuracy will automatically populate here as students complete quiz rounds.
                </p>
              </div>
            ) : (
              <>
                {/* Critical Gap Topics (< 65% accuracy) */}
                {dynamicTopicGaps.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#991b1b] tracking-wider font-heading">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Critical Gap Topics (Needs Remedial Action)</span>
                    </div>

                    <div className="space-y-2.5">
                      {dynamicTopicGaps.map((gap, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border-2 border-border bg-[#fde8e8]/50 shadow-[2px_2px_0px_0px_#1E1B4B] space-y-2 hover:bg-[#fde8e8] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading font-black text-xs sm:text-sm text-[#201e1d]">
                              {gap.topic}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-[#fde8e8] border border-border font-mono text-xs font-black text-[#991b1b]">
                              {gap.accuracy}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-[11px] font-semibold text-[#645c50]">
                              {gap.strugglingCount} students falling behind
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemedialRound(gap.topic, gap.subject)}
                              className="min-h-[32px] px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] border-2 border-border shadow-[2px_2px_0px_0px_#1E1B4B] hover:shadow-[3px_3px_0px_0px_#1E1B4B] hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1 cursor-pointer"
                              title={`Generate remedial round for ${gap.topic}`}
                            >
                              <Zap className="w-3 h-3 fill-[#201e1d]" />
                              <span>Remedial Round</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strongest Topics (>= 65% accuracy) */}
                {dynamicTopicStrong.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase text-[#272e1b] tracking-wider font-heading">
                      <Award className="w-3.5 h-3.5 text-[#272e1b]" />
                      <span>Strongest Syllabus Units (Mastery Confirmed)</span>
                    </div>

                    <div className="space-y-2">
                      {dynamicTopicStrong.slice(0, 3).map((st, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border-2 border-border bg-[#f0fae1]/50 shadow-[2px_2px_0px_0px_#1E1B4B] flex items-center justify-between gap-2"
                        >
                          <div>
                            <h4 className="font-heading font-bold text-xs text-[#201e1d]">
                              {st.topic}
                            </h4>
                            <span className="text-[10px] text-[#645c50]">
                              {st.attempts} question rounds completed
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-[#ccdbb2] border border-border font-mono text-xs font-black text-[#272e1b]">
                            {st.accuracy}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section 4: Student Flagging & Triage Hub */}
          <div
            id="section-triage"
            className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-6 scroll-mt-20"
          >
            <div className="pb-3 border-b-2 border-[#201e1d]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-[#201e1d] font-heading tracking-tight">
                    Student Flagging &amp; Triage
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#fde8e8] border-2 border-[#201e1d] text-[10px] font-black text-[#991b1b]">
                    {activeTriageCount} Flagged
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('roster')}
                  className="min-h-[32px] text-xs font-bold text-[#645c50] hover:text-[#201e1d] flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Full Roster</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-0.5">
                Students exhibiting high wrong answers, guessing &lt;8s, or inactivity &gt;4d.
              </p>
            </div>

            {/* Filter Chips with Live Badge Counts */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTriageFilter('all')}
                className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#201e1d] transition-all duration-75 cursor-pointer ${
                  triageFilter === 'all'
                    ? 'bg-[#201e1d] text-[#f9f4ed] shadow-offset-2'
                    : 'bg-[#eee7db] text-[#645c50] hover:bg-[#dcd3c4]'
                }`}
              >
                All ({triageCounts.all})
              </button>
              <button
                type="button"
                onClick={() => setTriageFilter('error_rate')}
                className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#201e1d] transition-all duration-75 cursor-pointer ${
                  triageFilter === 'error_rate'
                    ? 'bg-[#fde8e8] text-[#991b1b] shadow-offset-2'
                    : 'bg-[#eee7db] text-[#645c50] hover:bg-[#dcd3c4]'
                }`}
              >
                High Errors ({triageCounts.error_rate})
              </button>
              <button
                type="button"
                onClick={() => setTriageFilter('rapid_guessing')}
                className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#201e1d] transition-all duration-75 cursor-pointer ${
                  triageFilter === 'rapid_guessing'
                    ? 'bg-[#fed7aa] text-[#643312] shadow-offset-2'
                    : 'bg-[#eee7db] text-[#645c50] hover:bg-[#dcd3c4]'
                }`}
              >
                Rapid Guessers ({triageCounts.rapid_guessing})
              </button>
              <button
                type="button"
                onClick={() => setTriageFilter('inactive')}
                className={`min-h-[34px] px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#201e1d] transition-all duration-75 cursor-pointer ${
                  triageFilter === 'inactive'
                    ? 'bg-[#eee7db] text-[#201e1d] shadow-offset-2 font-black'
                    : 'bg-[#eee7db] text-[#645c50] hover:bg-[#dcd3c4]'
                }`}
              >
                Inactive &gt; 4d ({triageCounts.inactive})
              </button>
            </div>

            {/* Triage Cards */}
            <div className="space-y-3">
              {triageStudents.length === 0 ? (
                <div className="p-8 text-center bg-[#eee7db] rounded-2xl border-2 border-dashed border-[#201e1d] space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#272e1b] mx-auto" />
                  <h4 className="font-heading font-black text-sm text-[#201e1d]">
                    No students currently flagged for triage.
                  </h4>
                  <p className="text-xs text-[#645c50]">
                    All student activity within expected accuracy thresholds.
                  </p>
                </div>
              ) : filteredTriageStudents.length === 0 ? (
                <div className="p-8 text-center bg-[#eee7db] rounded-2xl border-2 border-[#201e1d] space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-[#272e1b] mx-auto" />
                  <h4 className="font-heading font-black text-sm text-[#201e1d]">
                    No students currently flagged in this category!
                  </h4>
                  <p className="text-xs text-[#645c50]">All cohorts are performing within normal ranges.</p>
                </div>
              ) : (
                filteredTriageStudents.map((student) => {
                  const isResolved = student.status === 'resolved';
                  const isPackAssigned = student.status === 'pack_assigned';

                  return (
                    <div
                      key={student.id}
                      className={`p-4 rounded-2xl border-2 border-[#201e1d] shadow-offset-2 transition-all space-y-3 ${
                        isResolved
                          ? 'bg-[#f0fae1]/40 opacity-75'
                          : isPackAssigned
                          ? 'bg-[#ffe1d0]/20'
                          : 'bg-[#f9f4ed]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl border-2 border-[#201e1d] flex items-center justify-center font-heading font-black text-sm shadow-offset-2 shrink-0"
                            style={{ backgroundColor: student.avatarBg }}
                          >
                            {student.initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-heading font-black text-sm text-[#201e1d] truncate">
                                {student.name}
                              </h4>
                              {isResolved ? (
                                <span className="px-2 py-0.5 rounded-md bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-bold text-[#272e1b]">
                                  Resolved ✓
                                </span>
                              ) : isPackAssigned ? (
                                <span className="px-2 py-0.5 rounded-md bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-bold text-[#643312]">
                                  Recovery Pack Assigned
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md bg-[#fde8e8] border border-[#201e1d] text-[10px] font-bold text-[#991b1b]">
                                  {student.reasonBadge}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#645c50] font-semibold block truncate">
                              {student.cohort} • Active: {student.lastActive}
                            </span>
                          </div>
                        </div>

                        <span className="font-mono text-xs font-black text-[#201e1d] shrink-0">
                          {student.accuracy}% Acc
                        </span>
                      </div>

                      <p className="text-xs font-medium text-[#645c50] leading-relaxed bg-[#eee7db] p-2.5 rounded-xl border-2 border-[#dcd3c4]">
                        {student.detail}
                      </p>

                      {/* Triage Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        {!isResolved && (
                          <button
                            type="button"
                            disabled={isPackAssigned}
                            onClick={() => handleAssignRecoveryPack(student.id, student.name)}
                            className={`min-h-[34px] px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-[#201e1d] shadow-offset-2 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center gap-1.5 ${
                              isPackAssigned
                                ? 'bg-[#eee7db] text-[#645c50] border-[#c0b6a5] cursor-not-allowed shadow-none'
                                : 'bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] hover:shadow-offset-3 hover:-translate-y-0.5 cursor-pointer'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>{isPackAssigned ? 'Pack Assigned' : 'Assign 5-Q Recovery Pack'}</span>
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onNavigate('roster', { studentId: student.id })}
                            className="min-h-[34px] px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#eee7db] hover:bg-[#dcd3c4] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                          >
                            Inspect Roster
                          </button>
                          {!isResolved ? (
                            <button
                              type="button"
                              onClick={() => handleResolveFlag(student.id, student.name)}
                              className="min-h-[34px] px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#ccdbb2] hover:bg-[#b8c99d] text-[#272e1b] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                              title="Resolve student flag"
                            >
                              Resolve
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTriageStudents((prev) =>
                                  prev.map((s) => (s.id === student.id ? { ...s, status: 'flagged' } : s))
                                );
                                showToast(`Flag re-opened for ${student.name}.`, 'info');
                              }}
                              className="min-h-[34px] px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#eee7db] hover:bg-[#dcd3c4] text-[#645c50] border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
                            >
                              Re-open
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Diagnostic Test Generator Modal */}
      <AnimatePresence>
        {isDiagModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsDiagModalOpen(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="diag-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] shadow-offset-6 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-[#ffe1d0] border-b-2 border-[#201e1d] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#201e1d] text-[#ffe1d0] flex items-center justify-center shadow-offset-2 shrink-0">
                    <Zap className="w-5 h-5 fill-[#ffe1d0]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 id="diag-modal-title" className="font-heading font-black text-lg text-[#201e1d]">
                        Quick Diagnostic Generator
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[9px] font-black uppercase text-[#272e1b]">
                        Cambridge Standard
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#645c50]">
                      Compile and deploy standardized Cambridge exams in seconds.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDiagModalOpen(false)}
                  className="p-2 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#eee7db] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4 text-[#201e1d]" />
                </button>
              </div>

              {/* Scrollable Modal Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
                {/* 1. Subject Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                    1. Select Subject
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {SUBJECT_CATALOG.map((subj) => {
                      const isSelected = diagSubject === subj.code;
                      return (
                        <button
                          key={subj.code}
                          type="button"
                          onClick={() => setDiagSubject(subj.code)}
                          className={`p-2.5 rounded-xl border-2 border-[#201e1d] text-left transition-all duration-75 cursor-pointer min-h-[44px] ${
                            isSelected
                              ? 'bg-[#ccdbb2] text-[#272e1b] shadow-offset-2 font-black'
                              : 'bg-[#f9f4ed] hover:bg-[#eee7db] text-[#645c50]'
                          }`}
                        >
                          <span className="block text-[10px] font-mono font-bold">{subj.code}</span>
                          <span className="font-heading font-bold text-xs">{subj.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Question Count */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                    2. Question Count
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20].map((count) => {
                      const isSelected = diagCount === count;
                      return (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setDiagCount(count)}
                          className={`py-2 rounded-xl border-2 border-[#201e1d] font-heading font-black text-sm transition-all duration-75 min-h-[44px] cursor-pointer ${
                            isSelected
                              ? 'bg-[#ffe1d0] text-[#201e1d] shadow-offset-2'
                              : 'bg-[#f9f4ed] hover:bg-[#eee7db] text-[#645c50]'
                          }`}
                        >
                          {count} Qs
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Focus Mode */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                    3. Diagnostic Focus Area
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDiagFocus('gap')}
                      className={`p-3 rounded-xl border-2 border-[#201e1d] text-left transition-all duration-75 min-h-[52px] cursor-pointer ${
                        diagFocus === 'gap'
                          ? 'bg-[#fed7aa] text-[#201e1d] shadow-offset-2 font-black'
                          : 'bg-[#f9f4ed] hover:bg-[#eee7db] text-[#645c50]'
                      }`}
                    >
                      <span className="font-heading font-black text-xs block">Weakness Gap</span>
                      <span className="text-[10px] text-[#645c50] block mt-0.5">Auto-select struggling topics</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiagFocus('mixed')}
                      className={`p-3 rounded-xl border-2 border-[#201e1d] text-left transition-all duration-75 min-h-[52px] cursor-pointer ${
                        diagFocus === 'mixed'
                          ? 'bg-[#fed7aa] text-[#201e1d] shadow-offset-2 font-black'
                          : 'bg-[#f9f4ed] hover:bg-[#eee7db] text-[#645c50]'
                      }`}
                    >
                      <span className="font-heading font-black text-xs block">Full Breadth</span>
                      <span className="text-[10px] text-[#645c50] block mt-0.5">Balanced paper 1 mock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiagFocus('topic')}
                      className={`p-3 rounded-xl border-2 border-[#201e1d] text-left transition-all duration-75 min-h-[52px] cursor-pointer ${
                        diagFocus === 'topic'
                          ? 'bg-[#fed7aa] text-[#201e1d] shadow-offset-2 font-black'
                          : 'bg-[#f9f4ed] hover:bg-[#eee7db] text-[#645c50]'
                      }`}
                    >
                      <span className="font-heading font-black text-xs block">Topic Deep Dive</span>
                      <span className="text-[10px] text-[#645c50] block mt-0.5">Target single unit</span>
                    </button>
                  </div>
                </div>

                {/* Specific Topic Selection if in topic mode */}
                {diagFocus === 'topic' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                      Target Topic
                    </label>
                    <input
                      type="text"
                      value={diagTopic}
                      onChange={(e) => setDiagTopic(e.target.value)}
                      placeholder="e.g. Price Elasticity of Demand"
                      className="w-full min-h-[44px] px-4 py-2 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#201e1d]"
                    />
                  </div>
                )}

                {/* Target Cohort */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-[#645c50] tracking-wider font-heading">
                    Target Cohort
                  </label>
                  {availableCohorts.length > 0 ? (
                    <select
                      value={diagCohort || availableCohorts[0]}
                      onChange={(e) => setDiagCohort(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2.5 bg-[#f9f4ed] border-2 border-border rounded-xl text-xs sm:text-sm font-bold text-[#201e1d] shadow-[4px_4px_0px_0px_#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#201e1d] cursor-pointer"
                    >
                      {availableCohorts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={diagCohort}
                      onChange={(e) => setDiagCohort(e.target.value)}
                      placeholder="e.g. Year 10 Physics"
                      className="w-full min-h-[44px] px-4 py-2 bg-[#f9f4ed] border-2 border-border rounded-xl text-xs sm:text-sm font-bold text-[#201e1d] shadow-[4px_4px_0px_0px_#1E1B4B] focus:outline-none focus:ring-2 focus:ring-[#201e1d]"
                    />
                  )}
                </div>
              </div>

              {/* Modal Actions (Sticky Footer) */}
              <div className="p-4 sm:p-6 bg-[#eee7db] border-t-2 border-[#201e1d] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDiagModalOpen(false)}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2 font-bold text-xs rounded-xl text-[#645c50] hover:text-[#201e1d] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={isGeneratingDiag}
                    onClick={() => handleExecuteDiagnosticGenerator('print')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[#ccdbb2] hover:bg-[#b8c99d] text-[#272e1b] font-black text-xs sm:text-sm rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Compile &amp; Print (PDF)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isGeneratingDiag}
                    onClick={() => handleExecuteDiagnosticGenerator('assign')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-[#ffe1d0] hover:bg-[#ffc6a5] text-[#201e1d] font-black text-xs sm:text-sm rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:shadow-offset-3 hover:-translate-y-0.5 transition-all duration-75 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Assign Online Now</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
