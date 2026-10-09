'use client';

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled, playPop, subscribeSoundState } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface SoundToggleProps {
  className?: string;
}

export function SoundToggle({ className }: SoundToggleProps) {
  const [soundOn, setSoundOn] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setSoundOn(isSoundEnabled());

    const unsubscribe = subscribeSoundState((enabled) => {
      setSoundOn(enabled);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggle = () => {
    const nextState = !soundOn;
    setSoundEnabled(nextState);
    setSoundOn(nextState);

    // Trigger playful test pop when unmuted
    if (nextState) {
      playPop();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
      title={soundOn ? 'Sound is ON (Click to mute)' : 'Sound is OFF (Click to unmute)'}
      className={cn(
        'relative inline-flex items-center justify-center p-2 rounded-2xl border-2 border-b-4 border-slate-800 shadow-chunky transition-all duration-100 select-none cursor-pointer active:translate-y-0.5 active:border-b-2 active:shadow-sm',
        soundOn
          ? 'bg-brand-teal text-slate-900 hover:brightness-110'
          : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600',
        className
      )}
    >
      {mounted && soundOn ? (
        <Volume2 className="w-5 h-5 transition-transform scale-100" />
      ) : (
        <VolumeX className="w-5 h-5 transition-transform scale-100" />
      )}
    </button>
  );
}

export default SoundToggle;
