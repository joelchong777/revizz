'use client';

import React, { useState } from 'react';
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
  TrendingDown
} from 'lucide-react';

export interface TeacherAnalyticsProps {
  initialView?: 'roster' | 'mastery';
  onNavigateToAssign?: (prefill?: string) => void;
}

export default function TeacherAnalytics({ 
  initialView = 'roster',
  onNavigateToAssign 
}: TeacherAnalyticsProps) {
  const [currentView, setCurrentView] = useState<'roster' | 'mastery'>(initialView);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [selectedClass, setSelectedClass] = useState('10B Physics');
  const [searchTerm, setSearchTerm] = useState('');
  const [agentNoticeDismissed, setAgentNoticeDismissed] = useState(false);

  // Roster dataset
  const rosterData = [
    { name: 'Priya S.', init: 'PS', last: '2h ago', xp: '1,280', streak: 12, acc: 86, weak: 'Waves', tier: '👑 Master', tagCls: 'bg-[#ccdbb2] text-[#272e1b]', avBg: '#ccdbb2', flag: '' },
    { name: 'Omar K.', init: 'OK', last: 'Today', xp: '1,105', streak: 7, acc: 79, weak: 'Thermal', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', avBg: '#ffe1d0', flag: '' },
    { name: 'Mei L.', init: 'ML', last: 'Yesterday', xp: '960', streak: 3, acc: 72, weak: 'Electricity', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', avBg: '#ffe1d0', flag: '' },
    { name: 'Hana O.', init: 'HO', last: '5h ago', xp: '610', streak: 5, acc: 70, weak: 'Nuclear', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', avBg: '#ffe1d0', flag: '' },
    { name: 'Alex M.', init: 'AM', last: '1h ago', xp: '340', streak: 4, acc: 66, weak: 'Waves', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', avBg: '#ffe1d0', flag: '' },
    { name: 'Sara A.', init: 'SA', last: '9 days ago', xp: '285', streak: 0, acc: 51, weak: 'Space', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', avBg: '#ffe1d0', flag: 'Inactive' },
    { name: 'Leo T.', init: 'LT', last: 'Today', xp: '240', streak: 1, acc: 48, weak: 'Thermal', tier: '🌱 Novice', tagCls: 'bg-[#eee7db] text-[#474238]', avBg: '#eee7db', flag: 'Backlog' },
    { name: 'Jonah R.', init: 'JR', last: '3 days ago', xp: '310', streak: 0, acc: 44, weak: 'Electricity', tier: '🌱 Novice', tagCls: 'bg-[#eee7db] text-[#474238]', avBg: '#ffe1d0', flag: 'Dropping' },
  ];

  // Jonah Rahman detail data
  const jonahChapters = [
    { n: 'Motion, forces & energy', w: '62%', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', bar: '#f6a06b' },
    { n: 'Thermal physics', w: '51%', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', bar: '#f6a06b' },
    { n: 'Waves', w: '47%', tier: '🌱 Novice', tagCls: 'bg-[#eee7db] text-[#474238]', bar: '#c0b6a5' },
    { n: 'Electricity & magnetism', w: '29%', tier: '🌱 Novice', tagCls: 'bg-[#eee7db] text-[#474238]', bar: '#c0b6a5' },
    { n: 'Nuclear physics', w: '40%', tier: '🌱 Novice', tagCls: 'bg-[#eee7db] text-[#474238]', bar: '#c0b6a5' },
    { n: 'Space physics', w: '55%', tier: '⚡ Proficient', tagCls: 'bg-[#ffe1d0] text-[#643312]', bar: '#f6a06b' },
  ];

  const jonahRounds = [
    { date: 'Tue 6 Oct', mode: 'Homework · Electricity · 8 Qs', score: '3/8', xp: '+34', time: '11m 02s' },
    { date: 'Mon 5 Oct', mode: 'Exam round · 10 Qs', score: '4/10', xp: '+48', time: '14m 40s' },
    { date: 'Fri 2 Oct', mode: 'Review pile · 6 Qs', score: '4/6', xp: '+45', time: '6m 12s' },
    { date: 'Wed 30 Sep', mode: 'Topic practice · Waves · 5 Qs', score: '2/5', xp: '+25', time: '4m 51s' },
  ];

  // Mastery heatmap data
  const chapters = ['Motion', 'Thermal', 'Waves', 'Electricity', 'Nuclear', 'Space'];
  const heatRows = [
    { name: '10A', cells: [84, 71, 49, 66, 58, 62] },
    { name: '10B', cells: [69, 55, 52, 31, 44, 50] },
    { name: 'Y10 avg', cells: [77, 63, 50, 49, 51, 56] },
    { name: 'Global', cells: [72, 60, 54, 57, 49, 53] },
  ];

  const mostMissedQuestions = [
    { id: 'PHY-0251', stem: 'Which circuit has the lowest total resistance?', first: '38%', second: '17%' },
    { id: 'PHY-0244', stem: 'A lamp is rated 12 V, 24 W. What current does it draw?', first: '41%', second: '29%' },
    { id: 'PHY-0318', stem: 'A wave travels 12 m in 4.0 s. Its wavelength is 0.5 m…', first: '45%', second: '40%' },
  ];

  const filteredRoster = rosterData.filter((r) =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.weak.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHeatBg = (val: number) => {
    if (val >= 80) return '#ccdbb2'; // Master
    if (val >= 50) return '#ffe1d0'; // Proficient
    return '#eee7db'; // Novice
  };

  /* ==========================================================
     VIEW: STUDENT DETAIL (Jonah Rahman Deep-Dive 2b)
     ========================================================== */
  if (selectedStudent) {
    const isJonah = selectedStudent.name.includes('Jonah');
    return (
      <div className="flex flex-col gap-5 p-2 sm:p-4 text-[#201e1d] font-body">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold text-[#645c50]">
          <button
            onClick={() => setSelectedStudent(null)}
            className="hover:text-[#c67139] flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Classes & students
          </button>
          <span>/</span>
          <span>{selectedClass}</span>
          <span>/</span>
          <span className="text-[#201e1d] font-black">{selectedStudent.name}</span>
        </div>

        {/* Header Profile Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] shadow-sm">
          <div className="flex items-center gap-4">
            <span
              className="w-16 h-16 shrink-0 rounded-full border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] grid place-items-center text-xl font-black"
              style={{ backgroundColor: selectedStudent.avBg }}
            >
              {selectedStudent.init}
            </span>
            <div>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] leading-tight">
                {selectedStudent.name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#645c50] font-medium">
                <span>{selectedClass}</span>
                <span>•</span>
                <span>Last active {selectedStudent.last}</span>
                <span>•</span>
                <span>{selectedStudent.xp} XP</span>
                {selectedStudent.flag && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#b2622d] text-white text-[11px] font-bold">
                    {selectedStudent.flag}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => alert(`Message sent to ${selectedStudent.name}`)}
              className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5"
            >
              Message
            </button>
            <button
              onClick={() => {
                if (onNavigateToAssign) {
                  onNavigateToAssign(`Custom review round for ${selectedStudent.name} on ${selectedStudent.weak}`);
                } else {
                  alert(`Intervention assigned to ${selectedStudent.name}!`);
                }
              }}
              className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-xs font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none"
            >
              Assign to {selectedStudent.name.split(' ')[0]}
            </button>
          </div>
        </div>

        {/* 4 KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-1">
            <span className="text-xs font-bold text-[#645c50]">1st-try accuracy</span>
            <div className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">
              {selectedStudent.acc}%
            </div>
            <span className="text-xs font-bold text-[#8c491a]">−27 pts in 7 days</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-1">
            <span className="text-xs font-bold text-[#645c50]">Retry success</span>
            <div className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">38%</div>
            <span className="text-xs font-bold text-[#645c50]">Class avg 55%</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-1">
            <span className="text-xs font-bold text-[#645c50]">Review pile</span>
            <div className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">24</div>
            <span className="text-xs font-bold text-[#8c491a]">+9 this week</span>
          </div>

          <div className="p-4 rounded-2xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-1">
            <span className="text-xs font-bold text-[#645c50]">Homework</span>
            <div className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">2 / 3</div>
            <span className="text-xs font-bold text-[#56633f]">1 due Fri</span>
          </div>
        </div>

        {/* Two-Column Deep-Dive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Topic Mastery Progress Bars */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-3">
            <h3 className="font-heading text-lg font-black text-[#201e1d]">Topic mastery</h3>
            <div className="flex flex-col gap-2.5">
              {jonahChapters.map((ch, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[140px_1fr_40px_90px] sm:grid-cols-[160px_1fr_40px_100px] gap-2 items-center text-xs"
                >
                  <span className="font-bold text-[#201e1d] truncate" title={ch.n}>
                    {ch.n}
                  </span>
                  <div className="h-2.5 rounded-full bg-[#eee7db] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: ch.w, backgroundColor: ch.bar }}
                    />
                  </div>
                  <span className="font-bold text-right text-[#474238]">{ch.w}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[11px] text-center whitespace-nowrap ${ch.tagCls}`}
                  >
                    {ch.tier}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Suggested Intervention + Recent Rounds */}
          <div className="flex flex-col gap-4">
            {/* Contextual AI Intervention Card */}
            <div className="p-5 rounded-3xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#728157]" />
                <span className="font-heading text-base font-black text-[#201e1d] flex-1">
                  Suggested intervention
                </span>
                <span className="text-[11px] font-bold text-[#3d472b]">
                  Agent · based on 19 answers
                </span>
              </div>
              <p className="text-xs leading-relaxed text-[#3d472b]">
                6 of Jonah’s 8 Electricity misses are on combining resistors in parallel. On retries he
                usually picks the &ldquo;added in series&rdquo; option, which points to a misconception
                rather than careless slips.
              </p>
              <div className="p-3 rounded-2xl bg-[#f9f4ed] text-xs font-medium text-[#201e1d] border border-[#dcd3c4]">
                <b>5-Q Topic Practice</b> · combined resistance · Chill (untimed) · before Fri homework
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <button
                  onClick={() => alert(`Assigned 5-Q Topic Practice to ${selectedStudent.name}`)}
                  className="px-3.5 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5"
                >
                  Assign to Jonah
                </button>
                <button
                  onClick={() => onNavigateToAssign?.('Edit questions for Jonah')}
                  className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5"
                >
                  Edit questions
                </button>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="text-xs font-bold text-[#645c50] hover:text-[#201e1d] px-2 py-1"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Recent Rounds */}
            <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4]">
              <h3 className="font-heading text-lg font-black text-[#201e1d] mb-2">Recent rounds</h3>
              <div className="divide-y divide-[#eee7db]">
                {jonahRounds.map((rnd, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[80px_1fr_40px_45px_60px] gap-2 items-center py-2.5 text-xs"
                  >
                    <span className="text-[#645c50] font-medium">{rnd.date}</span>
                    <span className="font-bold text-[#201e1d] truncate">{rnd.mode}</span>
                    <span className="font-black text-[#201e1d]">{rnd.score}</span>
                    <span className="font-bold text-[#56633f]">{rnd.xp}</span>
                    <span className="text-right text-[#645c50]">{rnd.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     VIEW: TOPIC MASTERY ANALYTICS (Mockup 2d)
     ========================================================== */
  if (currentView === 'mastery') {
    return (
      <div className="flex flex-col gap-5 p-2 sm:p-4 text-[#201e1d] font-body">
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
              Physics 0625 · Year 10
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
        </div>

        {/* Two-Column Diagnostics */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
          {/* Most-Missed Questions */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4]">
            <h3 className="font-heading text-lg font-black text-[#201e1d] mb-2">
              Most-missed questions · 10B
            </h3>
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
              10B&apos;s Electricity score fell after the 21 Sep homework. PHY-0251 and PHY-0244 have
              retry rates under 30%, so students are failing even after a hint. That suggests the
              explanation itself is unclear, not just the topic.
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => alert('Sent review request to content team!')}
                className="px-3.5 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5"
              >
                Send to content team
              </button>
              <button
                onClick={() => onNavigateToAssign?.('Re-teach round for 10B on Electricity')}
                className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5"
              >
                Plan a re-teach
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     VIEW: CLASSES & STUDENT ROSTER (Mockup 2a)
     ========================================================== */
  return (
    <div className="flex flex-col gap-5 p-2 sm:p-4 text-[#201e1d] font-body">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-[#645c50]">Classes & students</span>
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
            10B Physics{' '}
            <span className="font-body text-base font-semibold text-[#645c50]">
              0625 · 26 students
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
          {['10A Physics', '10B Physics', '11A Chemistry', '11C Economics'].map((clsName) => {
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
          })}
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
      {!agentNoticeDismissed && (
        <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs">
          <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
          <span className="flex-1 leading-snug text-[#201e1d]">
            <b>Agent:</b> 3 students are flagged. Jonah and Leo share a weak spot (series vs parallel
            resistance), so one 5-Q review round could cover both.
          </span>
          <button
            onClick={() => onNavigateToAssign?.('5-Q Review Round on series vs parallel resistance for Jonah and Leo')}
            className="px-3 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] font-bold text-xs whitespace-nowrap hover:bg-[#56633f] active:translate-y-0.5"
          >
            Draft round for 2
          </button>
        </div>
      )}

      {/* Student Roster Table */}
      <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
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
                  key={idx}
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 text-xs text-[#645c50] border-t border-[#dcd3c4] mt-2">
          <span>Showing {filteredRoster.length} of 26 · sorted by XP</span>
          <button
            onClick={() => alert('Showing all 26 students')}
            className="font-bold text-[#c67139] hover:underline"
          >
            Show all →
          </button>
        </div>
      </div>
    </div>
  );
}
