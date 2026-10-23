'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Download, Info } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { ANALYTICS_RANGES } from '@/types/analytics';
import type { AnalyticsRange, AppAnalyticsResponse, AppAnalyticsSummary } from '@/types/analytics';
import { Card, DailyTrend, Heatmap, PairBars, SimpleBars } from './AnalyticsCharts';
import { PapersTable, QuestionTable, RetentionTable, TopicsList } from './AnalyticsTables';
import { fmtDate, fmtInt, fmtNum, fmtPct, fmtSecs, fmtTime } from './analyticsFormat';

const RANGE_LABEL: Record<AnalyticsRange, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', all: 'All' };

// Dev-only sample data. The branch is dead code in production builds (NODE_ENV is inlined).
const PREVIEW_ENABLED = process.env.NODE_ENV === 'development';

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-offset-3 p-3 min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold truncate">{label}</div>
      <div className="text-2xl font-black text-[#201e1d] leading-tight mt-1">{value}</div>
      {sub && <div className="text-[11px] text-[#474238] mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function exportCsv(s: AppAnalyticsSummary) {
  const head = 'day,active_learners,sessions_started,sessions_completed,answers,first_try_accuracy';
  const rows = s.daily.map((d) => [d.day, d.activeLearners, d.sessionsStarted, d.sessionsCompleted, d.answers, d.firstTryAccuracy ?? ''].join(','));
  const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `revizz-analytics-${s.range}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AppAnalyticsHub() {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [summary, setSummary] = useState<AppAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notMigrated, setNotMigrated] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async (r: AnalyticsRange) => {
    setLoading(true);
    setError(null);
    setNotMigrated(false);
    try {
      if (PREVIEW_ENABLED && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('analyticsPreview') === '1') {
        const mod = await import('./devPreviewSummary');
        setSummary({ ...mod.devPreviewSummary, range: r });
        setPreview(true);
        return;
      }
      setPreview(false);
      const res = await authFetch(`/api/admin/analytics?range=${r}`);
      let body: AppAnalyticsResponse | null = null;
      try { body = (await res.json()) as AppAnalyticsResponse; } catch { /* non-JSON */ }
      if (res.status === 503 && body?.code === 'NOT_MIGRATED') { setNotMigrated(true); setSummary(null); return; }
      if (res.status === 401 || res.status === 403) { setError('Sign in as an App Admin to see analytics.'); return; }
      if (!res.ok || !body?.success || !body.summary) { setError(body?.error || `Could not load analytics (HTTP ${res.status}).`); return; }
      setSummary(body.summary);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(range); }, [load, range]);

  const s = summary;
  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] text-[#474238] min-w-0">
          {s && <>Updated {fmtTime(s.generatedAt)} · Tracking since {fmtDate(s.trackingSince)}</>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Date range" className="inline-flex rounded-xl border-2 border-[#201e1d] overflow-hidden bg-white">
            {ANALYTICS_RANGES.map((r) => (
              <button key={r} type="button" onClick={() => setRange(r)} aria-pressed={range === r}
                className={`px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${range === r ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#474238] hover:bg-[#f5ead8]'}`}>
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void load(range)} disabled={loading} aria-label="Refresh"
            className="p-1.5 rounded-lg border-2 border-[#201e1d] bg-white shadow-offset-2 active:translate-y-0.5 cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {s && (
            <button type="button" onClick={() => exportCsv(s)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 border-[#201e1d] bg-white shadow-offset-2 active:translate-y-0.5 text-[11px] font-bold cursor-pointer">
              <Download className="w-3.5 h-3.5" /> Download CSV
            </button>
          )}
        </div>
      </div>

      {PREVIEW_ENABLED && preview && (
        <div className="rounded-xl border-2 border-[#201e1d] bg-[#fef3c7] px-3 py-2 text-xs font-bold">Sample data — dev preview only</div>
      )}

      {loading && !s && (
        <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-24 rounded-2xl border-2 border-[#201e1d]/20 bg-[#f5ead8] animate-pulse" />)}
          </div>
          <div className="h-48 rounded-2xl border-2 border-[#201e1d]/20 bg-[#f5ead8] animate-pulse" />
        </div>
      )}

      {notMigrated && (
        <div className="rounded-2xl border-2 border-[#201e1d] bg-[#f9f4ed] p-4 flex gap-3 items-start text-sm text-[#201e1d]">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <p>Analytics isn&apos;t switched on yet — the database migration still needs to be applied.</p>
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="rounded-2xl border-2 border-[#201e1d] bg-[#fff1f2] p-4 text-sm text-rose-800 flex flex-wrap items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => void load(range)} className="px-2.5 py-1 rounded-lg border-2 border-[#201e1d] bg-white text-[11px] font-bold cursor-pointer">Try again</button>
        </div>
      )}

      {s && s.quizzes.started === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-[#201e1d]/40 bg-[#f9f4ed] p-6 text-center text-sm text-[#474238]">No quiz sessions recorded yet.</div>
      )}

      {s && s.quizzes.started > 0 && (
        <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <Tile label="Registered users" value={fmtInt(s.users.registered)} sub={`${fmtInt(s.users.students)} students · ${fmtInt(s.users.teachers)} teachers · ${fmtInt(s.users.schoolAccounts)} school`} />
            <Tile label="Active learners 7d" value={fmtInt(s.users.active7d)} sub={`Today ${fmtInt(s.users.activeToday)} · 30d ${fmtInt(s.users.active30d)} · stickiness ${fmtPct(s.users.stickiness)}`} />
            <Tile label="Guest devices" value={fmtInt(s.users.guestDevices)} sub="Anonymous, in range" />
            <Tile label="Quizzes started" value={fmtInt(s.quizzes.started)} sub={`${fmtNum(s.quizzes.avgAnsweredPerSession)} answers per quiz`} />
            <Tile label="Completion rate" value={fmtPct(s.quizzes.completionRate)} sub={`${fmtInt(s.quizzes.completed)} completed · ${fmtInt(s.quizzes.endedEarly)} ended early · ${fmtInt(s.quizzes.abandoned)} abandoned`} />
            <Tile label="Answers" value={fmtInt(s.answers.total)} sub={`First-try accuracy ${fmtPct(s.answers.firstTryAccuracy)}`} />
            <Tile label="Avg answer time" value={fmtSecs(s.answers.avgAnswerSeconds)} sub={`Median per session ${fmtSecs(s.answers.medianSessionAnswerSeconds)}`} />
            <Tile label="Retry recovery" value={fmtPct(s.answers.retryRecoveryRate)} sub="Wrong first, right on retry" />
          </div>

          <Card title="Daily trend" hint="Hover or tap a chart to read a day's values. Days are Singapore time."><DailyTrend daily={s.daily} /></Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card title="Quizzes by mode" className="lg:col-span-2"><PairBars rows={s.quizzes.byMode} /></Card>
            <div className="space-y-4 min-w-0">
              <Card title="By device"><SimpleBars rows={s.quizzes.byDevice.map((d) => ({ key: d.key, value: d.sessions }))} color="#1d4ed8" /></Card>
              <Card title="Timed quizzes"><div className="text-xl font-black">{fmtPct(s.quizzes.timedShare)}</div><div className="text-[11px] text-[#474238]">of quizzes use the timer</div></Card>
            </div>
          </div>

          <Card title="When students study" hint="Quiz starts by weekday and hour. Useful for timing ads and reminders."><Heatmap cells={s.heatmap} /></Card>

          <Card title="Retention" hint="Share of each weekly cohort active again in weeks 1-4."><RetentionTable rows={s.retention} /></Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Topics, weakest first"><TopicsList topics={s.topics} /></Card>
            <Card title="Papers"><PapersTable papers={s.papers} /></Card>
          </div>

          <Card title="Hardest questions" hint="Lowest first-try accuracy, at least 5 attempts."><QuestionTable rows={s.hardestQuestions} /></Card>
          <Card title="Slowest questions" hint="Highest average time, at least 5 attempts."><QuestionTable rows={s.slowestQuestions} /></Card>

          <Card title="Streak distribution" hint="Registered learners by current streak (days)."><SimpleBars rows={s.users.streakBuckets.map((b) => ({ key: b.label, value: b.count }))} color="#7c3aed" /></Card>
        </div>
      )}
    </div>
  );
}
