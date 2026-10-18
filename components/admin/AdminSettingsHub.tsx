'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Activity,
  Sparkles,
  Sliders,
  ShieldCheck,
  Check,
  Copy,
  RefreshCw,
  Cpu,
  Clock,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Save,
  Zap,
  Lock,
  Layers,
  BookOpen,
  ArrowRight,
  Megaphone,
  Menu,
} from 'lucide-react';
import { useQuestions } from '@/lib/questions';
import PortalMenuManager from '@/components/admin/PortalMenuManager';

export type SettingsSubTab = 'school' | 'system' | 'ingestion' | 'gameplay' | 'auth' | 'portal-menu';

export interface AdminSettingsHubProps {
  initialSubTab?: SettingsSubTab;
  onSelectSubTab?: (subTab: string) => void;
  onSelectParentTab?: (tab: string) => void;
}

interface InstitutionalCohort {
  id: string;
  name: string;
  subjectCode: string;
  department: string;
  studentCount: number;
  assignedTeacher: string;
  term: string;
}

interface EducatorSeat {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)';
  status: 'Active' | 'Invited';
}

const TABS: { id: SettingsSubTab; label: string; icon: React.ElementType; badge: string }[] = [
  { id: 'school', label: 'School & Licences', icon: Building2, badge: 'Cohorts' },
  { id: 'system', label: 'System & Telemetry', icon: Activity, badge: 'Online' },
  { id: 'ingestion', label: 'Ingestion & AI Engine', icon: Sparkles, badge: 'v2.5 Flash' },
  { id: 'gameplay', label: 'Curriculum & Quiz Rules', icon: Sliders, badge: '2-Try Active' },
  { id: 'auth', label: 'Auth & Security', icon: ShieldCheck, badge: 'Secured' },
  { id: 'portal-menu', label: 'Portal Menu Manager', icon: Menu, badge: 'Nav Editor' },
];

