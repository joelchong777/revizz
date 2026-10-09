'use client';

import React, { useState, useEffect } from 'react';
import { QuizRoundConfig } from '../hooks/useQuizGame';
import { getReviewPileCount, subscribeMasteryChanges } from '@/lib/mastery';
import { playPop } from '@/lib/audio';
import { TopicMasteryList } from './TopicMasteryList';
import { Sparkles, AlertCircle, Play, BookOpen, Layers } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Badge } from './ui/badge';
import { Select } from './ui/select';

interface StartFlowProps {
  onStart: (config: QuizRoundConfig) => void;
  onStartReview: () => void;
  onPracticeTopic: (topicId: string, topicName: string) => void;
}

export function StartFlow({ onStart, onStartReview, onPracticeTopic }: StartFlowProps) {
  const [activeTab, setActiveTab] = useState<'quick' | 'mastery'>('quick');
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [config, setConfig] = useState<QuizRoundConfig>({
    subject: 'Economics 0455',
    sourceType: 'topic',
    sourceValue: 'all',
    roundLength: 5,
    isTimed: true
  });

  useEffect(() => {
    setReviewCount(getReviewPileCount());

    const unsubscribe = subscribeMasteryChanges(() => {
      setReviewCount(getReviewPileCount());
    });

    const saved = localStorage.getItem('revizz_last_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
      } catch {
        // ignore
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const handleStart = () => {
    playPop();
    localStorage.setItem('revizz_last_config', JSON.stringify(config));
    onStart(config);
  };

  const handleReviewClick = () => {
    playPop();
    onStartReview();
  };

  const updateConfig = (updates: Partial<QuizRoundConfig>) => {
    playPop();
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const switchTab = (tab: 'quick' | 'mastery') => {
    playPop();
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col w-full max-w-lg mx-auto py-3 sm:py-4 px-1 sm:px-2 space-y-4 sm:space-y-5">
      {/* Title Header */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
          Revizz <span className="text-brand-yellow drop-shadow-xs">⚡</span>
        </h1>
        <p className="text-slate-500 font-bold text-xs sm:text-sm mt-1">
          Tactile Cambridge IGCSE Revision
        </p>
      </div>

      {/* Prominent Bouncy Card: Dedicated "Review Mistakes" Practice Mode */}
      {reviewCount > 0 && (
        <div className="card-playful bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-300 p-4 sm:p-5 shadow-playful relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-rose-800 font-black text-xs sm:text-sm mb-1">
                <span className="text-base sm:text-lg">🎯</span>
                <span>Weak Spot Workout</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug break-words">
                Review Mistakes ({reviewCount} Question{reviewCount > 1 ? 's' : ''} waiting)
              </h2>
              <p className="text-xs font-semibold text-slate-600 mt-1">
                Target the questions you previously missed until you achieve 1st-try mastery!
              </p>
            </div>
          </div>

          <div className="mt-3 sm:mt-4">
            <button
              type="button"
              onClick={handleReviewClick}
              className="btn-chunky-coral w-full py-3 sm:py-3.5 px-4 text-sm sm:text-base font-black shadow-chunky flex items-center justify-center gap-2 min-h-[48px]"
            >
              <span>Practice Now</span>
              <Play className="w-4 h-4 fill-white" />
            </button>
          </div>
        </div>
      )}

      {/* Mode Navigation Tabs using Radix Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => switchTab(val as 'quick' | 'mastery')}>
        <TabsList>
          <TabsTrigger value="quick" className="flex items-center justify-center gap-1.5">
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Quick Round</span>
          </TabsTrigger>
          <TabsTrigger value="mastery" className="flex items-center justify-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Topic Mastery</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Quick Round Configuration */}
        <TabsContent value="quick">
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-playful border-2 border-slate-800 space-y-4 sm:space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wider">
                Subject
              </label>
              <Select
                options={[{ value: 'Economics 0455', label: 'Economics 0455 (Cambridge IGCSE)' }]}
                value={config.subject}
                onChange={(value) => updateConfig({ subject: value })}
                className="w-full"
              />
            </div>

            {/* Mode */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wider">
                Practice Mode
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => updateConfig({ sourceType: 'topic', sourceValue: 'all' })}
                  className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all border-2 select-none min-h-[48px] flex items-center justify-center text-center ${
                    config.sourceType === 'topic'
                      ? 'border-slate-800 bg-brand-indigo text-white shadow-none translate-y-0.5'
                      : 'border-slate-200 bg-white text-slate-700 shadow-chunky hover:bg-slate-50'
                  }`}
                >
                  By Syllabus Topic
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ sourceType: 'random', sourceValue: 'random' })}
                  className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all border-2 select-none min-h-[48px] flex items-center justify-center text-center ${
                    config.sourceType === 'random'
                      ? 'border-slate-800 bg-brand-indigo text-white shadow-none translate-y-0.5'
                      : 'border-slate-200 bg-white text-slate-700 shadow-chunky hover:bg-slate-50'
                  }`}
                >
                  Random Shuffle 🎲
                </button>
              </div>
            </div>

            {/* Topic Selector if topic mode selected */}
            {config.sourceType === 'topic' && (
              <div>
                <label className="block text-[11px] sm:text-xs font-black text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wider">
                  Target Topic
                </label>
                <Select
                  options={[
                    { value: 'all', label: 'All Topics (Comprehensive)' },
                    { value: 'topic_1', label: '1. The Basic Economic Problem' },
                    { value: 'topic_2', label: '2. The Allocation of Resources' },
                    { value: 'topic_3', label: '3. Microeconomic Decision Makers' },
                    { value: 'topic_4', label: '4. Government and the Macroeconomy' },
                    { value: 'topic_5', label: '5. Economic Development' },
                    { value: 'topic_6', label: '6. International Trade and Globalisation' }
                  ]}
                  value={config.sourceValue}
                  onChange={(value) => updateConfig({ sourceValue: value })}
                  className="w-full"
                />
              </div>
            )}

            {/* Questions Length Selector */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wider">
                Round Length
              </label>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {[
                  { label: '3 Qs', val: 3 },
                  { label: '5 Qs', val: 5 },
                  { label: '10 Qs', val: 10 },
                  { label: 'Endless', val: 'endless' }
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => updateConfig({ roundLength: item.val as any })}
                    className={`py-2.5 sm:py-3 px-1 sm:px-2 rounded-xl font-black text-xs sm:text-sm transition-all border-2 select-none text-center min-h-[44px] flex items-center justify-center ${
                      config.roundLength === item.val
                        ? 'border-slate-800 bg-brand-yellow text-amber-950 shadow-none translate-y-0.5'
                        : 'border-slate-200 bg-white text-slate-700 shadow-chunky hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timer Toggle */}
            <div>
              <label className="block text-[11px] sm:text-xs font-black text-slate-500 mb-1.5 sm:mb-2 uppercase tracking-wider">
                Timer Pressure
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => updateConfig({ isTimed: false })}
                  className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all border-2 select-none min-h-[48px] flex items-center justify-center text-center ${
                    !config.isTimed
                      ? 'border-slate-800 bg-brand-teal text-white shadow-none translate-y-0.5'
                      : 'border-slate-200 bg-white text-slate-700 shadow-chunky hover:bg-slate-50'
                  }`}
                >
                  Chill (Untimed)
                </button>
                <button
                  type="button"
                  onClick={() => updateConfig({ isTimed: true })}
                  className={`py-2.5 sm:py-3 px-2 sm:px-4 rounded-xl font-black text-xs sm:text-sm transition-all border-2 select-none min-h-[48px] flex items-center justify-center text-center ${
                    config.isTimed
                      ? 'border-slate-800 bg-brand-coral text-white shadow-none translate-y-0.5'
                      : 'border-slate-200 bg-white text-slate-700 shadow-chunky hover:bg-slate-50'
                  }`}
                >
                  Exam (90s / Q)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStart}
              className="btn-chunky-indigo w-full py-3.5 sm:py-4 px-6 text-base sm:text-lg font-black tracking-wide shadow-chunky mt-2 min-h-[52px]"
            >
              START ROUND 🚀
            </button>
          </div>
        </TabsContent>

        {/* Tab 2: Topic Mastery Visual List */}
        <TabsContent value="mastery">
          <TopicMasteryList
            subject={config.subject}
            onPracticeTopic={onPracticeTopic}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default StartFlow;
