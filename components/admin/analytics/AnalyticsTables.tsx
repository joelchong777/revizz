'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AnalyticsQuestionStat, AppAnalyticsSummary } from '@/types/analytics';
import { fmtDate, fmtInt, fmtPct, fmtSecs } from './analyticsFormat';

const TH = 'text-left font-mono text-[10px] uppercase tracking-wider text-[#645c50] font-bold px-2 py-1.5 whitespace-nowrap border-b-2 border-[#201e1d]';
const TD = 'px-2 py-1.5 text-[11px] text-[#201e1d] border-b border-[#201e1d]/10 align-top';

function Scroll({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto -mx-1 px-1"><table className="w-full min-w-[480px] border-collapse">{children}</table></div>;
}

export function RetentionTable({ rows }: { rows: AppAnalyticsSummary['retention'] }) {
  if (rows.length === 0) return <p className="text-xs text-[#645c50]">No cohorts yet.</p>;
  const cell = (v: number | null) => (
    <td className={`${TD} text-center`} style={v == null ? undefined : { background: `rgba(21,128,61,${0.08 + 0.6 * Math.min(1, v)})` }}>
      {v == null ? '—' : fmtPct(v)}
    </td>
  );
  return (
    <Scroll>
      <thead><tr>
        <th className={TH}>Cohort week</th><th className={TH}>Size</th>
        {[1, 2, 3, 4].map((w) => <th key={w} className={`${TH} text-center`}>Week {w}</th>)}
      </tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.cohortWeek}>
            <td className={TD}>{fmtDate(r.cohortWeek)}</td><td className={TD}>{fmtInt(r.size)}</td>
            {cell(r.week1)}{cell(r.week2)}{cell(r.week3)}{cell(r.week4)}
          </tr>
        ))}
      </tbody>
    </Scroll>
  );
}

export function TopicsList({ topics }: { topics: AppAnalyticsSummary['topics'] }) {
  if (topics.length === 0) return <p className="text-xs text-[#645c50]">No topic data yet.</p>;
  const sorted = [...topics].sort((a, b) => (a.firstTryAccuracy ?? 2) - (b.firstTryAccuracy ?? 2));
  return (
    <ul className="space-y-2.5">
      {sorted.map((t) => (
        <li key={t.topicId} className="text-[11px]">
          <div className="flex justify-between gap-2 mb-0.5">
            <span className="font-bold text-[#201e1d] min-w-0 truncate">{t.name}</span>
            <span className="text-[#474238] shrink-0">{fmtPct(t.firstTryAccuracy)}</span>
          </div>
          <div className="h-2.5 rounded bg-[#f5ead8] overflow-hidden">
            <div className="h-full bg-[#c2410c]" style={{ width: `${(t.firstTryAccuracy ?? 0) * 100}%` }} />
          </div>
          <div className="text-[10px] text-[#645c50] mt-0.5">{fmtInt(t.answers)} answers · avg {fmtSecs(t.avgAnswerSeconds)}</div>
        </li>
      ))}
    </ul>
  );
}

export function PapersTable({ papers }: { papers: AppAnalyticsSummary['papers'] }) {
  if (papers.length === 0) return <p className="text-xs text-[#645c50]">No paper sessions yet.</p>;
  return (
    <Scroll>
      <thead><tr><th className={TH}>Paper</th><th className={TH}>Sessions</th><th className={TH}>Completed</th><th className={TH}>Rate</th></tr></thead>
      <tbody>
        {papers.map((p) => (
          <tr key={p.paperId}>
            <td className={TD}>{p.title}</td><td className={TD}>{fmtInt(p.sessions)}</td>
            <td className={TD}>{fmtInt(p.completed)}</td><td className={TD}>{fmtPct(p.sessions ? p.completed / p.sessions : null)}</td>
          </tr>
        ))}
      </tbody>
    </Scroll>
  );
}

export function QuestionTable({ rows }: { rows: AnalyticsQuestionStat[] }) {
  if (rows.length === 0) return <p className="text-xs text-[#645c50]">Not enough attempts yet (needs 5 per question).</p>;
  return (
    <Scroll>
      <thead><tr>
        <th className={TH}>Question</th><th className={TH}>Topic</th><th className={TH}>Attempts</th>
        <th className={TH}>First try</th><th className={TH}>Avg time</th><th className={TH}>Top wrong pick</th>
      </tr></thead>
      <tbody>
        {rows.map((q) => (
          <tr key={q.questionId}>
            <td className={TD}>
              <div className="font-bold">{q.label}</div>
              {q.possibleKeyIssue && (
                <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md border-2 border-[#201e1d] bg-[#fef3c7] text-[10px] font-bold">
                  <AlertTriangle className="w-3 h-3" aria-hidden /> Check answer key
                </span>
              )}
            </td>
            <td className={TD}>{q.topic ?? '—'}</td>
            <td className={TD}>{fmtInt(q.attempts)}</td>
            <td className={TD}>{fmtPct(q.firstTryAccuracy)}</td>
            <td className={TD}>{fmtSecs(q.avgAnswerSeconds)}</td>
            <td className={TD}>{q.topWrongLabel ? `${q.topWrongLabel} (${fmtPct(q.topWrongShare)})` : '—'}{q.correctLabel ? ` · key ${q.correctLabel}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </Scroll>
  );
}
