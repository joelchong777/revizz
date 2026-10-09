/**
 * Revizz Web Audio API Synthesizer Engine
 * 
 * Provides zero-latency, asset-free procedural audio feedback:
 * - playPop: tactile blip for clicks and interactions
 * - playChime: joyful chord for correct answers
 * - playBuzzer: soft playful thud/buzz for incorrect attempts
 * - playFanfare: ascending arpeggio for streak milestones
 * 
 * Sound is OFF by default and preference is saved to localStorage under 'revizz_sound_enabled'.
 */

const STORAGE_KEY = 'revizz_sound_enabled';

type SoundListener = (enabled: boolean) => void;
const listeners = new Set<SoundListener>();

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // User gesture might not be recognized yet, will retry on next user action
    });
  }

  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch (err) {
    console.warn('Unable to persist sound preference to localStorage:', err);
  }

  // Pre-initialize / resume audio context if unmuting
  if (enabled) {
    getAudioContext();
  }

  notifyListeners(enabled);
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  setSoundEnabled(next);
  return next;
}

export function subscribeSoundState(listener: SoundListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(enabled: boolean): void {
  listeners.forEach((listener) => {
    try {
      listener(enabled);
    } catch (err) {
      console.error('Error in sound state listener:', err);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('revizz_sound_changed', { detail: { enabled } })
    );
  }
}

/**
 * Short frequency-modulated tactile blip.
 */
export function playPop(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch (err) {
    console.warn('Audio playback error (playPop):', err);
  }
}

/**
 * Joyful multi-oscillator chord (C5 - E5 - G5 - C6) for correct answers.
 */
export function playChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0 },     // C5
      { freq: 659.25, delay: 0.035 }, // E5
      { freq: 783.99, delay: 0.07 },  // G5
      { freq: 1046.5, delay: 0.105 }, // C6
    ];

    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + delay;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.14, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.58);
    });
  } catch (err) {
    console.warn('Audio playback error (playChime):', err);
  }
}

/**
 * Soft, playful low thud/buzz for incorrect picks.
 */
export function playBuzzer(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.22);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  } catch (err) {
    console.warn('Audio playback error (playBuzzer):', err);
  }
}

/**
 * Ascending arpeggio fanfare for streak milestones.
 */
export function playFanfare(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 392.0, duration: 0.12, time: 0 },       // G4
      { freq: 523.25, duration: 0.12, time: 0.09 },   // C5
      { freq: 659.25, duration: 0.12, time: 0.18 },   // E5
      { freq: 783.99, duration: 0.16, time: 0.27 },   // G5
      { freq: 1046.5, duration: 0.6, time: 0.38 },    // C6
    ];

    notes.forEach(({ freq, duration, time }, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + time;
      const isTop = idx === notes.length - 1;

      osc.type = isTop ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(isTop ? 0.22 : 0.16, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    });
  } catch (err) {
    console.warn('Audio playback error (playFanfare):', err);
  }
}