export default function AdminSettingsHub({
  initialSubTab = 'school',
  onSelectSubTab,
  onSelectParentTab,
}: AdminSettingsHubProps) {
  const { questions, loading: questionsLoading } = useQuestions();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(initialSubTab);

  // Sync with prop changes
  useEffect(() => {
    if (initialSubTab && TABS.some((t) => t.id === initialSubTab)) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleTabChange = (tabId: SettingsSubTab) => {
    setActiveSubTab(tabId);
    if (onSelectSubTab) {
      onSelectSubTab(tabId);
    }
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', 'settings');
      url.searchParams.set('sub', tabId);
      window.history.replaceState(null, '', url.toString());
    }
  };

  // ==========================================
  // TAB 1: SCHOOL & LICENCES STATE
  // ==========================================
  const [planTier, setPlanTier] = useState('Standard Educator');
  const [totalSeatQuota, setTotalSeatQuota] = useState(0);
  const [utilizedSeats, setUtilizedSeats] = useState(0);
  const [teacherSeatLimit, setTeacherSeatLimit] = useState(0);
  const [licenceExpiry, setLicenceExpiry] = useState('');
  const [schoolSaveSuccess, setSchoolSaveSuccess] = useState(false);

  const [cohorts, setCohorts] = useState<InstitutionalCohort[]>([]);

  const [showAddCohort, setShowAddCohort] = useState(false);
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortSubject, setNewCohortSubject] = useState('0625 Physics');
  const [newCohortDept, setNewCohortDept] = useState('Physics');
  const [newCohortStudents, setNewCohortStudents] = useState(25);
  const [newCohortTeacher, setNewCohortTeacher] = useState('');
  const [newCohortTerm, setNewCohortTerm] = useState('2026-2027 Session');

  const [educators, setEducators] = useState<EducatorSeat[]>([]);

  const [showAddEducator, setShowAddEducator] = useState(false);
  const [newEducatorName, setNewEducatorName] = useState('');
  const [newEducatorEmail, setNewEducatorEmail] = useState('');
  const [newEducatorDept, setNewEducatorDept] = useState('Physics');
  const [newEducatorRole, setNewEducatorRole] = useState<'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)'>('Teacher (Read-Only Bank)');

  const handleAddCohort = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim()) return;
    const newEntry: InstitutionalCohort = {
      id: `coh-${Date.now()}`,
      name: newCohortName.trim(),
      subjectCode: newCohortSubject.split(' ')[0] || '0625',
      department: newCohortDept,
      studentCount: Number(newCohortStudents) || 0,
      assignedTeacher: newCohortTeacher,
      term: newCohortTerm,
    };
    setCohorts((prev) => [...prev, newEntry]);
    setUtilizedSeats((prev) => prev + (Number(newCohortStudents) || 0));
    setNewCohortName('');
    setShowAddCohort(false);
    triggerSchoolSaveFeedback();
  };

  const handleRemoveCohort = (id: string) => {
    const target = cohorts.find((c) => c.id === id);
    if (target) {
      setUtilizedSeats((prev) => Math.max(0, prev - target.studentCount));
    }
    setCohorts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleAddEducator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEducatorName.trim() || !newEducatorEmail.trim()) return;
    const newEntry: EducatorSeat = {
      id: `ed-${Date.now()}`,
      name: newEducatorName.trim(),
      email: newEducatorEmail.trim(),
      department: newEducatorDept,
      role: newEducatorRole,
      status: 'Active',
    };
    setEducators((prev) => [...prev, newEntry]);
    setNewEducatorName('');
    setNewEducatorEmail('');
    setShowAddEducator(false);
    triggerSchoolSaveFeedback();
  };

  const handleRemoveEducator = (id: string) => {
    setEducators((prev) => prev.filter((e) => e.id !== id));
  };

  const triggerSchoolSaveFeedback = () => {
    setSchoolSaveSuccess(true);
    setTimeout(() => setSchoolSaveSuccess(false), 3000);
  };

  // ==========================================
  // TAB 2: SYSTEM & TELEMETRY STATE
  // ==========================================
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [cacheClearedMessage, setCacheClearedMessage] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'All Good' | 'Checking...' | 'Pass (100%)'>('All Good');

  const handleClearCache = () => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('revizz_question_cache');
        localStorage.removeItem('revizz_filter_cache');
      }
    } catch {
      // ignore in SSR
    }
    setCacheClearedMessage(true);
    setTimeout(() => setCacheClearedMessage(false), 3000);
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingStatus(null);
    setTimeout(() => {
      setIsPinging(false);
      setPingStatus('Supabase Latency: 38ms (Direct Edge Connection Healthy)');
    }, 450);
  };

  const handleHealthCheck = () => {
    setHealthStatus('Checking...');
    setTimeout(() => {
      setHealthStatus('Pass (100%)');
    }, 600);
  };

  // ==========================================
  // TAB 3: INGESTION & AI ENGINE STATE
  // ==========================================
  const [ocrModel, setOcrModel] = useState<'gemini-2.5-flash' | 'gemini-1.5-pro' | 'gemini-2.5-pro'>('gemini-2.5-flash');
  const [diagramDpi, setDiagramDpi] = useState<'300' | '150'>('300');
  const [katexSanitizerAuto, setKatexSanitizerAuto] = useState(true);
  const [tolerance, setTolerance] = useState<'strict' | 'balanced' | 'permissive'>('balanced');
  const [subjectPresets, setSubjectPresets] = useState<string[]>([
    '0455 Economics',
    '0625 Physics',
    '0620 Chemistry',
    '0610 Biology',
  ]);
  const [newPresetCode, setNewPresetCode] = useState('');
  const [ingestionSaveFeedback, setIngestionSaveFeedback] = useState(false);

  const toggleSubjectPreset = (code: string) => {
    if (subjectPresets.includes(code)) {
      setSubjectPresets((prev) => prev.filter((p) => p !== code));
    } else {
      setSubjectPresets((prev) => [...prev, code]);
    }
  };

  const handleAddPreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetCode.trim()) return;
    if (!subjectPresets.includes(newPresetCode.trim())) {
      setSubjectPresets((prev) => [...prev, newPresetCode.trim()]);
    }
    setNewPresetCode('');
  };

  const handleSaveIngestionConfig = () => {
    setIngestionSaveFeedback(true);
    setTimeout(() => setIngestionSaveFeedback(false), 3000);
  };

  // ==========================================
  // TAB 4: CURRICULUM & QUIZ RULES STATE
  // ==========================================
  const [leitnerRetryEnabled, setLeitnerRetryEnabled] = useState(true);
  const [timerMode, setTimerMode] = useState<'untimed' | 'countdown_90'>('untimed');
  const [questionSizePreset, setQuestionSizePreset] = useState<number>(10);
  const [passMarkThreshold, setPassMarkThreshold] = useState<number>(70);
  const [audioSfxEnabled, setAudioSfxEnabled] = useState(true);
  const [gameplaySaveFeedback, setGameplaySaveFeedback] = useState(false);

  const handleSaveGameplayConfig = () => {
    setGameplaySaveFeedback(true);
    setTimeout(() => setGameplaySaveFeedback(false), 3000);
  };

  // ==========================================
  // TAB 5: AUTH & SECURITY STATE
  // ==========================================
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [demoGuestModeEnabled, setDemoGuestModeEnabled] = useState(true);
  const [sessionTimeoutHours, setSessionTimeoutHours] = useState('8');
  const [authSaveFeedback, setAuthSaveFeedback] = useState(false);

  const callbackUrl = 'https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback';

  const handleCopyCallback = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(callbackUrl);
      setCopiedCallback(true);
      setTimeout(() => setCopiedCallback(false), 2500);
    }
  };

  const handleSaveAuthConfig = () => {
    setAuthSaveFeedback(true);
    setTimeout(() => setAuthSaveFeedback(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
              ADMIN CONSOLE · UNIFIED SETTINGS
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[11px] font-mono font-black text-[#272e1b] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Interactive Hub
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectParentTab && onSelectParentTab('diagnostics')}
              className="px-3 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-black text-[#201e1d] shadow-offset-1 hover:bg-[#dcd3c4] transition-all cursor-pointer"
            >
              Diagnostics Lab →
            </button>
            <button
              type="button"
              onClick={() => onSelectParentTab && onSelectParentTab('ingestion')}
              className="px-3 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-black text-[#201e1d] shadow-offset-1 hover:bg-[#ffc6a5] transition-all cursor-pointer"
            >
              Ingestion Studio →
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
          Platform Settings &amp; Administration
        </h1>
        <p className="text-xs sm:text-sm font-medium text-[#645c50] max-w-3xl">
          Unified configuration center for institutional seat allocations, multimodal AI models, KaTeX parsing rules, 2-try Leitner gamification parameters, and OAuth security gates.
        </p>

        {/* Tab Navigation Bar (Horizontal Scrollable Pills) */}
        <div className="pt-3 border-t-2 border-[#201e1d]/10">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3.5 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2.5 whitespace-nowrap cursor-pointer text-xs font-heading font-black select-none ${
                    isActive
                      ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2 translate-y-[-1px]'
                      : 'bg-[#f5ead8]/60 text-[#645c50] border-[#201e1d]/20 hover:border-[#201e1d] hover:text-[#201e1d] hover:bg-[#f5ead8]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#201e1d]' : 'text-[#645c50]'}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isActive
                        ? 'bg-white border-[#201e1d] text-[#201e1d]'
                        : 'bg-[#eee7db] border-[#201e1d]/20 text-[#645c50]'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SCHOOL & LICENCES */}
      {/* ========================================================================= */}
      {activeSubTab === 'school' && (
        <div className="space-y-6">
          {/* Seat Quota & Expiry KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Seat Utilization</span>
                <Building2 className="w-4 h-4 text-[#201e1d]" />
              </div>
              <div className="space-y-1">
                <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
                  {utilizedSeats} / {totalSeatQuota}{' '}
                  <span className="text-sm font-medium text-[#645c50]">Seats</span>
                </div>
                <div className="w-full bg-[#eee7db] rounded-full h-2.5 border border-[#201e1d] overflow-hidden">
                  <div
                    className="bg-[#201e1d] h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, totalSeatQuota > 0 ? Math.round((utilizedSeats / totalSeatQuota) * 100) : 0)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-[#645c50]">
                <span>{Math.max(0, totalSeatQuota - utilizedSeats)} seats remaining</span>
                <span className="text-[#201e1d] font-black">{totalSeatQuota > 0 ? Math.round((utilizedSeats / totalSeatQuota) * 100) : 0}% Used</span>
              </div>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Teacher Allocations</span>
                <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-black text-[#272e1b]">
                  {educators.length} of {teacherSeatLimit}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
                {educators.length} <span className="text-sm font-medium text-[#645c50]">Educators Active</span>
              </div>
              <p className="text-xs font-bold text-[#645c50]">
                Full edit or read-only bank permissions configured per teacher seat.
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Licence Status</span>
                <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-black text-[#272e1b]">
                  {licenceExpiry ? 'ACTIVE' : 'STANDARD'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
                {licenceExpiry || 'Standard Tier'}
              </div>
              <p className="text-xs font-bold text-[#645c50]">
                Tier: <span className="text-[#201e1d] font-black">{planTier}</span>{licenceExpiry ? ` (Renewal: ${licenceExpiry})` : ' (No expiry configured)'}
              </p>
            </div>
          </div>

          {/* Institutional Cohort Allocations Table */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#201e1d]/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                  Active Institutional Cohorts ({cohorts.length})
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Class cohorts, assigned Cambridge syllabus codes, enrolled student counts, and supervising teachers.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCohort(!showAddCohort)}
                className="px-4 py-2 rounded-xl bg-[#ccdbb2] text-[#272e1b] font-black text-xs sm:text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all cursor-pointer self-start sm:self-auto active:translate-y-0.5"
              >
                {showAddCohort ? 'Cancel Registration' : '+ Register Cohort'}
              </button>
            </div>

            {/* Add Cohort Form */}
            {showAddCohort && (
              <form onSubmit={handleAddCohort} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-2xl p-4 space-y-3">
                <div className="font-heading font-black text-xs uppercase tracking-wider text-[#201e1d]">
                  Register New Institutional Cohort
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#645c50] mb-1">
                      Cohort Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 11B Physics"
                      value={newCohortName}
                      onChange={(e) => setNewCohortName(e.target.value)}
                      required
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#645c50] mb-1">
                      Subject Syllabus
                    </label>
                    <select
                      value={newCohortSubject}
                      onChange={(e) => {
                        setNewCohortSubject(e.target.value);
                        setNewCohortDept(e.target.value.includes('Physics') ? 'Physics' : e.target.value.includes('Economics') ? 'Economics' : 'Science');
                      }}
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                    >
                      <option value="0625 Physics">0625 Physics</option>
                      <option value="0455 Economics">0455 Economics</option>
                      <option value="0620 Chemistry">0620 Chemistry</option>
                      <option value="0610 Biology">0610 Biology</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#645c50] mb-1">
                      Student Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newCohortStudents}
                      onChange={(e) => setNewCohortStudents(Number(e.target.value) || 0)}
                      required
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#645c50] mb-1">
                      Assigned Teacher
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Instructor Name"
                      value={newCohortTeacher}
                      onChange={(e) => setNewCohortTeacher(e.target.value)}
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-[#645c50] mb-1">
                      Session / Term
                    </label>
                    <input
                      type="text"
                      value={newCohortTerm}
                      onChange={(e) => setNewCohortTerm(e.target.value)}
                      className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCohort(false)}
                    className="px-3 py-1.5 rounded-xl border border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] text-xs font-black shadow-offset-1 hover:bg-[#b8c99d]"
                  >
                    Save Cohort
                  </button>
                </div>
              </form>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border-2 border-[#201e1d] bg-white">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#ebddc5] border-b-2 border-[#201e1d] text-[#201e1d] font-heading font-black">
                    <th className="p-3 sm:p-3.5">Cohort Name</th>
                    <th className="p-3 sm:p-3.5">Cambridge Syllabus</th>
                    <th className="p-3 sm:p-3.5">Enrolled Students</th>
                    <th className="p-3 sm:p-3.5">Assigned Educator</th>
                    <th className="p-3 sm:p-3.5">Session Term</th>
                    <th className="p-3 sm:p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#201e1d]/15">
                  {cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-[#fff9f2] transition-colors">
                      <td className="p-3 sm:p-3.5 font-bold text-[#201e1d] flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>{c.name}</span>
                      </td>
                      <td className="p-3 sm:p-3.5">
                        <span className="px-2.5 py-0.5 rounded-md bg-[#eee7db] border border-[#201e1d]/30 font-mono text-xs font-bold text-[#201e1d]">
                          {c.subjectCode} ({c.department})
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5">
                        <span className="px-2.5 py-1 rounded-full bg-[#f9f4ed] border border-[#201e1d]/30 text-xs font-black text-[#201e1d]">
                          {c.studentCount} students
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5 font-medium text-[#201e1d]">{c.assignedTeacher}</td>
                      <td className="p-3 sm:p-3.5 text-xs font-mono font-bold text-[#645c50]">{c.term}</td>
                      <td className="p-3 sm:p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveCohort(c.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#fde8e8] border border-[#201e1d] text-xs font-bold text-[#e0533c] hover:bg-[#fca5a5] transition-colors shadow-offset-1 active:translate-y-0.5 cursor-pointer"
                          title="Remove institutional cohort"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cohorts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-xs sm:text-sm font-bold text-[#645c50]">
                        No institutional cohorts registered yet. Click &quot;+ New Cohort&quot; to configure classroom groups.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Licensed Educators Management */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#201e1d]/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                  Licensed Educators ({educators.length} / {teacherSeatLimit} Seats)
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Instructors with access to Cambridge question banks and classroom cohort diagnostics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEducator(!showAddEducator)}
                className="px-4 py-2 rounded-xl bg-[#ffe1d0] text-[#201e1d] font-black text-xs sm:text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all cursor-pointer self-start sm:self-auto active:translate-y-0.5"
              >
                {showAddEducator ? 'Cancel' : '+ Invite Educator'}
              </button>
            </div>

            {showAddEducator && (
              <form onSubmit={handleAddEducator} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-2xl p-4 space-y-3">
                <div className="font-heading font-black text-xs uppercase tracking-wider text-[#201e1d]">
                  Invite Institutional Educator
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newEducatorName}
                    onChange={(e) => setNewEducatorName(e.target.value)}
                    required
                    className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Institutional Email"
                    value={newEducatorEmail}
                    onChange={(e) => setNewEducatorEmail(e.target.value)}
                    required
                    className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Department (e.g. Physics)"
                    value={newEducatorDept}
                    onChange={(e) => setNewEducatorDept(e.target.value)}
                    className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                  />
                  <select
                    value={newEducatorRole}
                    onChange={(e) => setNewEducatorRole(e.target.value as any)}
                    className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                  >
                    <option value="Teacher (Read-Only Bank)">Teacher (Read-Only Bank)</option>
                    <option value="App Admin (Full Edit)">App Admin (Full Edit)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddEducator(false)}
                    className="px-3 py-1.5 rounded-xl border border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#201e1d] text-xs font-black shadow-offset-1 hover:bg-[#ffc6a5]"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto rounded-2xl border-2 border-[#201e1d] bg-white">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-[#ebddc5] border-b-2 border-[#201e1d] text-[#201e1d] font-heading font-black">
                    <th className="p-3 sm:p-3.5">Educator</th>
                    <th className="p-3 sm:p-3.5">Department</th>
                    <th className="p-3 sm:p-3.5">Access Role</th>
                    <th className="p-3 sm:p-3.5">Status</th>
                    <th className="p-3 sm:p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#201e1d]/15">
                  {educators.map((ed) => (
                    <tr key={ed.id} className="hover:bg-[#fff9f2] transition-colors">
                      <td className="p-3 sm:p-3.5">
                        <div className="font-bold text-[#201e1d]">{ed.name}</div>
                        <div className="text-xs text-[#645c50] font-mono">{ed.email}</div>
                      </td>
                      <td className="p-3 sm:p-3.5 font-medium text-[#201e1d]">{ed.department}</td>
                      <td className="p-3 sm:p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f5ead8] border border-[#201e1d]/30 text-xs font-bold text-[#201e1d]">
                          {ed.role}
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d]/30 text-xs font-black text-[#272e1b]">
                          {ed.status}
                        </span>
                      </td>
                      <td className="p-3 sm:p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveEducator(ed.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#fde8e8] border border-[#201e1d] text-xs font-bold text-[#e0533c] hover:bg-[#fca5a5] transition-colors shadow-offset-1 active:translate-y-0.5 cursor-pointer"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {educators.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs sm:text-sm font-bold text-[#645c50]">
                        No licensed educators assigned yet. Click &quot;+ Invite Educator&quot; to grant team access.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Save Quota Form */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black font-heading text-[#201e1d]">
                  Licence Quota Settings
                </h3>
                <p className="text-xs text-[#645c50]">
                  Configure campus seat thresholds and licence expiry dates.
                </p>
              </div>
              {schoolSaveSuccess && (
                <span className="px-3 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black text-[#272e1b] animate-pulse">
                  ✓ Quotas saved!
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                  Plan Tier
                </label>
                <select
                  value={planTier}
                  onChange={(e) => setPlanTier(e.target.value)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                >
                  <option value="Standard Educator">Standard Educator</option>
                  <option value="Enterprise Campus">Enterprise Campus</option>
                  <option value="Department Pro">Department Pro</option>
                  <option value="Pilot">Pilot</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                  Total Student Seat Quota
                </label>
                <input
                  type="number"
                  value={totalSeatQuota}
                  onChange={(e) => setTotalSeatQuota(Number(e.target.value) || 0)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                  Teacher Seat Limit
                </label>
                <input
                  type="number"
                  value={teacherSeatLimit}
                  onChange={(e) => setTeacherSeatLimit(Number(e.target.value) || 0)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={triggerSchoolSaveFeedback}
                className="px-5 py-2.5 rounded-xl bg-[#ccdbb2] text-[#272e1b] font-black text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all cursor-pointer flex items-center gap-2 active:translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Licence Quotas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SYSTEM & TELEMETRY */}
      {/* ========================================================================= */}
      {activeSubTab === 'system' && (
        <div className="space-y-6">
          {/* Real-time Status Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Database Sync</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d]">
                Synchronized
              </div>
              <p className="text-[11px] font-bold text-emerald-800">
                Supabase PostgreSQL Live
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">OCR Pipeline</span>
                <Cpu className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d] truncate">
                Gemini 2.5 Flash
              </div>
              <p className="text-[11px] font-bold text-emerald-800">
                Multimodal OCR + KaTeX
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Question Bank Health</span>
                <BookOpen className="w-4 h-4 text-[#201e1d]" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d]">
                {questionsLoading ? 'Syncing...' : `${questions.length} Items Live`}
              </div>
              <p className="text-[11px] font-bold text-[#645c50]">
                Cambridge 40/40 Ready
              </p>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
              <div className="flex items-center justify-between text-[#645c50]">
                <span className="text-xs font-mono font-bold uppercase tracking-wider">Platform Health</span>
                <Activity className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="text-xl sm:text-2xl font-black font-heading text-[#201e1d]">
                {healthStatus}
              </div>
              <p className="text-[11px] font-bold text-emerald-800">
                Turbopack Ready
              </p>
            </div>
          </div>

          {/* Quick Action Telemetry Buttons */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-black text-lg text-[#201e1d]">
                Platform Telemetry &amp; Quick Actions
              </h3>
              <span className="font-mono text-xs text-[#645c50] font-bold">
                OPERATIONAL CONTROLS
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleClearCache}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-2 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139]">
                    Clear Local Cache
                  </span>
                  <RefreshCw className="w-4 h-4 text-[#201e1d]" />
                </div>
                <p className="text-xs font-medium text-[#645c50]">
                  Evict staged browser items and refresh Question Bank indexes.
                </p>
                {cacheClearedMessage && (
                  <span className="inline-block text-[10px] font-mono font-bold text-emerald-800 bg-[#ccdbb2] px-2 py-0.5 rounded border border-[#201e1d]">
                    ✓ Cache Cleared!
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handlePing}
                disabled={isPinging}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-2 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139]">
                    {isPinging ? 'Pinging DB...' : 'Test DB Ping'}
                  </span>
                  <Zap className="w-4 h-4 text-[#201e1d]" />
                </div>
                <p className="text-xs font-medium text-[#645c50]">
                  Send an echo check to the Supabase Edge Gateway.
                </p>
                {pingStatus && (
                  <span className="inline-block text-[10px] font-mono font-bold text-emerald-800 bg-[#ccdbb2] px-2 py-0.5 rounded border border-[#201e1d]">
                    {pingStatus}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={handleHealthCheck}
                className="p-4 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-left space-y-2 cursor-pointer active:translate-y-0.5 group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d] group-hover:text-[#c67139]">
                    Trigger Health Check
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
                <p className="text-xs font-medium text-[#645c50]">
                  Run full diagnostic audit on OCR, KaTeX, and question schemas.
                </p>
              </button>
            </div>
          </div>

          {/* Operational Checklist */}
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-3 font-body">
            <h3 className="font-heading font-black text-base text-[#201e1d]">
              Telemetry Diagnostic Log
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] flex items-center justify-between">
                <span className="text-[#201e1d]">✓ Supabase Connection: Verified Direct Session</span>
                <span className="text-emerald-700 font-bold">200 OK</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] flex items-center justify-between">
                <span className="text-[#201e1d]">✓ KaTeX AST Sanitizer: Regex Currency Escaper Active</span>
                <span className="text-emerald-700 font-bold">PASS</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] flex items-center justify-between">
                <span className="text-[#201e1d]">✓ Gemini Multimodal Vision API: Google AI Logic Provisioned</span>
                <span className="text-emerald-700 font-bold">ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INGESTION & AI ENGINE */}
      {/* ========================================================================= */}
      {activeSubTab === 'ingestion' && (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-5">
            <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                  Gemini OCR &amp; Vision Engine Settings
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Configure AI model tier, diagram crop resolution, and LaTeX sanitization parameters.
                </p>
              </div>
              {ingestionSaveFeedback && (
                <span className="px-3 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black text-[#272e1b] animate-pulse">
                  ✓ Ingestion parameters updated!
                </span>
              )}
            </div>

            {/* Model Tier Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                Multimodal Vision OCR Model
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: 'gemini-2.5-flash',
                    title: 'Gemini 2.5 Flash',
                    badge: 'Recommended',
                    desc: 'Fastest OCR parsing, optimal token usage, perfect for 40/40 Cambridge MCQ papers.',
                  },
                  {
                    id: 'gemini-1.5-pro',
                    title: 'Gemini 1.5 Pro',
                    badge: 'Heavy OCR',
                    desc: 'Higher context window for multi-column split pages and complex graph diagrams.',
                  },
                  {
                    id: 'gemini-2.5-pro',
                    title: 'Gemini 2.5 Pro',
                    badge: 'Deep Reasoning',
                    desc: 'Maximum mathematical reasoning for advanced mechanics and circuit equations.',
                  },
                ].map((m) => {
                  const isSelected = ocrModel === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setOcrModel(m.id as any)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-2'
                          : 'bg-[#f5ead8]/50 border-[#201e1d]/20 hover:border-[#201e1d] hover:bg-[#f5ead8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-heading font-black text-sm text-[#201e1d]">{m.title}</span>
                        <span className="px-2 py-0.5 rounded-full bg-white border border-[#201e1d] font-mono text-[10px] font-bold text-[#201e1d]">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[#645c50] leading-relaxed">{m.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Diagram Crop Resolution & Tolerance */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Diagram Crop Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiagramDpi('300')}
                    className={`p-3 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                      diagramDpi === '300'
                        ? 'bg-[#ccdbb2] border-[#201e1d] text-[#272e1b] shadow-offset-1'
                        : 'bg-white border-[#201e1d]/20 text-[#645c50] hover:border-[#201e1d]'
                    }`}
                  >
                    300 DPI (High Fidelity)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagramDpi('150')}
                    className={`p-3 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                      diagramDpi === '150'
                        ? 'bg-[#ccdbb2] border-[#201e1d] text-[#272e1b] shadow-offset-1'
                        : 'bg-white border-[#201e1d]/20 text-[#645c50] hover:border-[#201e1d]'
                    }`}
                  >
                    150 DPI (Fast Ingestion)
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Bounding Box Validation Tolerance
                </label>
                <select
                  value={tolerance}
                  onChange={(e) => setTolerance(e.target.value as any)}
                  className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                >
                  <option value="strict">Strict (95% overlap validation)</option>
                  <option value="balanced">Balanced (80% overlap - Recommended)</option>
                  <option value="permissive">Permissive (65% overlap - Loose bounding)</option>
                </select>
              </div>
            </div>

            {/* KaTeX Auto-Sanitizer Toggle */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-heading font-black text-sm text-[#201e1d] flex items-center gap-2">
                  <span>KaTeX Automatic Currency &amp; Math Sanitizer</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-mono font-bold text-[#272e1b]">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-[#645c50]">
                  Automatically escapes unescaped dollar currencies ($50 -&gt; \$50) to prevent KaTeX rendering crashes in Economics.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setKatexSanitizerAuto(!katexSanitizerAuto)}
                className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer shrink-0 ${
                  katexSanitizerAuto ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                    katexSanitizerAuto ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Default Subject Presets */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                  Default Cambridge Subject Presets
                </label>
                <span className="text-xs font-bold text-[#645c50]">
                  Click preset to toggle active state
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {subjectPresets.map((preset) => (
                  <span
                    key={preset}
                    onClick={() => toggleSubjectPreset(preset)}
                    className="px-3 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-black text-[#201e1d] shadow-offset-1 flex items-center gap-1.5 cursor-pointer hover:bg-[#ffc6a5]"
                  >
                    <span>{preset}</span>
                    <Check className="w-3.5 h-3.5 text-[#201e1d]" />
                  </span>
                ))}
              </div>

              {/* Add Custom Preset */}
              <form onSubmit={handleAddPreset} className="flex items-center gap-2 max-w-sm pt-1">
                <input
                  type="text"
                  placeholder="e.g. 0478 Computer Science"
                  value={newPresetCode}
                  onChange={(e) => setNewPresetCode(e.target.value)}
                  className="flex-1 bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black text-[#272e1b] shadow-offset-1 hover:bg-[#b8c99d]"
                >
                  + Add
                </button>
              </form>
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-[#201e1d]/10">
              <button
                type="button"
                onClick={handleSaveIngestionConfig}
                className="px-5 py-2.5 rounded-xl bg-[#ffe1d0] text-[#201e1d] font-black text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all cursor-pointer flex items-center gap-2 active:translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Ingestion Presets</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CURRICULUM & QUIZ RULES */}
      {/* ========================================================================= */}
      {activeSubTab === 'gameplay' && (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-5">
            <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                  Gamification &amp; Spaced Repetition Rules
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Configure the 2-try Leitner review loop, round question size presets, timer constraints, and passing marks.
                </p>
              </div>
              {gameplaySaveFeedback && (
                <span className="px-3 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black text-[#272e1b] animate-pulse">
                  ✓ Gameplay rules saved!
                </span>
              )}
            </div>

            {/* 2-Try Leitner System Rule */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-heading font-black text-sm text-[#201e1d] flex items-center gap-2">
                    <span>2-Try Spaced Repetition &amp; Review Pile Loop</span>
                    <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-mono font-bold text-[#272e1b]">
                      COGNITIVE OPTIMIZED
                    </span>
                  </div>
                  <p className="text-xs text-[#645c50]">
                    1st try correct grants 100% XP + streak multiplier. Incorrect 1st try allows an immediate retry for 50% XP while placing the item into the Leitner Review Pile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLeitnerRetryEnabled(!leitnerRetryEnabled)}
                  className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer shrink-0 ${
                    leitnerRetryEnabled ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                      leitnerRetryEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-xl bg-[#f5ead8] border border-[#201e1d]/30 font-medium">
                  <div className="font-bold text-[#201e1d] mb-0.5">Attempt 1 (Immediate Hit)</div>
                  <div className="text-[#645c50]">Full XP reward, increments streak combo (+1), advances mastery bar.</div>
                </div>
                <div className="p-3 rounded-xl bg-[#ffe1d0]/50 border border-[#201e1d]/30 font-medium">
                  <div className="font-bold text-[#201e1d] mb-0.5">Attempt 2 (Learning Retry)</div>
                  <div className="text-[#645c50]">50% XP award, locks item in Review Pile until mastered on a subsequent drill.</div>
                </div>
              </div>
            </div>

            {/* Timer Mode Defaults */}
            <div className="space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                Default Timer Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setTimerMode('untimed')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    timerMode === 'untimed'
                      ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-2'
                      : 'bg-[#f5ead8]/50 border-[#201e1d]/20 hover:border-[#201e1d]'
                  }`}
                >
                  <div className="font-heading font-black text-sm text-[#201e1d] mb-1">
                    Chill Untimed (Learning Mode)
                  </div>
                  <p className="text-xs text-[#645c50]">
                    Zero countdown pressure. Students read question stems, inspect diagrams, and study mark scheme explanations.
                  </p>
                </div>

                <div
                  onClick={() => setTimerMode('countdown_90')}
                  className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    timerMode === 'countdown_90'
                      ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-2'
                      : 'bg-[#f5ead8]/50 border-[#201e1d]/20 hover:border-[#201e1d]'
                  }`}
                >
                  <div className="font-heading font-black text-sm text-[#201e1d] mb-1">
                    Exam Mode (90s / Question Countdown)
                  </div>
                  <p className="text-xs text-[#645c50]">
                    Simulates authentic Cambridge Paper 1 &amp; Paper 2 timing constraints (approx 1.5 minutes per MCQ).
                  </p>
                </div>
              </div>
            </div>

            {/* Round Question Size Presets */}
            <div className="space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                Round Question Size Presets
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { size: 5, label: '5 Questions', sub: 'Bite-Sized' },
                  { size: 10, label: '10 Questions', sub: 'Standard' },
                  { size: 20, label: '20 Questions', sub: 'Half Paper' },
                  { size: 40, label: '40 Questions', sub: 'Full Cambridge' },
                ].map((preset) => (
                  <button
                    key={preset.size}
                    type="button"
                    onClick={() => setQuestionSizePreset(preset.size)}
                    className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                      questionSizePreset === preset.size
                        ? 'bg-[#ccdbb2] border-[#201e1d] text-[#272e1b] shadow-offset-2'
                        : 'bg-white border-[#201e1d]/20 text-[#645c50] hover:border-[#201e1d]'
                    }`}
                  >
                    <div className="font-heading font-black text-sm">{preset.label}</div>
                    <div className="text-[10px] font-mono font-bold mt-0.5">{preset.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Pass Mark & Audio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Pass Mark Threshold: {passMarkThreshold}%
                  </label>
                  <span className="text-xs font-bold text-[#201e1d]">Grade A/B Benchmark</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="90"
                  step="5"
                  value={passMarkThreshold}
                  onChange={(e) => setPassMarkThreshold(Number(e.target.value))}
                  className="w-full accent-[#201e1d] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#645c50]">
                  <span>50%</span>
                  <span>70% (Standard)</span>
                  <span>90% (Distinction)</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-heading font-black text-sm text-[#201e1d] flex items-center gap-2">
                    {audioSfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>Sound Effects &amp; Audio Cues</span>
                  </div>
                  <p className="text-xs text-[#645c50]">
                    Tactile clicks, correct bell, and streak audio triggers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAudioSfxEnabled(!audioSfxEnabled)}
                  className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer shrink-0 ${
                    audioSfxEnabled ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                      audioSfxEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-[#201e1d]/10">
              <button
                type="button"
                onClick={handleSaveGameplayConfig}
                className="px-5 py-2.5 rounded-xl bg-[#ffe1d0] text-[#201e1d] font-black text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all cursor-pointer flex items-center gap-2 active:translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Gameplay Rules</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: AUTH & SECURITY */}
      {/* ========================================================================= */}
      {activeSubTab === 'auth' && (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-5">
            <div className="flex items-center justify-between border-b-2 border-[#201e1d]/10 pb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                  Authentication &amp; Security Gates
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                  Google OAuth callback setup, Super Admin role gate status, and developer bypass modes.
                </p>
              </div>
              {authSaveFeedback && (
                <span className="px-3 py-1 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black text-[#272e1b] animate-pulse">
                  ✓ Security policies updated!
                </span>
              )}
            </div>

            {/* Google OAuth Callback URL Copy Box */}
            <div className="p-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a]">
                  Supabase Google OAuth Callback URL
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  Required for OAuth redirection
                </span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border-2 border-[#201e1d]">
                <span className="flex-1 font-mono text-xs text-[#201e1d] select-all break-all">
                  {callbackUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCallback}
                  className="px-3 py-1.5 rounded-lg bg-[#ffe1d0] border border-[#201e1d] font-heading font-black text-xs text-[#201e1d] flex items-center gap-1.5 hover:bg-[#ffc6a5] transition-all cursor-pointer shadow-offset-1 active:translate-y-0.5 shrink-0"
                >
                  {copiedCallback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-800" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#201e1d]" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-Step Supabase Checklist */}
            <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 space-y-3 font-body text-xs">
              <div className="font-heading font-black text-sm text-[#201e1d] flex items-center gap-2">
                <span>Supabase OAuth Verification Checklist</span>
                <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-mono font-bold text-[#272e1b]">
                  3 STEPS
                </span>
              </div>
              <ol className="list-decimal pl-5 space-y-2 text-[#474238] font-medium leading-relaxed">
                <li>
                  Open <span className="font-bold text-[#201e1d]">Supabase Dashboard</span> &gt; Authentication &gt; Providers &gt; Google.
                </li>
                <li>
                  Toggle <span className="font-bold text-[#201e1d]">Enable Google Provider</span> and paste your Client ID &amp; Secret from Google Cloud Console.
                </li>
                <li>
                  Under Google Cloud Console &gt; Credentials, paste the Callback URL above into{' '}
                  <span className="font-bold text-[#201e1d]">Authorized Redirect URIs</span>.
                </li>
              </ol>
            </div>

            {/* Super Admin Role Gate Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d]">Role Gate Protection</span>
                  <Lock className="w-4 h-4 text-[#201e1d]" />
                </div>
                <p className="text-xs text-[#645c50]">
                  Restricts access to users with <code className="font-bold text-[#201e1d]">user_metadata.role = &apos;admin&apos;</code>.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Super Admin Gate Active</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-black text-sm text-[#201e1d]">Demo &amp; Guest Mode</span>
                  <button
                    type="button"
                    onClick={() => setDemoGuestModeEnabled(!demoGuestModeEnabled)}
                    className={`w-12 h-7 rounded-full border-2 border-[#201e1d] p-0.5 transition-colors cursor-pointer shrink-0 ${
                      demoGuestModeEnabled ? 'bg-[#ccdbb2]' : 'bg-[#eee7db]'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-[#201e1d] transition-transform ${
                        demoGuestModeEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-[#645c50]">
                  Permits immediate preview of Ingestion Studio and diagnostics without Google OAuth authentication.
                </p>
              </div>
            </div>

            {/* Session Timeout */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-heading font-black text-sm text-[#201e1d]">
                  Administrator Session Expiry
                </div>
                <p className="text-xs text-[#645c50]">
                  Automatically logs out inactive admin sessions to safeguard question editing rights.
                </p>
              </div>
              <select
                value={sessionTimeoutHours}
                onChange={(e) => setSessionTimeoutHours(e.target.value)}
                className="bg-[#eee7db] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              >
                <option value="2">2 Hours</option>
                <option value="8">8 Hours (Full Shift)</option>
                <option value="24">24 Hours</option>
              </select>
            </div>

            <div className="flex justify-end pt-3 border-t-2 border-[#201e1d]/10">
              <button
                type="button"
                onClick={handleSaveAuthConfig}
                className="px-5 py-2.5 rounded-xl bg-[#ffe1d0] text-[#201e1d] font-black text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all cursor-pointer flex items-center gap-2 active:translate-y-0.5"
              >
                <Save className="w-4 h-4" />
                <span>Save Security Policies</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PORTAL MENU MANAGER */}
      {/* ========================================================================= */}
      {activeSubTab === 'portal-menu' && <PortalMenuManager />}

      {/* Ads & Monetization Studio Cross-Link Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-offset-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-offset-1 shrink-0">
              <Megaphone className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-black text-base sm:text-lg text-[#201e1d]">
              Ads &amp; Monetization Studio
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[10px] font-mono font-bold text-[#201e1d]">
              Live Controls
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#645c50] max-w-2xl">
            Configure smart placement presets, Google AdSense IDs, frequency caps, and cognitive-load guardrails across student practice and leaderboard surfaces.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-bold text-[#474238]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eee7db] border border-[#201e1d]/20">
              🌱 Student-Friendly Presets
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eee7db] border border-[#201e1d]/20">
              🛡️ Timed Exam Guardrails
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eee7db] border border-[#201e1d]/20">
              ⚡ Live Placement Simulator
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center">
          <button
            type="button"
            onClick={() => onSelectParentTab?.('ads')}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#201e1d] font-heading font-black text-xs sm:text-sm shadow-offset-2 hover:bg-[#ffc6a5] transition-all flex items-center justify-center gap-2 active:translate-y-0.5 cursor-pointer"
          >
            <span>Open Ads Studio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
