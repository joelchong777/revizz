// Client side of quiz-session analytics (types/analytics.ts). Everything here is
// fire-and-forget and must never throw or delay the quiz.
import { authFetch } from './authFetch';
import type {
  AnalyticsSessionRequest,
  DeviceType,
  QuizSessionMode,
} from '../types/analytics';

const DEVICE_KEY = 'revizz:device-id';
let memoryDeviceId: string | null = null;

function newUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Anonymous random id for this browser; falls back to memory when storage is blocked. */
export function getDeviceId(): string {
  if (memoryDeviceId) return memoryDeviceId;
  try {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (stored) {
      memoryDeviceId = stored;
      return stored;
    }
  } catch {
    // storage unavailable
  }
  const id = newUuid();
  memoryDeviceId = id;
  try {
    localStorage.setItem(DEVICE_KEY, id);
  } catch {
    // keep the in-memory id
  }
  return id;
}

export function getDeviceType(): DeviceType {
  try {
    if (typeof window === 'undefined') return 'unknown';
    const w = window.innerWidth;
    if (w < 768) return 'phone';
    const touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    if (w < 1024 && touch) return 'tablet';
    return 'desktop';
  } catch {
    return 'unknown';
  }
}

function send(body: AnalyticsSessionRequest): void {
  try {
    authFetch('/api/analytics/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never block the quiz
  }
}

export interface QuizSessionMeta {
  mode: QuizSessionMode;
  subject?: string;
  sourceRef?: string;
  plannedLength: number | null;
  isTimed: boolean;
}

/** Returns the new session id (or null if tracking could not start). */
export function startQuizSession(meta: QuizSessionMeta): string | null {
  try {
    const sessionId = newUuid();
    send({
      action: 'start',
      sessionId,
      deviceId: getDeviceId(),
      mode: meta.mode,
      subject: meta.subject,
      sourceRef: meta.sourceRef,
      plannedLength: meta.plannedLength,
      isTimed: meta.isTimed,
      deviceType: getDeviceType(),
    });
    return sessionId;
  } catch {
    return null;
  }
}

export function endQuizSession(sessionId: string, endedEarly: boolean): void {
  try {
    send({ action: 'end', sessionId, deviceId: getDeviceId(), endedEarly });
  } catch {
    // ignore
  }
}
