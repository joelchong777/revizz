'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Check,
  Copy,
  Calendar,
  Clock,
  Users,
  BookOpen,
  Filter,
  Trash2,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Award,
  Layers,
  CopyPlus,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  AssignedHomeworkRound,
  StudentSubmission,
  getAssignedHomeworkList,
  saveAssignedHomework,
  deleteAssignedHomework,
  computeHomeworkMetrics,
  isHomeworkDue,
  subscribeToHomeworkChanges
} from '@/lib/portal/assignedHomework';
import { NewHomeworkModal, SubmissionsDetailModal } from './AssignedHomeworkModal';

export interface AssignedHomeworkHubProps {
  teacherId: string;
  teacherName: string;
  onNavigateToBank?: () => void;
}

export default function AssignedHomeworkHub({
  teacherId,
  teacherName,
  onNavigateToBank,
}: AssignedHomeworkHubProps) {
  const [rounds, setRounds] = useState<AssignedHomeworkRound[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [activeDetailRound, setActiveDetailRound] = useState<AssignedHomeworkRound | null>(null);

  // Copy feedback state
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  // Load and subscribe to homework
  const refreshHomework = useCallback(() => {
    if (!teacherId) return;
    const list = getAssignedHomeworkList(teacherId);
    setRounds(list);
    setLoading(false);
  }, [teacherId]);

  useEffect(() => {
    refreshHomework();
    const unsubscribe = subscribeToHomeworkChanges(() => {
      refreshHomework();
    });
    return () => unsubscribe();
  }, [refreshHomework]);

  // Cohort list derivation
  const availableCohorts = useMemo(() => {
    const set = new Set<string>();
    for (const r of rounds) {
      if (r.cohortName) set.add(r.cohortName);
    }
    return Array.from(set);
  }, [rounds]);

  // Metrics summary
  const metrics = useMemo(() => {
    return computeHomeworkMetrics(rounds);
  }, [rounds]);

  // Filtered rounds
  const filteredRounds = useMemo(() => {
    return rounds.filter((r) => {
      // Cohort filter
      if (selectedCohort !== 'all' && r.cohortName !== selectedCohort) {
        return false;
      }

      // Status filter
      const isDue = isHomeworkDue(r);
      const effectiveStatus = r.status === 'closed' || isDue ? 'closed' : 'active';
      if (statusFilter !== 'all' && effectiveStatus !== statusFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = r.title.toLowerCase().includes(q);
        const matchesCode = r.testCode.toLowerCase().includes(q);
        const matchesCohort = r.cohortName.toLowerCase().includes(q);
        const matchesTopic = r.topics.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesCode && !matchesCohort && !matchesTopic) {
          return false;
        }
      }

      return true;
    });
  }, [rounds, selectedCohort, statusFilter, searchQuery]);

  const handleCopyCode = (round: AssignedHomeworkRound) => {
    if (typeof window === 'undefined') return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(round.testCode);
      setCopiedCodeId(round.id);
      setTimeout(() => setCopiedCodeId(null), 2000);
    }
  };

  const handleCopyLink = (round: AssignedHomeworkRound) => {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const link = `${origin}/?assignmentId=${encodeURIComponent(round.id)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedLinkId(round.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }
  };

  const handleDuplicate = (round: AssignedHomeworkRound) => {
    const newCodeNum = Math.floor(100 + Math.random() * 900);
    const newTestCode = `REV-${newCodeNum}`;
    const duplicated: AssignedHomeworkRound = {
      ...round,
      id: `hw-${Date.now()}-${newTestCode.toLowerCase()}`,
      title: `${round.title} (Copy)`,
      testCode: newTestCode,
      createdAt: new Date().toISOString(),
      submissions: [],
      status: 'active',
    };
    saveAssignedHomework(teacherId, duplicated);
    refreshHomework();
  };

  const handleDelete = (roundId: string) => {
    if (confirm('Are you sure you want to delete this assigned homework round?')) {
      deleteAssignedHomework(teacherId, roundId);
      refreshHomework();
    }
  };

  return (
    <div className="space-y-6 pb-12 font-body">
      {/* 1. Teacher Account & Unique Identity Banner */}
      <div className="bg-[#fffaf5] border-2 sm:border-3 border-[#201e1d] rounded-[24px] sm:rounded-[32px] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#fed7aa] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              👩‍🏫
            </div>
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#fef08a] border-1.5 border-[#201e1d] text-[11px] font-black uppercase tracking-wider text-[#201e1d]">
                  Educator Portal
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] border-1.5 border-[#201e1d] font-mono text-[11px] font-bold text-[#645c50]">
                  Account: {teacherName}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
                Assigned Homework History
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-[#645c50] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 inline shrink-0" />
                <span>
                  Assigned rounds and student submissions are private and account-unique to this educator profile.
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            {onNavigateToBank && (
              <button
                type="button"
                onClick={onNavigateToBank}
                className="px-3.5 py-2.5 rounded-2xl border-2 border-[#201e1d] bg-white font-bold text-xs sm:text-sm text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
              >
                <BookOpen className="w-4 h-4" />
                <span>Question Bank</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl border-2 border-[#201e1d] bg-[#ffe1d0] hover:bg-[#ffc6a5] font-black text-xs sm:text-sm text-[#201e1d] shadow-[4px_4px_0_0_#201e1d] active:translate-y-[2px] cursor-pointer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Assign New Homework</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Tactile 3D KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Assigned */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#645c50] uppercase tracking-wider">
              Total Assigned
            </span>
            <div className="w-7 h-7 rounded-lg bg-white border border-[#201e1d] flex items-center justify-center text-sm shadow-[1px_1px_0_0_#201e1d]">
              📚
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading">
              {metrics.totalAssigned}
            </div>
            <div className="text-[11px] font-bold text-[#645c50] mt-0.5">
              Across all class cohorts
            </div>
          </div>
        </div>

        {/* Active Homework */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#645c50] uppercase tracking-wider">
              Active Rounds
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#bbf7d0] border border-[#201e1d] flex items-center justify-center text-sm shadow-[1px_1px_0_0_#201e1d]">
              🟢
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-heading">
              {metrics.activeCount}
            </div>
            <div className="text-[11px] font-bold text-[#645c50] mt-0.5">
              Currently open for students
            </div>
          </div>
        </div>

        {/* Total Submissions */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#645c50] uppercase tracking-wider">
              Total Submissions
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#fed7aa] border border-[#201e1d] flex items-center justify-center text-sm shadow-[1px_1px_0_0_#201e1d]">
              📝
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading">
              {metrics.totalSubmissions}
            </div>
            <div className="text-[11px] font-bold text-[#645c50] mt-0.5">
              Completed student drills
            </div>
          </div>
        </div>

        {/* Average Accuracy */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[22px] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#645c50] uppercase tracking-wider">
              Class Accuracy
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#fef08a] border border-[#201e1d] flex items-center justify-center text-sm shadow-[1px_1px_0_0_#201e1d]">
              🎯
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading">
              {metrics.averageAccuracy}%
            </div>
            <div className="text-[11px] font-bold text-[#645c50] mt-0.5">
              Average across all attempts
            </div>
          </div>
        </div>
      </div>

      {/* 3. Toolbar & Filters */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#645c50]" />
          <input
            type="text"
            placeholder="Search by title, topic, or test code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3.5 py-2.5 bg-white border-2 border-[#201e1d] rounded-2xl font-bold text-xs sm:text-sm text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] focus:outline-hidden"
          />
        </div>

        {/* Cohort & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cohort Selector */}
          <div className="flex items-center gap-1 bg-white border-2 border-[#201e1d] rounded-2xl px-3 py-1.5 shadow-[2px_2px_0_0_#201e1d]">
            <Users className="w-3.5 h-3.5 text-[#645c50]" />
            <select
              value={selectedCohort}
              onChange={(e) => setSelectedCohort(e.target.value)}
              className="bg-transparent font-bold text-xs text-[#201e1d] focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Classes ({rounds.length})</option>
              {availableCohorts.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Buttons */}
          <div className="flex items-center p-1 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
            {(['all', 'active', 'closed'] as const).map((st) => {
              const active = statusFilter === st;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    active
                      ? 'bg-[#ffe1d0] text-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                      : 'text-[#645c50] hover:text-[#201e1d]'
                  }`}
                >
                  {st === 'all' ? 'All' : st === 'active' ? 'Active' : 'Closed'}
                </button>
              );
            })}
          </div>

          {/* Reset button if filtered */}
          {(selectedCohort !== 'all' || statusFilter !== 'all' || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setSelectedCohort('all');
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="px-3 py-2 rounded-2xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. Assignment Cards List */}
      <div className="space-y-4">
        {filteredRounds.length === 0 ? (
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[28px] p-8 sm:p-12 text-center shadow-[4px_4px_0_0_#201e1d] space-y-4 max-w-xl mx-auto my-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#fed7aa] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] flex items-center justify-center text-3xl">
              📂
            </div>
            <div className="space-y-1">
              <h2 className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
                {rounds.length === 0 ? 'No Assigned Homework Yet' : 'No Assigned Homework Found'}
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                {rounds.length === 0
                  ? 'Your educator profile does not have any assigned homework rounds yet. Create a homework round to get started.'
                  : 'No assignments match the selected class cohort or status filter.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl border-2 border-[#201e1d] bg-[#ffe1d0] hover:bg-[#ffc6a5] font-black text-xs sm:text-sm text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
              >
                + Create New Homework Round
              </button>
            </div>
          </div>
        ) : (
          filteredRounds.map((round) => {
            const isDue = isHomeworkDue(round);
            const isClosed = round.status === 'closed' || isDue;
            const completedCount = round.submissions.length;
            const completionPct = round.totalStudents > 0
              ? Math.min(100, Math.round((completedCount / round.totalStudents) * 100))
              : 0;

            const roundAvgAcc = completedCount > 0
              ? Math.round(
                  round.submissions.reduce((acc, curr) => acc + curr.accuracyPercentage, 0) /
                    completedCount
                )
              : null;

            return (
              <div
                key={round.id}
                className="bg-[#f9f4ed] border-2 sm:border-3 border-[#201e1d] rounded-[24px] sm:rounded-[28px] p-4 sm:p-6 shadow-[4px_4px_0_0_#201e1d] transition-all hover:translate-y-[-1px] space-y-4"
              >
                {/* Card Top Row: Badges & Test Code */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#fce7f3] border-1.5 border-[#201e1d] font-mono text-[11px] font-black text-[#831843]">
                      {round.subjectCode} {round.subjectName}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#fef08a] border-1.5 border-[#201e1d] text-[11px] font-black text-[#201e1d]">
                      {round.cohortName}
                    </span>
                    {/* Status Badge */}
                    {isClosed ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#fee2e2] border-1.5 border-[#201e1d] text-[11px] font-black text-[#991b1b] flex items-center gap-1">
                        🔒 Closed / Due
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#bbf7d0] border-1.5 border-[#201e1d] text-[11px] font-black text-[#14532d] flex items-center gap-1">
                        🟢 Active
                      </span>
                    )}
                  </div>

                  {/* Test Code Pill with 1-click Copy */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-bold text-[#645c50]">Test Code:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(round)}
                      title="Click to copy test code for students"
                      className="px-3 py-1 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 transition-all font-mono font-black text-xs text-[#201e1d] flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedCodeId === round.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#645c50]" />
                          <span>{round.testCode}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Card Title & Topics */}
                <div className="space-y-1.5">
                  <h3 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                    {round.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {round.topics.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-white border border-[#201e1d] rounded-lg text-[11px] font-semibold text-[#645c50] shadow-[1px_1px_0_0_#201e1d]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Meta details strip: questions, timer, due date */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#645c50] pt-1">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-[#f97316]" />
                    <span>{round.roundLength} Questions</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#f97316]" />
                    <span>
                      {round.timerMode === 'Chill'
                        ? 'Untimed (Chill)'
                        : `${round.durationMinutes || 15} min (${round.timerMode})`}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#f97316]" />
                    <span>
                      Due {new Date(round.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </div>

                {/* Student Completion Progress Bar & Class Avg */}
                <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-bold text-[#201e1d] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#645c50]" />
                      <span>
                        Student Completion: <b>{completedCount}</b> of <b>{round.totalStudents}</b> completed ({completionPct}%)
                      </span>
                    </div>
                    {roundAvgAcc !== null && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#bbf7d0] border border-[#201e1d] font-mono font-black text-xs text-[#14532d]">
                        {roundAvgAcc}% Class Avg
                      </span>
                    )}
                  </div>

                  {/* Progress bar line */}
                  <div className="w-full h-3 bg-[#eee7db] rounded-full border border-[#201e1d] overflow-hidden">
                    <div
                      className="h-full bg-[#f97316] rounded-full transition-all duration-300"
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                </div>

                {/* Card Actions Strip */}
                <div className="pt-2 border-t-[1.5px] border-[#e2d9cd] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* View Submissions */}
                    <button
                      type="button"
                      onClick={() => setActiveDetailRound(round)}
                      className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-[#ffe1d0] hover:bg-[#ffc6a5] font-black text-xs text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Submissions ({completedCount})</span>
                    </button>

                    {/* Copy Student Link */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(round)}
                      className="px-3.5 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] font-bold text-xs text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedLinkId === round.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#645c50]" />
                          <span>Copy Student Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Duplicate */}
                    <button
                      type="button"
                      onClick={() => handleDuplicate(round)}
                      className="p-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
                      title="Duplicate this assignment"
                      aria-label="Duplicate"
                    >
                      <CopyPlus className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDelete(round.id)}
                      className="p-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#fee2e2] text-[#991b1b] shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 cursor-pointer"
                      title="Delete assignment"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Homework Modal */}
      <NewHomeworkModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        teacherId={teacherId}
        teacherName={teacherName}
        onCreated={() => {
          refreshHomework();
        }}
      />

      {/* Submissions Detail Modal */}
      <SubmissionsDetailModal
        isOpen={Boolean(activeDetailRound)}
        onClose={() => setActiveDetailRound(null)}
        homework={activeDetailRound}
      />
    </div>
  );
}
