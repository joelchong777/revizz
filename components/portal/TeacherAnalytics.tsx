'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { 
  Sparkles, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  Flame, 
  Download, 
  UserPlus, 
  Send,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  X
} from 'lucide-react';

export interface TeacherAnalyticsProps {
  initialView?: 'roster' | 'mastery';
  onNavigateToAssign?: (prefill?: string) => void;
}

export interface RosterStudent {
  id: string;
  name: string;
  init: string;
  last: string;
  xp: string;
  streak: number;
  acc: number;
  weak: string;
  tier: string;
  tagCls: string;
  avBg: string;
  flag: string;
}

export interface HeatRow {
  name: string;
  cells: number[];
}

export default function TeacherAnalytics({ 
  initialView = 'roster',
  onNavigateToAssign 
}: TeacherAnalyticsProps) {
  const [currentView, setCurrentView] = useState<'roster' | 'mastery'>(initialView);
  const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [agentNoticeDismissed, setAgentNoticeDismissed] = useState(false);

  // Roster dataset fetched from Supabase profiles
  const [rosterData, setRosterData] = useState<RosterStudent[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(true);

  // Mastery heatmap data - empty until dynamic student rounds are recorded
  const [heatRows, setHeatRows] = useState<HeatRow[]>([]);
  const cohorts: string[] = [];
  const chapters: string[] = [];
  const [mostMissedQuestions, setMostMissedQuestions] = useState<
    Array<{ id: string; stem: string; first: string; second: string }>
  >([]);

  useEffect(() => {
    let mounted = true;
    async function loadProfiles() {
      try {
        setLoadingRoster(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('id, display_name, total_xp, current_streak')
          .order('total_xp', { ascending: false });

        if (error) {
          console.error('Error fetching profiles for teacher roster:', error);
          if (mounted) setRosterData([]);
        } else if (mounted) {
          if (!data || data.length === 0) {
            setRosterData([]);
          } else {
            const mapped: RosterStudent[] = data.map((p) => {
              const name = p.display_name || 'Anonymous Student';
              const parts = name.trim().split(/\s+/);
              const init =
                parts.length > 1
                  ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                  : name.slice(0, 2).toUpperCase();
              const xpVal = p.total_xp || 0;
              const streak = p.current_streak || 0;
              const isMaster = xpVal >= 1000;
              const isProficient = xpVal >= 300;
              const tier = isMaster ? '👑 Master' : isProficient ? '⚡ Proficient' : '🌱 Novice';
              const tagCls = isMaster
                ? 'bg-[#ccdbb2] text-[#272e1b]'
                : isProficient
                ? 'bg-[#ffe1d0] text-[#643312]'
                : 'bg-[#eee7db] text-[#474238]';
              const avBg = isMaster ? '#ccdbb2' : isProficient ? '#ffe1d0' : '#eee7db';

              return {
                id: p.id,
                name,
                init,
                last: streak > 0 ? 'Recently active' : 'Inactive',
                xp: xpVal.toLocaleString(),
                streak,
                acc: 0,
                weak: '—',
                tier,
                tagCls,
                avBg,
                flag: streak === 0 ? 'Inactive' : '',
              };
            });
            setRosterData(mapped);
          }
        }
      } catch (err) {
        console.error('Failed to load roster profiles:', err);
        if (mounted) setRosterData([]);
      } finally {
        if (mounted) setLoadingRoster(false);
      }
    }

    loadProfiles();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRoster = rosterData.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.weak.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHeatBg = (val: number) => {
    if (val >= 80) return '#ccdbb2'; // Master
    if (val >= 50) return '#ffe1d0'; // Proficient
    return '#eee7db'; // Novice
  };

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedStudent(null);
      }
    };
    if (selectedStudent) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedStudent]);

  // Lock background scroll when drawer is active
  useEffect(() => {
    if (selectedStudent) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [selectedStudent]);

  const studentChapters: Array<{
    n: string;
    w: string;
    tier: string;
    tagCls: string;
    bar: string;
    pct: number;
  }> = [];

  /* ==========================================================
     VIEW: TOPIC MASTERY ANALYTICS (Mockup 2d)
     ========================================================== */
  const renderMasteryView = () => (
    <>
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#645c50]">Mastery analytics</span>
              <button
                onClick={() => setCurrentView('roster')}
                className="text-xs font-bold text-[#c67139] hover:underline"
              >
                ← View Student Roster
              </button>
            </div>
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-1">
              Subject Mastery Analytics
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold cursor-pointer">
              Last 30 days ▾
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold cursor-pointer">
              1st-try accuracy ▾
            </span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-3 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-heading text-lg font-black text-[#201e1d]">
              Syllabus chapter × class
            </span>
            <div className="flex items-center gap-2 text-xs font-bold">
              <span className="px-2.5 py-1 rounded-full bg-[#eee7db] text-[#474238]">🌱 under 50%</span>
              <span className="px-2.5 py-1 rounded-full bg-[#ffe1d0] text-[#643312]">⚡ 50–80%</span>
              <span className="px-2.5 py-1 rounded-full bg-[#ccdbb2] text-[#272e1b]">👑 over 80%</span>
            </div>
          </div>

          {heatRows.length === 0 ? (
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2">
              <div className="text-3xl">📊</div>
              <h3 className="font-heading text-base font-black text-[#201e1d]">No Mastery Data Recorded Yet</h3>
              <p className="text-xs font-semibold text-[#645c50] max-w-md">
                Class scores will populate automatically as students complete assigned syllabus practice rounds.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px] flex flex-col gap-2">
                {/* Columns Header */}
                <div className="grid grid-cols-[100px_repeat(6,1fr)] gap-2 text-xs font-bold text-[#645c50]">
                  <span></span>
                  {chapters.map((ch, idx) => (
                    <span key={idx} className="text-center font-bold">
                      {ch}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {heatRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[100px_repeat(6,1fr)] gap-2 items-center">
                    <span className="font-black text-sm text-[#201e1d]">{row.name}</span>
                    {row.cells.map((cell, cIdx) => (
                      <span
                        key={cIdx}
                        className="h-11 rounded-2xl grid place-items-center font-black text-sm border border-black/5 transition-transform hover:scale-105"
                        style={{ backgroundColor: getHeatBg(cell) }}
                      >
                        {cell}%
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Two-Column Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
          {/* Most-Missed Questions */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4]">
            <h3 className="font-heading text-lg font-black text-[#201e1d] mb-2">
              Most-missed questions · {selectedClass}
            </h3>
            {mostMissedQuestions.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#645c50]">
                No missed questions recorded yet. Data will appear as students practice.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[70px_1fr_60px_60px] gap-2 py-2 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
                  <span>ID</span>
                  <span>Question</span>
                  <span>1st try</span>
                  <span>Retry</span>
                </div>
                <div className="divide-y divide-[#eee7db]">
                  {mostMissedQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[70px_1fr_60px_60px] gap-2 items-center py-2.5 text-xs"
                    >
                      <span className="font-mono font-bold text-[#645c50]">{q.id}</span>
                      <span className="font-medium text-[#201e1d] line-clamp-1">{q.stem}</span>
                      <span className="font-bold text-[#201e1d]">{q.first}</span>
                      <span className="font-bold text-[#8c491a]">{q.second}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* What the Agent Sees Card */}
          <div className="p-5 rounded-3xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#728157]" />
              <span className="font-heading text-base font-black text-[#201e1d]">
                What the agent sees
              </span>
            </div>
            <p className="text-xs leading-relaxed text-[#3d472b]">
              {heatRows.length === 0
                ? `No learning bottlenecks detected yet for ${selectedClass}. Once students complete practice rounds, diagnostic insights and retry analysis will appear here.`
                : `${selectedClass}'s mastery data is active. Diagnostic insights and retry analysis are continuously calculated from recent practice rounds.`}
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => onNavigateToAssign?.()}
                className="px-3.5 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
              >
                Assign round
              </button>
            </div>
          </div>
        </div>
    </>
  );

  /* ==========================================================
     VIEW: CLASSES & STUDENT ROSTER (Mockup 2a)
     ========================================================== */
  const renderRosterView = () => (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#645c50]">Classes & students</span>
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
            {selectedClass}{' '}
            <span className="font-body text-base font-semibold text-[#645c50]">
              0625 · {rosterData.length} {rosterData.length === 1 ? 'student' : 'students'}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => alert('Exporting student roster CSV...')}
            className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => alert('Opening student invite drawer...')}
            className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite students
          </button>
          <button
            onClick={() => onNavigateToAssign?.()}
            className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-xs font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Assign to class
          </button>
        </div>
      </div>

      {/* Class Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {cohorts.length === 0 ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#eee7db] text-[#645c50] border border-[#dcd3c4]">
              No cohorts registered
            </span>
          ) : (
            cohorts.map((clsName) => {
              const isSelected = selectedClass === clsName;
              return (
                <button
                  key={clsName}
                  onClick={() => setSelectedClass(clsName)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-[#201e1d] text-[#f9f4ed]'
                      : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                  }`}
                >
                  {clsName}
                </button>
              );
            })
          )}
          <button
            onClick={() => setCurrentView('mastery')}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#c67139] hover:underline whitespace-nowrap ml-2"
          >
            📊 View Mastery Heatmap →
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a]" />
          <input
            type="text"
            placeholder="Search students or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139]"
          />
        </div>
      </div>

      {/* Contextual AI Agent Recommendation Banner */}
      {!agentNoticeDismissed && rosterData.length > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs">
          <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
          <span className="flex-1 leading-snug text-[#201e1d]">
            <b>Agent:</b> Tracking {rosterData.length} active {rosterData.length === 1 ? 'student' : 'students'} in {selectedClass}. Practice rounds will generate automatic recommendations.
          </span>
          <button
            onClick={() => onNavigateToAssign?.()}
            className="px-3 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] font-bold text-xs whitespace-nowrap hover:bg-[#56633f] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer"
          >
            Assign round
          </button>
        </div>
      )}

      {/* Student Roster Table */}
      <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
        {loadingRoster ? (
          <div className="py-12 text-center text-xs font-bold text-[#645c50]">
            Loading student roster...
          </div>
        ) : rosterData.length === 0 ? (
          <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#eee7db] border border-[#201e1d] flex items-center justify-center text-2xl">
              👥
            </div>
            <p className="text-sm font-semibold text-[#645c50] max-w-md">
              No students registered yet in this cohort. Share your school invite code or assign a round to begin tracking analytics.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => alert('Opening student invite drawer...')}
                className="px-4 py-2 rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                Invite students
              </button>
              <button
                onClick={() => onNavigateToAssign?.()}
                className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-2 hover:bg-[#eee7db] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
              >
                Assign round
              </button>
            </div>
          </div>
        ) : filteredRoster.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#645c50]">
            No students match &ldquo;{searchTerm}&rdquo;
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Table Header */}
              <div className="grid grid-cols-[28px_1.5fr_1fr_0.8fr_0.7fr_0.8fr_1fr_1fr_0.8fr] gap-2.5 pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
                <span></span>
                <span>Student</span>
                <span>Last active</span>
                <span>XP</span>
                <span>Streak</span>
                <span>1st-try</span>
                <span>Weakest topic</span>
                <span>Tier</span>
                <span>Status</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-[#eee7db]">
                {filteredRoster.map((r, idx) => (
                  <div
                    key={r.id || idx}
                    onClick={() => setSelectedStudent(r)}
                    className="grid grid-cols-[28px_1.5fr_1fr_0.8fr_0.7fr_0.8fr_1fr_1fr_0.8fr] gap-2.5 items-center py-2.5 text-xs hover:bg-[#eee7db]/50 cursor-pointer transition-colors rounded-xl px-1"
                  >
                    <span className="w-4 h-4 rounded border-[1.5px] border-[#a19786] block" />
                    <div className="flex items-center gap-2 font-bold text-[#201e1d]">
                      <span
                        className="w-7 h-7 rounded-full border-[1.5px] border-[#201e1d] grid place-items-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: r.avBg }}
                      >
                        {r.init}
                      </span>
                      <span>{r.name}</span>
                    </div>
                    <span className="text-[#645c50]">{r.last}</span>
                    <span className="font-bold text-[#201e1d]">{r.xp}</span>
                    <span className="font-semibold">🔥 {r.streak}</span>
                    <span className="font-black text-[#201e1d]">{r.acc}%</span>
                    <span className="text-[#474238] font-medium">{r.weak}</span>
                    <span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${r.tagCls}`}
                      >
                        {r.tier}
                      </span>
                    </span>
                    <span>
                      {r.flag ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#b2622d] text-white text-[11px] font-bold whitespace-nowrap">
                          {r.flag}
                        </span>
                      ) : (
                        <span className="text-[#a19786] text-xs">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        {rosterData.length > 0 && (
          <div className="flex items-center justify-between pt-3 text-xs text-[#645c50] border-t border-[#dcd3c4] mt-2">
            <span>Showing {filteredRoster.length} of {rosterData.length} · sorted by XP</span>
            {filteredRoster.length < rosterData.length && (
              <button
                onClick={() => setSearchTerm('')}
                className="font-bold text-[#c67139] hover:underline"
              >
                Show all →
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5 p-2 sm:p-4 text-[#201e1d] font-body">
      {currentView === 'mastery' ? renderMasteryView() : renderRosterView()}

      {/* Context-Preserving Sliding Drawer with Spring Physics */}
      <AnimatePresence>
        {selectedStudent && (
          <div
            className="fixed inset-0 z-50 flex justify-end"
            role="dialog"
            aria-modal="true"
            aria-label={`Student details for ${selectedStudent.name}`}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStudent(null)}
              className="absolute inset-0 bg-[#201e1d]/40 backdrop-blur-xs cursor-pointer"
            />
            {/* Drawer Panel */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-full max-w-xl h-full bg-[#f9f4ed] border-l-2 border-[#201e1d] shadow-offset-6 overflow-y-auto p-6 flex flex-col gap-6"
            >
              {/* Header with Close Button, Student Name, Avatar, Tier, Accuracy */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-[#201e1d]/10">
                <div className="flex items-center gap-2 text-xs font-bold text-[#645c50]">
                  <span className="font-heading text-sm text-[#201e1d]">{selectedClass}</span>
                  <span>/</span>
                  <span className="text-[#201e1d] font-black">Student Diagnostics</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  aria-label="Close drawer"
                  className="p-1.5 rounded-full border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Student Profile Card */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-3">
                <span
                  className="w-14 h-14 shrink-0 rounded-full border-2 border-[#201e1d] shadow-offset-2 grid place-items-center text-lg font-black"
                  style={{ backgroundColor: selectedStudent.avBg }}
                >
                  {selectedStudent.init}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-heading text-xl sm:text-2xl font-black text-[#201e1d] leading-tight truncate">
                      {selectedStudent.name}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold border border-[#201e1d]/20 whitespace-nowrap ${selectedStudent.tagCls}`}
                    >
                      {selectedStudent.tier}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#645c50] font-medium">
                    <span>{selectedClass}</span>
                    <span>•</span>
                    <span>Last active {selectedStudent.last}</span>
                    {selectedStudent.flag && (
                      <>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-full bg-[#b2622d] text-white text-[10px] font-bold">
                          {selectedStudent.flag}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Accuracy & KPIs Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#eee7db]/50 border-2 border-[#201e1d] shadow-offset-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-[#645c50]">1st-try accuracy</span>
                  <div className="font-heading text-2xl font-black text-[#201e1d]">
                    {selectedStudent.acc}%
                  </div>
                  <span className="text-[10px] text-[#645c50]">Class baseline</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#eee7db]/50 border-2 border-[#201e1d] shadow-offset-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-[#645c50]">Streak</span>
                  <div className="font-heading text-2xl font-black text-[#201e1d]">
                    🔥 {selectedStudent.streak}d
                  </div>
                  <span className="text-[10px] text-[#645c50]">Current streak</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#eee7db]/50 border-2 border-[#201e1d] shadow-offset-2 flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-[#645c50]">Total XP</span>
                  <div className="font-heading text-2xl font-black text-[#201e1d]">
                    {selectedStudent.xp}
                  </div>
                  <span className="text-[10px] text-[#56633f]">All-time score</span>
                </div>
              </div>

              {/* Syllabus Chapter Mastery Bars */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-black text-[#201e1d]">
                    Syllabus Chapter Mastery
                  </h3>
                  <span className="text-xs font-bold text-[#645c50]">Syllabus Topics</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  {studentChapters.length === 0 ? (
                    <p className="text-xs font-medium text-[#645c50] py-2">
                      No syllabus topics or mastery data recorded yet.
                    </p>
                  ) : (
                    studentChapters.map((ch, idx) => (
                      <div key={idx} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#201e1d] truncate max-w-[240px]" title={ch.n}>
                            {ch.n}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#474238]">{ch.w}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap border border-[#201e1d]/10 ${ch.tagCls}`}
                            >
                              {ch.tier}
                            </span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full bg-[#eee7db] border border-[#201e1d]/20 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${ch.pct}%`, backgroundColor: ch.bar }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Contextual AI Suggested Intervention */}
              <div className="p-4 rounded-2xl bg-[#f0fae1] border-2 border-[#8fa073] shadow-offset-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#728157]" />
                  <span className="font-heading text-sm font-black text-[#201e1d] flex-1">
                    AI Suggested Intervention
                  </span>
                  <span className="text-[10px] font-bold text-[#3d472b] px-2 py-0.5 rounded-full bg-[#e1eecc] border border-[#8fa073]/30">
                    Diagnostic
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-[#3d472b]">
                  {selectedStudent.weak !== '—'
                    ? `${selectedStudent.name.split(' ')[0]} shows potential focus areas in ${selectedStudent.weak}. A short targeted review round will reinforce core concepts.`
                    : `No active misconceptions detected yet for ${selectedStudent.name.split(' ')[0]}. Assign practice rounds to generate real-time diagnostic insights.`}
                </p>
              </div>

              {/* Historical Rounds Breakdown */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-base font-black text-[#201e1d]">
                    Historical Rounds Breakdown
                  </h3>
                  <span className="text-xs font-semibold text-[#645c50]">Recent sessions</span>
                </div>
                <div className="py-6 px-4 text-center rounded-xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5] flex flex-col items-center justify-center gap-1">
                  <div className="text-2xl">📋</div>
                  <span className="font-heading text-xs font-black text-[#201e1d]">
                    No Rounds Recorded Yet
                  </span>
                  <p className="text-xs text-[#645c50] max-w-xs">
                    Completed rounds for {selectedStudent.name.split(' ')[0]} will appear here with detailed accuracy breakdown.
                  </p>
                </div>
              </div>

              {/* "Draft remediation round" CTA button */}
              <div className="mt-auto pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onNavigateToAssign?.(selectedStudent.name);
                    setSelectedStudent(null);
                  }}
                  className="w-full sm:flex-1 py-3 px-4 rounded-full bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 font-heading text-xs sm:text-sm font-black hover:bg-[#b2622d] transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Draft remediation round
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                  className="w-full sm:w-auto py-3 px-5 rounded-full bg-[#eee7db] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2 font-heading text-xs sm:text-sm font-bold hover:bg-[#dcd3c4] transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                >
                  Close
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
