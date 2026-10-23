'use client';

import React, { useState } from 'react';
import type { AppAnalyticsSummary } from '@/types/analytics';
import { fmtDay, fmtInt, fmtPct, titleCase } from './analyticsFormat';

type Daily = AppAnalyticsSummary['daily'];

export function Card({ title, hint, children, className = '' }: {
  title: string; hint?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border-2 border-[#201e1d] bg-white shadow-offset-3 p-3 sm:p-4 min-w-0 ${className}`}>
      <div className="mb-3">
        <h3 className="font-mono text-[11px] uppercase tracking-widest font-bold text-[#201e1d]">{title}</h3>
        {hint && <p className="text-[11px] text-[#645c50] mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

interface SeriesDef { key: string; label: string; color: string; value: (d: Daily[number]) => number | null; format?: (n: number) => string }

function Sparkline({ title, data, series }: { title: string; data: Daily; series: SeriesDef[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300, H = 90, PL = 4, PR = 4, PT = 6, PB = 6;
  const n = data.length;
  const max = Math.max(1, ...series.flatMap((s) => data.map((d) => s.value(d) ?? 0)));
  const x = (i: number) => PL + (n <= 1 ? (W - PL - PR) / 2 : (i * (W - PL - PR)) / (n - 1));
  const y = (v: number) => PT + (H - PT - PB) * (1 - v / max);
  const active = hover ?? n - 1;
  const day = data[active];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((rel - PL) / (W - PL - PR)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[11px] font-bold text-[#201e1d]">{title}</span>
        {day && <span className="font-mono text-[10px] text-[#645c50]">{fmtDay(day.day)}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
        {series.map((s) => {
          const v = day ? s.value(day) : null;
          return (
            <span key={s.key} className="inline-flex items-center gap-1 text-[10px] text-[#474238]">
              <span aria-hidden className="inline-block w-2 h-2 rounded-sm" style={{ background: s.color }} />
              {s.label}: <b className="text-[#201e1d]">{v == null ? '—' : (s.format ?? fmtInt)(v)}</b>
            </span>
          );
        })}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24 touch-none"
        role="img"
        aria-label={`${title} by day`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((g) => (
          <line key={g} x1={PL} x2={W - PR} y1={y(max * g)} y2={y(max * g)} stroke="#201e1d" strokeOpacity={0.1} strokeWidth={1} />
        ))}
        {series.map((s) => {
          const pts = data.map((d, i) => ({ i, v: s.value(d) })).filter((p) => p.v != null) as { i: number; v: number }[];
          if (pts.length === 0) return null;
          return (
            <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round"
              points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')} />
          );
        })}
        {day && (
          <>
            <line x1={x(active)} x2={x(active)} y1={PT} y2={H - PB} stroke="#201e1d" strokeOpacity={0.35} strokeDasharray="2 2" />
            {series.map((s) => {
              const v = s.value(day);
              return v == null ? null : <circle key={s.key} cx={x(active)} cy={y(v)} r={3} fill={s.color} stroke="#fff" strokeWidth={1} />;
            })}
          </>
        )}
      </svg>
    </div>
  );
}

export function DailyTrend({ daily }: { daily: Daily }) {
  if (daily.length === 0) return <p className="text-xs text-[#645c50]">No daily data in this range.</p>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Sparkline title="Active learners" data={daily} series={[{ key: 'a', label: 'Active', color: '#c2410c', value: (d) => d.activeLearners }]} />
      <Sparkline title="Quizzes started vs completed" data={daily} series={[
        { key: 's', label: 'Started', color: '#1d4ed8', value: (d) => d.sessionsStarted },
        { key: 'c', label: 'Completed', color: '#15803d', value: (d) => d.sessionsCompleted },
      ]} />
      <Sparkline title="Answers" data={daily} series={[{ key: 'n', label: 'Answers', color: '#7c3aed', value: (d) => d.answers }]} />
    </div>
  );
}

export function PairBars({ rows }: { rows: { key: string; started: number; completed: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.started));
  if (rows.length === 0) return <p className="text-xs text-[#645c50]">No data.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-[11px]">
          <div className="flex justify-between gap-2 mb-0.5">
            <span className="font-bold text-[#201e1d]">{titleCase(r.key)}</span>
            <span className="text-[#474238]">{fmtInt(r.completed)} / {fmtInt(r.started)} · {fmtPct(r.started ? r.completed / r.started : null)}</span>
          </div>
          <div className="h-2.5 rounded bg-[#f5ead8] relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-[#1d4ed8]/35" style={{ width: `${(r.started / max) * 100}%` }} />
            <div className="absolute inset-y-0 left-0 bg-[#15803d]" style={{ width: `${(r.completed / max) * 100}%` }} />
          </div>
        </li>
      ))}
      <li className="flex gap-3 text-[10px] text-[#645c50]">
        <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#1d4ed8]/35" />Started</span>
        <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#15803d]" />Completed</span>
      </li>
    </ul>
  );
}

export function SimpleBars({ rows, color = '#c2410c', unit = '' }: {
  rows: { key: string; value: number }[]; color?: string; unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  if (rows.length === 0) return <p className="text-xs text-[#645c50]">No data.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-[11px]">
          <div className="flex justify-between gap-2 mb-0.5">
            <span className="font-bold text-[#201e1d]">{titleCase(r.key)}</span>
            <span className="text-[#474238]">{fmtInt(r.value)}{unit} · {fmtPct(total ? r.value / total : null)}</span>
          </div>
          <div className="h-2.5 rounded bg-[#f5ead8] overflow-hidden">
            <div className="h-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Heatmap({ cells }: { cells: AppAnalyticsSummary['heatmap'] }) {
  const grid = new Map<string, number>();
  let max = 0;
  cells.forEach((c) => { grid.set(`${c.weekday}-${c.hour}`, c.sessions); max = Math.max(max, c.sessions); });
  const [pick, setPick] = useState<string | null>(null);
  const shade = (v: number) => (v <= 0 || max === 0 ? '#faf6ef' : `rgba(194,65,12,${0.12 + 0.88 * (v / max)})`);
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          <div className="grid gap-px" style={{ gridTemplateColumns: '32px repeat(24, minmax(0, 1fr))' }}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-[9px] text-center text-[#645c50] font-mono">{h % 3 === 0 ? h : ''}</span>
            ))}
            {DAYS.map((d, wd) => (
              <React.Fragment key={d}>
                <span className="text-[10px] font-bold text-[#474238] self-center">{d}</span>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = grid.get(`${wd}-${h}`) ?? 0;
                  const id = `${wd}-${h}`;
                  return (
                    <button
                      key={h}
                      type="button"
                      title={`${d} ${String(h).padStart(2, '0')}:00 · ${v} sessions`}
                      onClick={() => setPick(id)}
                      className={`h-5 rounded-[2px] ${pick === id ? 'outline outline-2 outline-[#201e1d]' : ''}`}
                      style={{ background: shade(v) }}
                      aria-label={`${d} ${h}:00, ${v} sessions`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#645c50]">
        <span>
          {pick
            ? `${DAYS[Number(pick.split('-')[0])]} ${String(pick.split('-')[1]).padStart(2, '0')}:00 SGT · ${fmtInt(grid.get(pick) ?? 0)} sessions`
            : 'Hours in Singapore time (SGT). Tap a cell for its count.'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          Fewer
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <i key={f} className="w-3.5 h-3 rounded-[2px] border border-[#201e1d]/15" style={{ background: shade(f * max) }} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
