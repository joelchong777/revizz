'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import IngestionHub from '@/components/portal/IngestionHub';
import AdminCMS from '@/components/portal/AdminCMS';
import AdminTools from '@/components/portal/AdminTools';
import IngestionDiagnostics from '@/components/portal/IngestionDiagnostics';
import PortalMenuManager from '@/components/admin/PortalMenuManager';
import AdminSettingsHub, { SettingsSubTab } from '@/components/admin/AdminSettingsHub';
import { useQuestions } from '@/lib/questions';
import type { StagingQuestion } from '@/types/ingestion';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import {
  BookOpen,
  Layers,
  Sparkles,
  CheckCircle2,
  Database,
  Cpu,
  Sigma,
  Code2,
  Building2,
  Activity
} from 'lucide-react';

export interface AppAdminHubProps {
  activeTab: string;
  onSelectTab: (tab: string, sub?: string) => void;
  selectedQuestionId?: string;
  onSelectQuestionId?: (id: string) => void;
  subTab?: string | null;
}

export default function AppAdminHub({
  activeTab,
  onSelectTab,
  selectedQuestionId,
  onSelectQuestionId,
  subTab,
}: AppAdminHubProps) {
  const { questions, loading: questionsLoading } = useQuestions();

  // Diagnostics interactive state
  const [selectedDiagQuestionIdx, setSelectedDiagQuestionIdx] = useState(0);
  const [testEquationInput, setTestEquationInput] = useState('\\text{Opportunity Cost} = \\frac{\\Delta \\text{Return}}{\\Delta \\text{Sacrifice}}');
  const [testCurrencyInput, setTestCurrencyInput] = useState('Price increased from $50 to $120, yielding revenue $R = P \\times Q$.');

  // Convert Questions to StagingQuestion for diagnostic pipeline inspection
  const diagnosticQuestions: StagingQuestion[] = useMemo(() => {
    return (questions || []).slice(0, 10).map((q, idx) => ({
      question_number: idx + 1,
      cambridge_source_ref: q.id || `q-${String(idx + 1).padStart(2, '0')}`,
      topic_name: q.topic || 'General',
      stem_markdown: q.stem_markdown || '',
      diagram: q.has_diagram
        ? {
            has_diagram: true,
            image_url: q.image_url,
            alt_description: 'Diagram illustration',
          }
        : undefined,
      options: (q.options || []).map((opt, optIdx) => ({
        label: (['A', 'B', 'C', 'D'][optIdx] || 'A') as 'A' | 'B' | 'C' | 'D',
        content_markdown: opt.text_markdown || '',
        is_correct: opt.id === q.correct_option_id,
      })),
      explanation_markdown: q.explanation_markdown || 'Mark scheme answer explanation.',
      status: 'active',
      page_number: Math.floor(idx / 3) + 2,
      validation_status: 'valid',
    }));
  }, [questions]);

  // Keep selectedDiagQuestionIdx within bounds if diagnosticQuestions changes
  useEffect(() => {
    if (diagnosticQuestions.length > 0 && selectedDiagQuestionIdx >= diagnosticQuestions.length) {
      setSelectedDiagQuestionIdx(0);
    }
  }, [diagnosticQuestions.length, selectedDiagQuestionIdx]);

  const activeDiagQuestion = diagnosticQuestions[selectedDiagQuestionIdx] || diagnosticQuestions[0] || null;

  const handleOpenEditor = (questionId: string) => {
    if (onSelectQuestionId) {
      onSelectQuestionId(questionId);
    }
    onSelectTab('editor');
  };

  const renderIngestion = () => (
    <div className="space-y-4">
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl px-4 py-2.5 shadow-[2px_2px_0_#201e1d] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
            INGESTION ENGINE v2.4
          </span>
          <h1 className="text-base sm:text-lg font-black text-[#201e1d] font-heading tracking-tight">
            Cambridge Ingestion Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTab('diagnostics')}
            className="px-3 py-1.5 rounded-xl bg-[#ebddc5] border-2 border-[#201e1d] font-bold text-xs hover:bg-[#ffe1d0] transition-colors shadow-offset-2 active:translate-y-0.5"
          >
            KaTeX Diagnostics
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('bank')}
            className="px-3.5 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-black text-xs hover:bg-[#ffc6a5] transition-colors shadow-offset-2 active:translate-y-0.5"
          >
            Question Bank →
          </button>
        </div>
      </div>
      <IngestionHub />
    </div>
  );

  switch (activeTab) {
    case 'ingestion':
      return renderIngestion();

    case 'diagnostics':
      return (
        <div className="space-y-6">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a]">
                  PIPELINE HEALTH · TELEMETRY
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  KaTeX Sanitizer, Currency Isolator & OCR Validator
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Ingestion Diagnostics Lab
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Stress-test LaTeX rendering, sanitize unescaped dollar currencies, and verify bounding box integrity.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#201e1d] shadow-offset-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                OCR Engine Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sigma className="w-5 h-5 text-[#201e1d]" />
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    Live KaTeX Equation Validator
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238]">
                  Formula Test
                </span>
              </div>
              <textarea
                value={testEquationInput}
                onChange={(e) => setTestEquationInput(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-mono text-xs text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] resize-none"
                placeholder="Enter LaTeX formula e.g. \frac{a}{b}"
              />
              <div className="p-3 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] min-h-[52px] flex items-center justify-center">
                <div className="text-sm font-medium text-[#201e1d]">
                  <span className="font-mono text-xs text-[#645c50]">Input: </span>
                  <code className="text-xs bg-white/60 px-1 py-0.5 rounded">{testEquationInput}</code>
                </div>
              </div>
            </div>

            <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-[#201e1d]" />
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    Currency & Regex Sanitizer
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238]">
                  $ Escaping
                </span>
              </div>
              <textarea
                value={testCurrencyInput}
                onChange={(e) => setTestCurrencyInput(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-mono text-xs text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] resize-none"
                placeholder="Enter text with dollar currency e.g. $100"
              />
              <div className="p-3 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] min-h-[52px] flex flex-col justify-center text-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#645c50]">
                  Sanitized Result:
                </span>
                <span className="font-mono text-xs text-[#201e1d] break-all">
                  {sanitizeKaTeX(testCurrencyInput)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#dcd3c4] pb-4">
              <div>
                <h3 className="font-heading font-black text-lg text-[#201e1d]">
                  Question AST & Bounding Box Diagnostics
                </h3>
                <p className="text-xs text-[#645c50]">
                  Run automated 6-point verification on question payload (KaTeX, OCR crops, distractor schema, Cambridge metadata).
                </p>
              </div>

              {diagnosticQuestions.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#474238]">Inspect Question:</span>
                  <select
                    value={selectedDiagQuestionIdx}
                    onChange={(e) => setSelectedDiagQuestionIdx(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-bold text-xs text-[#201e1d] focus:outline-none cursor-pointer"
                  >
                    {diagnosticQuestions.map((q, idx) => (
                      <option key={idx} value={idx}>
                        Q{q.question_number}: {q.cambridge_source_ref || `Question ${q.question_number}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {questionsLoading ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5] animate-pulse">
                <div className="w-8 h-8 rounded-full border-2 border-[#201e1d] border-t-transparent animate-spin" />
                <div className="font-heading text-sm font-black text-[#201e1d]">
                  Loading Live Questions for AST Diagnostics...
                </div>
                <p className="text-xs text-[#645c50]">Fetching active items from Supabase</p>
              </div>
            ) : diagnosticQuestions.length === 0 || !activeDiagQuestion ? (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center space-y-2 rounded-2xl bg-[#eee7db]/40 border-2 border-dashed border-[#c0b6a5]">
                <div className="text-3xl">🔬</div>
                <div className="font-heading text-sm font-black text-[#201e1d]">
                  No Questions Available for Diagnostics
                </div>
                <p className="text-xs font-medium text-[#645c50] max-w-sm">
                  Upload an exam paper PDF in Ingestion Studio to stage questions and run AST verification diagnostics.
                </p>
              </div>
            ) : (
              <IngestionDiagnostics question={activeDiagQuestion} />
            )}
          </div>
        </div>
      );

    case 'bank':
      return (
        <div className="space-y-2">
          {!questionsLoading && questions.length === 0 && (
            <div className="p-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🗄️</span>
                <div>
                  <span className="font-heading font-black text-sm text-[#201e1d] block">
                    0 Questions Live. Start by uploading an exam paper in Ingestion Studio
                  </span>
                  <span className="text-[#645c50] font-medium">
                    The Supabase question pool is currently empty. Start by uploading an exam paper in Ingestion Studio to parse, verify, and stage questions.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab('ingestion')}
                className="px-3 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-heading font-black text-xs hover:bg-[#ffc6a5] transition-all shadow-offset-2 active:translate-y-0.5 whitespace-nowrap cursor-pointer shrink-0"
              >
                + Open Ingestion Studio
              </button>
            </div>
          )}

          <AdminTools initialView="bank" portalMode="admin" onOpenEditor={handleOpenEditor} />
        </div>
      );

    case 'flagged':
      return (
        <div className="space-y-4">
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff2eb] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a]">
                  MODERATION OPS · QA
                </span>
                <span className="text-xs font-mono font-bold text-[#645c50]">
                  Community & Educator Flag Reports (8 Queued)
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Flagged Questions & Moderation
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
                Review user reports on ambiguous wording, diagram misalignment, or key typos.
              </p>
            </div>
          </div>
          <AdminCMS initialView="flagged" />
        </div>
      );

    case 'editor':
      return <AdminCMS initialView="editor" questionId={selectedQuestionId || questions[0]?.id} />;

    case 'settings':
      return (
        <AdminSettingsHub
          initialSubTab={(subTab as SettingsSubTab) || 'school'}
          onSelectSubTab={(s) => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'settings');
              url.searchParams.set('sub', s);
              window.history.replaceState(null, '', url.toString());
            }
          }}
          onSelectParentTab={onSelectTab}
        />
      );

    case 'system':
      return (
        <AdminSettingsHub
          initialSubTab="system"
          onSelectSubTab={(s) => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'settings');
              url.searchParams.set('sub', s);
              window.history.replaceState(null, '', url.toString());
            }
          }}
          onSelectParentTab={onSelectTab}
        />
      );

    case 'school':
      return (
        <AdminSettingsHub
          initialSubTab="school"
          onSelectSubTab={(s) => {
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('tab', 'settings');
              url.searchParams.set('sub', s);
              window.history.replaceState(null, '', url.toString());
            }
          }}
          onSelectParentTab={onSelectTab}
        />
      );

    case 'portal-menu':
      return <PortalMenuManager />;

    default:
      return renderIngestion();
  }
}
interface EducatorSeat {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)';
  status: 'Active' | 'Invited';
}

interface InstitutionalCohort {
  id: string;
  name: string;
  department: string;
  studentCount: number;
  term: string;
}

function SchoolLicenceManager() {
  const [planTier, setPlanTier] = useState('Enterprise Campus');
  const [totalSeatQuota, setTotalSeatQuota] = useState(300);
  const [teacherSeatLimit, setTeacherSeatLimit] = useState(15);
  const [licenceExpiry, setLicenceExpiry] = useState('2027-08-31');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [educators, setEducators] = useState<EducatorSeat[]>([
    {
      id: 'ed-1',
      name: 'Dr. Jane Smith',
      email: 'jane.smith@revizz.edu',
      department: 'Economics',
      role: 'Teacher (Read-Only Bank)',
      status: 'Active',
    },
    {
      id: 'ed-2',
      name: 'Marcus Vance',
      email: 'marcus.v@revizz.edu',
      department: 'Business Studies',
      role: 'App Admin (Full Edit)',
      status: 'Active',
    },
    {
      id: 'ed-3',
      name: 'Sarah Jenkins',
      email: 's.jenkins@revizz.edu',
      department: 'Accounting',
      role: 'Teacher (Read-Only Bank)',
      status: 'Active',
    },
  ]);

  const [newEducatorName, setNewEducatorName] = useState('');
  const [newEducatorEmail, setNewEducatorEmail] = useState('');
  const [newEducatorDept, setNewEducatorDept] = useState('Economics');
  const [newEducatorRole, setNewEducatorRole] = useState<'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)'>('Teacher (Read-Only Bank)');
  const [showAddEducator, setShowAddEducator] = useState(false);

  const [cohorts, setCohorts] = useState<InstitutionalCohort[]>([
    {
      id: 'coh-1',
      name: 'Grade 12 Economics (0455)',
      department: 'Economics',
      studentCount: 28,
      term: '2026-2027 Session',
    },
    {
      id: 'coh-2',
      name: 'Grade 11 Business Studies (0450)',
      department: 'Business Studies',
      studentCount: 32,
      term: '2026-2027 Session',
    },
    {
      id: 'coh-3',
      name: 'Grade 10 IGCSE Accounting (0452)',
      department: 'Accounting',
      studentCount: 24,
      term: '2026-2027 Session',
    },
  ]);

  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortDept, setNewCohortDept] = useState('Economics');
  const [newCohortStudents, setNewCohortStudents] = useState(30);
  const [newCohortTerm, setNewCohortTerm] = useState('2026-2027 Session');
  const [showAddCohort, setShowAddCohort] = useState(false);

  const handleSaveQuotas = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleToggleRole = (id: string) => {
    setEducators((prev) =>
      prev.map((ed) =>
        ed.id === id
          ? {
              ...ed,
              role:
                ed.role === 'Teacher (Read-Only Bank)'
                  ? 'App Admin (Full Edit)'
                  : 'Teacher (Read-Only Bank)',
            }
          : ed
      )
    );
  };

  const handleRevokeSeat = (id: string) => {
    setEducators((prev) => prev.filter((ed) => ed.id !== id));
  };

  const handleAddEducator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEducatorName.trim() || !newEducatorEmail.trim()) return;
    const newEd: EducatorSeat = {
      id: `ed-${Date.now()}`,
      name: newEducatorName.trim(),
      email: newEducatorEmail.trim(),
      department: newEducatorDept.trim() || 'General',
      role: newEducatorRole,
      status: 'Active',
    };
    setEducators((prev) => [...prev, newEd]);
    setNewEducatorName('');
    setNewEducatorEmail('');
    setShowAddEducator(false);
  };

  const handleAddCohort = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCohortName.trim()) return;
    const newCoh: InstitutionalCohort = {
      id: `coh-${Date.now()}`,
      name: newCohortName.trim(),
      department: newCohortDept.trim() || 'General',
      studentCount: Number(newCohortStudents) || 0,
      term: newCohortTerm.trim() || 'Current Term',
    };
    setCohorts((prev) => [...prev, newCoh]);
    setNewCohortName('');
    setShowAddCohort(false);
  };

  const handleRemoveCohort = (id: string) => {
    setCohorts((prev) => prev.filter((c) => c.id !== id));
  };

  const totalAssignedStudents = cohorts.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-black uppercase tracking-wider text-[#201e1d]">
            Institutional Allocations
          </span>
          <span className="text-xs font-bold text-[#645c50]">
            Enterprise School Licences &amp; Team Quotas
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
          School &amp; Licence Management 🏫
        </h1>
        <p className="text-sm font-medium text-[#645c50] max-w-2xl">
          Manage enterprise school licences, seat allocations, teacher quotas, educator permissions, and institutional student cohorts.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
            Licensed Seats
          </span>
          <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
            {educators.length} / {teacherSeatLimit} <span className="text-sm font-medium text-[#645c50]">Teachers</span>
          </div>
          <p className="text-xs font-bold text-[#645c50]">
            {totalAssignedStudents} / {totalSeatQuota} student seats utilized ({Math.max(0, totalSeatQuota - totalAssignedStudents)} available)
          </p>
        </div>

        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
            Active Cohorts
          </span>
          <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
            {cohorts.length} Classes
          </div>
          <p className="text-xs font-bold text-[#645c50]">
            {totalAssignedStudents} total enrolled students synced
          </p>
        </div>

        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 space-y-2">
          <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
            Licence Expiry
          </span>
          <div className="text-2xl sm:text-3xl font-black font-heading text-[#201e1d]">
            {licenceExpiry}
          </div>
          <p className="text-xs font-bold text-[#645c50]">
            Tier: <span className="text-[#201e1d] font-black">{planTier}</span>
          </p>
        </div>
      </div>

      {/* Licence & Seat Quota Controls */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#201e1d]/10 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
              Licence &amp; Seat Quota Controls
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[#645c50]">
              Configure institutional tier parameters, teacher seat limits, and student volume capacity.
            </p>
          </div>
          {saveSuccess && (
            <span className="px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] text-xs font-black shadow-offset-2 flex items-center gap-1.5 animate-pulse">
              ✓ Licence quotas saved successfully!
            </span>
          )}
        </div>

        <form onSubmit={handleSaveQuotas} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                Plan Tier
              </label>
              <select
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value)}
                className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-1 focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
              >
                <option value="Enterprise Campus">Enterprise Campus</option>
                <option value="Department Pro">Department Pro</option>
                <option value="Pilot">Pilot</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                Total Seat Quota
              </label>
              <input
                type="number"
                min="1"
                value={totalSeatQuota}
                onChange={(e) => setTotalSeatQuota(Number(e.target.value) || 0)}
                className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-1 focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                Teacher Seat Limit
              </label>
              <input
                type="number"
                min="1"
                value={teacherSeatLimit}
                onChange={(e) => setTeacherSeatLimit(Number(e.target.value) || 0)}
                className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-1 focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                Licence Expiry
              </label>
              <input
                type="text"
                value={licenceExpiry}
                onChange={(e) => setLicenceExpiry(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3 py-2 text-sm font-bold text-[#201e1d] shadow-offset-1 focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-full bg-[#ccdbb2] text-[#272e1b] font-black text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all active:translate-y-0.5 cursor-pointer"
            >
              Save Licence Quotas
            </button>
          </div>
        </form>
      </div>

      {/* Educator Seats & Permissions Table */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#201e1d]/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
                Educator Seats &amp; Permissions Table
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#fff2eb] border border-[#201e1d]/30 text-[10px] font-mono font-bold uppercase text-[#8c491a]">
                Admin-Only
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5">
              Control granular access: Teacher (Read-Only Bank) vs App Admin (Full Edit).
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddEducator(!showAddEducator)}
            className="px-4 py-2 rounded-full bg-[#ffe1d0] text-[#201e1d] font-black text-xs sm:text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5 self-start sm:self-auto cursor-pointer"
          >
            {showAddEducator ? 'Cancel' : '+ Allocate Educator Seat'}
          </button>
        </div>

        {/* Inline Add Educator Form */}
        {showAddEducator && (
          <form onSubmit={handleAddEducator} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-2xl p-4 space-y-3">
            <div className="font-heading font-black text-xs uppercase tracking-wider text-[#201e1d]">
              Allocate New Educator Seat
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Full Name (e.g. Dr. Jane Smith)"
                value={newEducatorName}
                onChange={(e) => setNewEducatorName(e.target.value)}
                required
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email Address"
                value={newEducatorEmail}
                onChange={(e) => setNewEducatorEmail(e.target.value)}
                required
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Department (e.g. Economics)"
                value={newEducatorDept}
                onChange={(e) => setNewEducatorDept(e.target.value)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <select
                value={newEducatorRole}
                onChange={(e) => setNewEducatorRole(e.target.value as any)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              >
                <option value="Teacher (Read-Only Bank)">Teacher (Read-Only Bank)</option>
                <option value="App Admin (Full Edit)">App Admin (Full Edit)</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddEducator(false)}
                className="px-3 py-1.5 rounded-lg border border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] text-xs font-black shadow-offset-1 hover:bg-[#b8c99d]"
              >
                Allocate Seat
              </button>
            </div>
          </form>
        )}

        {/* Educators Table */}
        <div className="overflow-x-auto rounded-2xl border-2 border-[#201e1d] bg-white">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#ebddc5] border-b-2 border-[#201e1d] text-[#201e1d] font-heading font-black">
                <th className="p-3 sm:p-3.5">Educator</th>
                <th className="p-3 sm:p-3.5">Email</th>
                <th className="p-3 sm:p-3.5">Department</th>
                <th className="p-3 sm:p-3.5">Portal Role</th>
                <th className="p-3 sm:p-3.5">Seat Status</th>
                <th className="p-3 sm:p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#201e1d]/15">
              {educators.map((ed) => (
                <tr key={ed.id} className="hover:bg-[#fff9f2] transition-colors">
                  <td className="p-3 sm:p-3.5 font-bold text-[#201e1d]">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#ffe1d0] border border-[#201e1d] flex items-center justify-center font-black text-xs text-[#201e1d]">
                        {ed.name.charAt(0)}
                      </span>
                      <span>{ed.name}</span>
                    </div>
                  </td>
                  <td className="p-3 sm:p-3.5 font-mono text-xs text-[#645c50]">{ed.email}</td>
                  <td className="p-3 sm:p-3.5 font-medium text-[#201e1d]">{ed.department}</td>
                  <td className="p-3 sm:p-3.5">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-black border border-[#201e1d]/30 ${
                        ed.role === 'App Admin (Full Edit)'
                          ? 'bg-[#fce7f3] text-[#831843]'
                          : 'bg-[#ffe1d0] text-[#c67139]'
                      }`}
                    >
                      {ed.role}
                    </span>
                  </td>
                  <td className="p-3 sm:p-3.5">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-[#ccdbb2] text-[#272e1b] border border-[#201e1d]/30">
                      {ed.status}
                    </span>
                  </td>
                  <td className="p-3 sm:p-3.5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(ed.id)}
                        className="px-2.5 py-1 rounded-lg bg-[#f9f4ed] border border-[#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] transition-colors shadow-offset-1 active:translate-y-0.5 cursor-pointer"
                        title="Toggle role between Teacher and App Admin"
                      >
                        Toggle Role
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevokeSeat(ed.id)}
                        className="px-2 py-1 rounded-lg bg-[#fde8e8] border border-[#201e1d] text-xs font-bold text-[#e0533c] hover:bg-[#fca5a5] transition-colors shadow-offset-1 active:translate-y-0.5 cursor-pointer"
                        title="Revoke educator seat"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Institutional Cohort Allocations Table */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-6 shadow-offset-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-[#201e1d]/10 pb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-[#201e1d] font-heading">
              Institutional Cohort Allocations Table
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[#645c50]">
              Registered classes, student capacity allocations, and syllabus sync for this institution.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddCohort(!showAddCohort)}
            className="px-4 py-2 rounded-full bg-[#ccdbb2] text-[#272e1b] font-black text-xs sm:text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all active:translate-y-0.5 self-start sm:self-auto cursor-pointer"
          >
            {showAddCohort ? 'Cancel' : '+ Register Cohort'}
          </button>
        </div>

        {/* Inline Register Cohort Form */}
        {showAddCohort && (
          <form onSubmit={handleAddCohort} className="bg-[#ebddc5]/40 border-2 border-[#201e1d] rounded-2xl p-4 space-y-3">
            <div className="font-heading font-black text-xs uppercase tracking-wider text-[#201e1d]">
              Register New Institutional Cohort
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Cohort Name (e.g. Grade 10 Econ)"
                value={newCohortName}
                onChange={(e) => setNewCohortName(e.target.value)}
                required
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Department"
                value={newCohortDept}
                onChange={(e) => setNewCohortDept(e.target.value)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="number"
                min="1"
                placeholder="Student Count"
                value={newCohortStudents}
                onChange={(e) => setNewCohortStudents(Number(e.target.value) || 0)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Term (e.g. 2026-2027)"
                value={newCohortTerm}
                onChange={(e) => setNewCohortTerm(e.target.value)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddCohort(false)}
                className="px-3 py-1.5 rounded-lg border border-[#201e1d] text-xs font-bold text-[#645c50] hover:bg-[#eee7db]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] text-xs font-black shadow-offset-1 hover:bg-[#b8c99d]"
              >
                Register Cohort
              </button>
            </div>
          </form>
        )}

        {/* Cohort Table */}
        <div className="overflow-x-auto rounded-2xl border-2 border-[#201e1d] bg-white">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-[#ebddc5] border-b-2 border-[#201e1d] text-[#201e1d] font-heading font-black">
                <th className="p-3 sm:p-3.5">Cohort Name</th>
                <th className="p-3 sm:p-3.5">Department</th>
                <th className="p-3 sm:p-3.5">Student Count</th>
                <th className="p-3 sm:p-3.5">Term / Series</th>
                <th className="p-3 sm:p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#201e1d]/15">
              {cohorts.map((c) => (
                <tr key={c.id} className="hover:bg-[#fff9f2] transition-colors">
                  <td className="p-3 sm:p-3.5 font-bold text-[#201e1d]">{c.name}</td>
                  <td className="p-3 sm:p-3.5 font-medium text-[#645c50]">{c.department}</td>
                  <td className="p-3 sm:p-3.5">
                    <span className="px-2.5 py-1 rounded-full bg-[#f9f4ed] border border-[#201e1d]/30 text-xs font-black text-[#201e1d]">
                      {c.studentCount} students
                    </span>
                  </td>
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
                  <td colSpan={5} className="p-8 text-center text-xs font-medium text-[#645c50]">
                    No cohorts registered yet. Click &quot;+ Register Cohort&quot; to allocate classroom groups.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
