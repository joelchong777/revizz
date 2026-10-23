'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import IngestionHub from '@/components/portal/IngestionHub';
import AdminCMS from '@/components/portal/AdminCMS';
import AdminTools from '@/components/portal/AdminTools';
import PortalMenuManager from '@/components/admin/PortalMenuManager';
import AdminSettingsHub, { SettingsSubTab } from '@/components/admin/AdminSettingsHub';
import AdsManagerHub from '@/components/admin/AdsManagerHub';
import WholePaperViewer from '@/components/admin/WholePaperViewer';
import UserManagementHub from '@/components/admin/UserManagementHub';
import AppAnalyticsHub from '@/components/admin/analytics/AppAnalyticsHub';
import { useQuestions } from '@/lib/questions';
import {
  BookOpen,
  Layers,
  Sparkles,
  Database,
  Cpu,
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

  const handleOpenEditor = (questionId: string) => {
    if (onSelectQuestionId) {
      onSelectQuestionId(questionId);
    }
    onSelectTab('editor');
  };

  const renderIngestion = () => (
    <div className="space-y-4">
      <IngestionHub
        initialView={subTab === 'history' || subTab === 'diagnostics' ? subTab : 'new'}
        onOpenEditor={handleOpenEditor}
        onViewChange={(v) => {
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', 'ingestion');
            if (v !== 'new') {
              url.searchParams.set('sub', v);
            } else {
              url.searchParams.delete('sub');
            }
            window.history.replaceState(null, '', url.toString());
          }
        }}
      />
    </div>
  );

  switch (activeTab) {
    case 'ingestion':
      return renderIngestion();

    case 'papers':
      return <WholePaperViewer />;

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
                  Community & Educator Flag Reports (0 Queued)
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
      return (
        <AdminSettingsHub
          initialSubTab="portal-menu"
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

    case 'ads':
      return <AdsManagerHub />;

    case 'users':
      return <UserManagementHub onSelectTab={onSelectTab} />;

    case 'analytics':
      return <AppAnalyticsHub />;

    default:
      return renderIngestion();
  }
}

export interface EducatorSeat {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)';
  status: 'Active' | 'Invited';
}

export interface InstitutionalCohort {
  id: string;
  name: string;
  department: string;
  studentCount: number;
  term: string;
}

export function SchoolLicenceManager() {
  const [planTier, setPlanTier] = useState('Standard Educator');
  const [totalSeatQuota, setTotalSeatQuota] = useState(0);
  const [teacherSeatLimit, setTeacherSeatLimit] = useState(0);
  const [licenceExpiry, setLicenceExpiry] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [educators, setEducators] = useState<EducatorSeat[]>([]);

  const [newEducatorName, setNewEducatorName] = useState('');
  const [newEducatorEmail, setNewEducatorEmail] = useState('');
  const [newEducatorDept, setNewEducatorDept] = useState('');
  const [newEducatorRole, setNewEducatorRole] = useState<'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)'>('Teacher (Read-Only Bank)');
  const [showAddEducator, setShowAddEducator] = useState(false);

  const [cohorts, setCohorts] = useState<InstitutionalCohort[]>([]);

  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortDept, setNewCohortDept] = useState('');
  const [newCohortStudents, setNewCohortStudents] = useState(25);
  const [newCohortTerm, setNewCohortTerm] = useState('Current Term');
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
            {licenceExpiry || 'Not Configured'}
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
                <option value="Standard Educator">Standard Educator</option>
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
                min="0"
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
                min="0"
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
                placeholder="Full Name (e.g. Instructor Name)"
                value={newEducatorName}
                onChange={(e) => setNewEducatorName(e.target.value)}
                required
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email (e.g. educator@school.edu)"
                value={newEducatorEmail}
                onChange={(e) => setNewEducatorEmail(e.target.value)}
                required
                className="bg-white border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Department (e.g. Science)"
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
              {educators.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs font-medium text-[#645c50]">
                    No educator seats assigned yet. Click &quot;+ Allocate Educator Seat&quot; to allocate licences.
                  </td>
                </tr>
              )}
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
                placeholder="Cohort Name (e.g. Year 10 Group)"
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
