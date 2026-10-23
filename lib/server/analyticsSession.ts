// Pure parsing helpers for the analytics routes. No I/O.
import {
  ANALYTICS_RANGES,
  DEVICE_TYPES,
  QUIZ_SESSION_MODES,
  type AnalyticsRange,
  type AnalyticsSessionRequest,
  type DeviceType,
  type QuizSessionMode,
} from '@/types/analytics';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuidString = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function clip(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, 120);
  return s || undefined;
}

export function parseSessionRequest(
  raw: unknown
): { ok: true; value: AnalyticsSessionRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid body' };
  const r = raw as Record<string, unknown>;
  if (!isUuidString(r.sessionId)) return { ok: false, error: 'sessionId must be a uuid' };
  if (!isUuidString(r.deviceId)) return { ok: false, error: 'deviceId must be a uuid' };
  if (r.action === 'end') {
    if (typeof r.endedEarly !== 'boolean') return { ok: false, error: 'endedEarly must be a boolean' };
    return { ok: true, value: { action: 'end', sessionId: r.sessionId, deviceId: r.deviceId, endedEarly: r.endedEarly } };
  }
  if (r.action !== 'start') return { ok: false, error: 'action must be start or end' };
  if (!QUIZ_SESSION_MODES.includes(r.mode as QuizSessionMode)) return { ok: false, error: 'Invalid mode' };
  if (!DEVICE_TYPES.includes(r.deviceType as DeviceType)) return { ok: false, error: 'Invalid deviceType' };
  if (typeof r.isTimed !== 'boolean') return { ok: false, error: 'isTimed must be a boolean' };
  let plannedLength: number | null = null;
  if (r.plannedLength !== null && r.plannedLength !== undefined) {
    if (typeof r.plannedLength !== 'number' || !Number.isInteger(r.plannedLength) || r.plannedLength < 1 || r.plannedLength > 500) {
      return { ok: false, error: 'plannedLength must be null or an integer 1-500' };
    }
    plannedLength = r.plannedLength;
  }
  return {
    ok: true,
    value: {
      action: 'start',
      sessionId: r.sessionId,
      deviceId: r.deviceId,
      mode: r.mode as QuizSessionMode,
      subject: clip(r.subject),
      sourceRef: clip(r.sourceRef),
      plannedLength,
      isTimed: r.isTimed,
      deviceType: r.deviceType as DeviceType,
    },
  };
}

export function parseAnalyticsRange(v: string | null): AnalyticsRange {
  return ANALYTICS_RANGES.includes(v as AnalyticsRange) ? (v as AnalyticsRange) : '30d';
}

export function rangeStart(range: AnalyticsRange, now: Date): Date | null {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 3600 * 1000);
}
