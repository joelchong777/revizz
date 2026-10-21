'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { QuizRoundConfig, DiagramFilter } from '../hooks/useQuizGame';
import { getReviewPileCount, subscribeMasteryChanges, getFirstTryCorrectIds } from '@/lib/mastery';
import { playPop } from '@/lib/audio';
import { TopicMasteryList } from './TopicMasteryList';
import { SyllabusTopic, Question, IngestedPaperSummary, fetchIngestedPapers, fetchPaperQuestions } from '@/lib/questions';
import { PaperPickerModal } from './PaperPickerModal';
import { useAuth, isDemoStudentSession } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { fetchSubjectsFromDb, getSubjectEmoji, DbSubject, FALLBACK_SUBJECTS } from '@/lib/subjects';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';

interface StartFlowProps {
  onStart: (config: QuizRoundConfig, customQuestions?: Question[]) => void;
  onStartReview: () => void;
  onPracticeTopic: (topicId: string, topicName: string) => void;
  questions?: Question[];
  topics?: SyllabusTopic[];
}

export function StartFlow({
  onStart,
  onStartReview,
  onPracticeTopic,
  questions,
  topics,
}: StartFlowProps) {
  const { userProfile, isDemo: authIsDemo } = useAuth();
  const isDemo = Boolean(
    authIsDemo ||
    isDemoStudentSession(userProfile) ||
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student'
  );
  const [subjects, setSubjects] = useState<DbSubject[]>(FALLBACK_SUBJECTS);
  const [selectedSubjectCode, setSelectedSubjectCode] = useState<string>('0455');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedMode, setSelectedMode] = useState<'standard' | 'topic' | 'paper' | 'review'>('standard');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState<boolean>(false);

  // Whole Past Paper Mode State
  const [availablePapers, setAvailablePapers] = useState<IngestedPaperSummary[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<IngestedPaperSummary | null>(null);
  const [isPaperModalOpen, setIsPaperModalOpen] = useState<boolean>(false);
  const [loadingPapers, setLoadingPapers] = useState<boolean>(false);

  useEffect(() => {
    if (isDemo && selectedMode === 'review') {
      setSelectedMode('standard');
    }
  }, [isDemo, selectedMode]);
  const [roundLength, setRoundLength] = useState<3 | 5 | 10 | 'endless'>(5);
  const [diagramFilter, setDiagramFilter] = useState<DiagramFilter>('all');
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [isMasteryOpen, setIsMasteryOpen] = useState<boolean>(false);
  const [tierCounts, setTierCounts] = useState({ master: 0, proficient: 0, novice: 0 });

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const effectiveTopics = topics || [];
  const effectiveQuestions = questions || [];

  useEffect(() => {
    const updateStats = () => {
      setReviewCount(getReviewPileCount());
      const masteredSet = new Set(getFirstTryCorrectIds());
      let master = 0;
      let proficient = 0;
      let novice = 0;

      effectiveTopics.forEach((topic) => {
        const qCount = effectiveQuestions.filter((q) => q.topic_id === topic.id).length;
        const mCount = effectiveQuestions.filter(
          (q) => q.topic_id === topic.id && masteredSet.has(q.id)
        ).length;
        const pct = qCount > 0 ? Math.round((mCount / qCount) * 100) : 0;
        if (pct > 80) master++;
        else if (pct >= 50) proficient++;
        else novice++;
      });

      setTierCounts({ master, proficient, novice });
    };

    updateStats();
    const unsubscribe = subscribeMasteryChanges(updateStats);

    let savedSubject: string | null = null;
    const saved = localStorage.getItem('revizz_last_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roundLength) setRoundLength(parsed.roundLength);
        if (typeof parsed.isTimed === 'boolean') setIsTimed(parsed.isTimed);
        if (
          parsed.diagramFilter === 'all' ||
          parsed.diagramFilter === 'mixed' ||
          parsed.diagramFilter === 'graph' ||
          parsed.diagramFilter === 'diagram' ||
          parsed.diagramFilter === 'diagrams' ||
          parsed.diagramFilter === 'text' ||
          parsed.diagramFilter === 'no-diagrams'
        ) {
          setDiagramFilter(parsed.diagramFilter);
        }
        if (parsed.sourceType === 'review') setSelectedMode('review');
        else if (parsed.sourceType === 'paper') setSelectedMode('paper');
        else if (parsed.sourceType === 'topic') {
          setSelectedMode('topic');
          if (parsed.sourceValue && typeof parsed.sourceValue === 'string') {
            if (parsed.sourceValue !== 'all') {
              const ids = parsed.sourceValue.split(',').filter(Boolean);
              if (ids.length > 0) {
                setSelectedTopicIds(ids);
              }
            }
          }
        }
        else setSelectedMode('standard');
        if (parsed.subject && typeof parsed.subject === 'string') {
          savedSubject = parsed.subject;
          const initialSaved = parsed.subject;
          const matchedFallback = FALLBACK_SUBJECTS.find(
            (s) =>
              initialSaved === `${s.name} ${s.code}` ||
              initialSaved === s.code ||
              initialSaved.includes(s.code) ||
              initialSaved.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matchedFallback) {
            setSelectedSubjectCode(matchedFallback.code);
          }
        }
      } catch {
        // ignore
      }
    }

    fetchSubjectsFromDb().then((dbSubjects) => {
      if (dbSubjects && dbSubjects.length > 0) {
        setSubjects(dbSubjects);
        const subjectToRestore = savedSubject;
        if (subjectToRestore) {
          const matched = dbSubjects.find(
            (s) =>
              subjectToRestore === `${s.name} ${s.code}` ||
              subjectToRestore === s.code ||
              subjectToRestore.includes(s.code) ||
              subjectToRestore.toLowerCase().includes(s.name.toLowerCase())
          );
          if (matched) {
            setSelectedSubjectCode(matched.code);
            return;
          }
        }
        setSelectedSubjectCode((prev) => {
          if (dbSubjects.some((s) => s.code === prev)) {
            return prev;
          }
          const defaultSubject = dbSubjects.find((s) => s.code === '0455') || dbSubjects[0];
          return defaultSubject.code;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const currentSubject =
    subjects.find((s) => s.code === selectedSubjectCode) ||
    subjects.find((s) => s.code === '0455') ||
    subjects[0] || {
      id: '',
      code: '',
      name: 'No Subject',
      icon: null,
    };

  // Fetch ingested Cambridge past papers whenever current subject changes
  useEffect(() => {
    let isCancelled = false;
    setLoadingPapers(true);
    fetchIngestedPapers(currentSubject.code)
      .then((papers) => {
        if (isCancelled) return;
        setAvailablePapers(papers);
        setSelectedPaper((prev) => {
          if (prev && papers.some((p) => p.id === prev.id || p.cleanId === prev.cleanId)) {
            return papers.find((p) => p.id === prev.id || p.cleanId === prev.cleanId)!;
          }
          let savedPaperId: string | null = null;
          try {
            const saved = localStorage.getItem('revizz_last_config');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.sourceType === 'paper' && parsed.sourceValue) {
                savedPaperId = parsed.sourceValue;
              }
            }
          } catch {
            // ignore
          }
          if (savedPaperId) {
            const matched = papers.find((p) => p.id === savedPaperId || p.cleanId === savedPaperId);
            if (matched) return matched;
          }
          return papers.length > 0 ? papers[0] : null;
        });
      })
      .catch((err) => {
        console.warn('[StartFlow] Error fetching papers:', err);
      })
      .finally(() => {
        if (!isCancelled) setLoadingPapers(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentSubject.code]);

  // Memoized so the selection effect below doesn't re-run on every render
  const subjectTopics = useMemo(() => {
    const all = topics || [];
    return currentSubject.id
      ? all.filter(
          (t) => !(t as { subjectId?: string }).subjectId || (t as { subjectId?: string }).subjectId === currentSubject.id
        )
      : all;
  }, [topics, currentSubject.id]);

  useEffect(() => {
    if (subjectTopics.length === 0) return;
    setSelectedTopicIds((prev) => {
      if (prev.length === 0) {
        return subjectTopics.map((t) => t.id);
      }
      const valid = prev.filter((id) => subjectTopics.some((t) => t.id === id));
      // Keep the same array when nothing changed, or every run re-renders (render loop)
      if (valid.length === prev.length) return prev;
      return valid.length > 0 ? valid : subjectTopics.map((t) => t.id);
    });
  }, [subjectTopics]);

  useEffect(() => {
    if (!isTopicModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedTopicIds.length === 0) {
          setSelectedTopicIds(subjectTopics.map((t) => t.id));
        }
        setIsTopicModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTopicModalOpen, selectedTopicIds, subjectTopics]);

  const selectedTopicSet = new Set(selectedTopicIds);
  const selectedQuestionsCount = effectiveQuestions.filter(
    (q) => q.topic_id && selectedTopicSet.has(q.topic_id)
  ).length;

  const firstName =
    userProfile?.display_name &&
    userProfile.display_name !== 'Demo Student' &&
    userProfile.display_name !== 'Guest Learner'
      ? userProfile.display_name.split(' ')[0]
      : null;

  const handleStart = async () => {
    playPop();

    if (selectedMode === 'review') {
      if (isDemo) return;
      onStartReview();
      return;
    }

    const fullSubjectName = `${currentSubject.name} ${currentSubject.code}`;

    if (selectedMode === 'paper') {
      if (!selectedPaper) {
        setIsPaperModalOpen(true);
        return;
      }
      try {
        const paperQuestions = await fetchPaperQuestions(selectedPaper.id);
        const paperLength = paperQuestions.length > 0 ? paperQuestions.length : (selectedPaper.questionsCount || 30);
        const roundConfig: QuizRoundConfig = {
          subject: fullSubjectName,
          sourceType: 'paper',
          sourceValue: selectedPaper.id,
          roundLength: paperLength,
          isTimed,
          diagramFilter: 'all',
        };
        localStorage.setItem('revizz_last_config', JSON.stringify(roundConfig));
        onStart(roundConfig, paperQuestions);
      } catch (err) {
        console.warn('[StartFlow] Failed to load paper questions:', err);
      }
      return;
    }

    const topicSourceValue =
      selectedTopicIds.length === 0 || selectedTopicIds.length === subjectTopics.length
        ? 'all'
        : selectedTopicIds.join(',');

    const roundConfig: QuizRoundConfig = {
      subject: fullSubjectName,
      sourceType: selectedMode === 'topic' ? 'topic' : 'random',
      sourceValue: selectedMode === 'topic' ? topicSourceValue : 'random',
      roundLength,
      isTimed,
      diagramFilter,
    };

    localStorage.setItem('revizz_last_config', JSON.stringify(roundConfig));
    onStart(roundConfig);
  };

  const handleSubjectSelect = (code: string) => {
    playPop();
    setSelectedSubjectCode(code);
    setSelectedTopicIds([]);
    setIsDropdownOpen(false);
  };

  const handleModeSelect = (mode: 'standard' | 'topic' | 'paper' | 'review') => {
    if (mode === 'review' && isDemo) {
      return;
    }
    playPop();
    setSelectedMode(mode);
    if (mode === 'topic') {
      setIsTopicModalOpen(true);
    } else if (mode === 'paper') {
      if (!selectedPaper && availablePapers.length > 0) {
        setSelectedPaper(availablePapers[0]);
      }
    }
  };

  const handleLengthSelect = (len: 3 | 5 | 10 | 'endless') => {
    playPop();
    setRoundLength(len);
  };

  const handleDiagramFilterSelect = (filter: DiagramFilter) => {
    playPop();
    setDiagramFilter(filter);
  };

  const handleTimerSelect = (timed: boolean) => {
    playPop();
    setIsTimed(timed);
  };

  return (
    <div className="w-full max-w-[480px] mx-auto py-5 px-4 pb-12 flex flex-col gap-5 select-none">
      {/* Title Header */}
      <div>
        <h1 className="font-heading text-3xl sm:text-4xl text-text leading-tight mb-1">
          Ready{firstName ? `, ${firstName}` : ' to Revise'}?
        </h1>
        <p className="text-[15px] text-neutral-700 font-semibold m-0">
          Pick a subject, set the rules, go.
        </p>
      </div>

      {/* 1. Subject Selection Dropdown */}
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Subject
        </h2>
        {subjects.length === 0 ? (
          <div className="border-2 border-text bg-neutral-100 rounded-2xl shadow-offset-3 p-4 text-center">
            <span className="text-xs font-bold text-neutral-600">No subjects available</span>
          </div>
        ) : (
          <div ref={dropdownRef} className="relative w-full">
            {/* Dropdown Trigger */}
            <button
              type="button"
              onClick={() => {
                playPop();
                setIsDropdownOpen((prev) => !prev);
              }}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-label="Select subject"
              className="border-2 border-text bg-neutral-100 rounded-2xl shadow-offset-3 p-4 flex items-center justify-between w-full hover:bg-neutral-200/60 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl leading-none flex-shrink-0">
                  {getSubjectEmoji(currentSubject)}
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-heading text-base sm:text-lg text-text truncate">
                    {currentSubject.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold flex-shrink-0">
                    {currentSubject.code}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'w-5 h-5 text-text transition-transform duration-200 flex-shrink-0',
                  isDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown Menu Panel */}
            {isDropdownOpen && (
              <div
                role="listbox"
                className="absolute top-full left-0 right-0 mt-2 z-30 bg-neutral-100 border-2 border-text rounded-2xl shadow-offset-4 overflow-hidden py-2 animate-in fade-in-50 zoom-in-95 duration-150"
              >
                {subjects.map((s) => {
                  const isSelected = s.code === currentSubject.code;
                  return (
                    <button
                      key={s.id || s.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSubjectSelect(s.code)}
                      className={cn(
                        'w-full px-4 py-3 flex items-center justify-between text-left transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-accent-2-300 font-bold'
                          : 'hover:bg-neutral-200/60'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xl leading-none flex-shrink-0">
                          {getSubjectEmoji(s)}
                        </span>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-heading text-base text-text truncate">
                            {s.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold flex-shrink-0">
                            {s.code}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-text flex-shrink-0 stroke-[2.5]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Mode Selection */}
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Mode
        </h2>
        <div className="flex flex-col gap-3">
          {/* Mode 1: Standard Exam Round */}
          <button
            type="button"
            onClick={() => handleModeSelect('standard')}
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'standard'
                ? 'bg-accent-2-200 shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-white/80 shadow-offset-3 hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            )}
          >
            <span className="w-10 h-10 flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-lg">
              🎲
            </span>
            <span className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Standard exam round
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                Randomised pool across the syllabus
              </span>
            </span>
            {selectedMode === 'standard' && (
              <span className="w-6 h-6 rounded-full bg-text text-neutral-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Mode 2: Topic Practice */}
          <button
            type="button"
            onClick={() => handleModeSelect('topic')}
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'topic'
                ? 'bg-accent-2-200 shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-white/80 shadow-offset-3 hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            )}
          >
            <span className="w-10 h-10 flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-lg">
              📚
            </span>
            <span className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Topic practice
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                {selectedMode === 'topic'
                  ? selectedTopicIds.length === 0 || selectedTopicIds.length === subjectTopics.length
                    ? 'All topics · syllabus order'
                    : `${selectedTopicIds.length} topics selected (${selectedQuestionsCount} Qs)`
                  : 'Drill chapter by chapter, in syllabus order'}
              </span>
            </span>
            {selectedMode === 'topic' && (
              <span className="w-6 h-6 rounded-full bg-text text-neutral-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Mode 3: Whole Past Paper */}
          <button
            type="button"
            onClick={() => handleModeSelect('paper')}
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'paper'
                ? 'bg-accent-2-200 shadow-none translate-x-[2px] translate-y-[2px]'
                : 'bg-white/80 shadow-offset-3 hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
            )}
          >
            <span className="w-10 h-10 flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-lg">
              📑
            </span>
            <span className="flex flex-col gap-1 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Whole past paper
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                {selectedMode === 'paper' && selectedPaper
                  ? `${selectedPaper.seriesLabel} ${selectedPaper.year} · Paper ${selectedPaper.paperCode} (${selectedPaper.questionsCount} Qs)`
                  : 'Take a complete ingested Cambridge exam paper in official question order'}
              </span>
            </span>
            {selectedMode === 'paper' && (
              <span className="w-6 h-6 rounded-full bg-text text-neutral-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </button>

          {/* Mode 4: Review Pile */}
          <button
            type="button"
            disabled={isDemo}
            onClick={() => handleModeSelect('review')}
            title={
              isDemo
                ? 'Review pile is a saved feature for logged-in accounts. Sign in with Google to save your mistake pile!'
                : undefined
            }
            className={cn(
              'flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all',
              isDemo
                ? 'opacity-70 bg-neutral-100/60 border-dashed border-neutral-300 text-neutral-500 cursor-not-allowed'
                : selectedMode === 'review'
                ? 'bg-accent-2-200 border-text shadow-none translate-x-[2px] translate-y-[2px] cursor-pointer'
                : 'bg-white/80 border-text shadow-offset-3 hover:bg-white active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer'
            )}
          >
            <span
              className={cn(
                'w-10 h-10 flex-none rounded-full border-2 flex items-center justify-center text-lg',
                isDemo
                  ? 'bg-neutral-200/60 border-neutral-300 text-neutral-400'
                  : 'bg-neutral-100 border-text'
              )}
            >
              {isDemo ? '🔒' : '🧠'}
            </span>
            <span className="flex flex-col gap-1 flex-1 min-w-0">
              <span
                className={cn(
                  'font-heading text-[17px] leading-tight',
                  isDemo ? 'text-neutral-500' : 'text-text'
                )}
              >
                Review pile
              </span>
              <span
                className={cn(
                  'text-[13px] font-medium leading-snug',
                  isDemo ? 'text-neutral-500' : 'text-neutral-800'
                )}
              >
                {isDemo
                  ? 'Requires a logged-in account to save your mistake pile'
                  : 'Spaced repetition of questions you missed'}
              </span>
              {isDemo && (
                <span className="self-start mt-1 bg-neutral-200 text-neutral-600 px-2.5 py-0.5 rounded-full text-xs font-bold border-2 border-dashed border-neutral-400 whitespace-nowrap">
                  🔒 Log In to Save
                </span>
              )}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isDemo ? null : (
                <>
                  {reviewCount > 0 && (
                    <span className="bg-accent text-neutral-100 px-2.5 py-0.5 rounded-full text-xs font-bold border-2 border-text">
                      {reviewCount}
                    </span>
                  )}
                  {selectedMode === 'review' && (
                    <span className="w-6 h-6 rounded-full bg-text text-neutral-100 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Topic Selection Summary & Modal Trigger (Visible only in Topic Practice Mode) */}
      {selectedMode === 'topic' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
              Choose Topics
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold text-neutral-700">
              {selectedTopicIds.length === 0 ? subjectTopics.length : selectedTopicIds.length} of {subjectTopics.length} syllabus topics
            </span>
          </div>

          <button
            type="button"
            data-testid="topic-picker-trigger"
            onClick={() => {
              playPop();
              setIsTopicModalOpen(true);
            }}
            className="border-2 border-text bg-neutral-100 rounded-2xl shadow-offset-3 p-4 flex items-center justify-between w-full hover:bg-neutral-200/60 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer select-none"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
              <span className="text-xl flex-shrink-0">📚</span>
              <span className="font-heading text-sm sm:text-base text-text truncate">
                {selectedTopicIds.length === 0 || selectedTopicIds.length === subjectTopics.length
                  ? 'All Topics Selected'
                  : `${selectedTopicIds.length} Topics Selected`}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-neutral-200/90 border border-text/30 text-xs font-bold flex-shrink-0">
                {selectedQuestionsCount} Qs
              </span>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent-2-300 border-2 border-text text-xs font-bold text-text flex items-center gap-1 flex-shrink-0 hover:brightness-95">
              Edit Topics ✎
            </span>
          </button>
        </div>
      )}

      {/* Paper Selection Summary & Modal Trigger (Visible only in Whole Past Paper Mode) */}
      {selectedMode === 'paper' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
              Choose Past Paper
            </h2>
            {selectedPaper && (
              <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold text-neutral-700">
                {selectedPaper.questionsCount} Questions
              </span>
            )}
          </div>

          <button
            type="button"
            data-testid="paper-picker-trigger"
            onClick={() => {
              playPop();
              setIsPaperModalOpen(true);
            }}
            className="border-2 border-text bg-neutral-100 rounded-2xl shadow-offset-3 p-4 flex items-center justify-between w-full hover:bg-neutral-200/60 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer select-none"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
              <span className="text-xl flex-shrink-0">📑</span>
              <span className="font-heading text-sm sm:text-base text-text truncate">
                {selectedPaper
                  ? selectedPaper.title
                  : loadingPapers
                  ? 'Loading papers...'
                  : 'No paper selected'}
              </span>
              {selectedPaper && (
                <span className="px-2 py-0.5 rounded-full bg-neutral-200/90 border border-text/30 text-xs font-bold flex-shrink-0">
                  {selectedPaper.questionsCount} Qs
                </span>
              )}
            </div>
            <span className="px-3 py-1 rounded-full bg-accent-2-300 border-2 border-text text-xs font-bold text-text flex items-center gap-1 flex-shrink-0 hover:brightness-95">
              Change Paper ✎
            </span>
          </button>
        </div>
      )}

      {/* 3. Unified "Mission Rules" Deck */}
      <div className="flex flex-col gap-5 p-4 rounded-2xl bg-neutral-100/90 border-2 border-text shadow-offset-4">
        {/* Round Length */}
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
            Round length
          </h2>
          {selectedMode === 'paper' ? (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 rounded-full border-2 border-text bg-accent text-neutral-100 font-bold text-xs sm:text-sm shadow-offset-2 flex items-center gap-2 select-none">
                <span>📑</span>
                <span>Full Paper ({selectedPaper?.questionsCount || 30} Qs)</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {[
                { val: 3 as const, label: '3 Qs' },
                { val: 5 as const, label: '5 Qs' },
                { val: 10 as const, label: '10 Qs' },
                { val: 'endless' as const, label: 'Endless ∞' },
              ].map((item) => {
                const isSelected = roundLength === item.val;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleLengthSelect(item.val)}
                    className={cn(
                      'w-full px-1 py-1 rounded-full border-2 border-text font-bold text-xs sm:text-sm whitespace-nowrap text-center cursor-pointer transition-all duration-100 select-none',
                      isSelected
                        ? 'bg-accent text-neutral-100 shadow-none translate-x-[2px] translate-y-[2px]'
                        : 'bg-white/80 text-text hover:bg-white shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Diagram Filter */}
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
            Questions
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 'all' as const, icon: '🔀', label: 'All' },
              { val: 'graph' as const, icon: '📈', label: 'Graph' },
              { val: 'diagram' as const, icon: '📊', label: 'Diagram' },
              { val: 'text' as const, icon: '📝', label: 'Text' },
            ].map((opt) => {
              const isSelected =
                diagramFilter === opt.val ||
                (opt.val === 'all' && diagramFilter === 'mixed') ||
                (opt.val === 'diagram' && diagramFilter === 'diagrams') ||
                (opt.val === 'text' && diagramFilter === 'no-diagrams');
              return (
                <button
                  key={opt.val}
                  type="button"
                  data-testid={`diagram-filter-${opt.val}`}
                  onClick={() => handleDiagramFilterSelect(opt.val)}
                  className={cn(
                    'w-full px-1 py-1 rounded-full border-2 border-text font-bold text-[11px] sm:text-sm flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer transition-all duration-100 select-none',
                    isSelected
                      ? 'bg-accent text-neutral-100 shadow-none translate-x-[2px] translate-y-[2px]'
                      : 'bg-white/80 text-text hover:bg-white shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                  )}
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timer Selection */}
        <div className="flex flex-col gap-2">
          <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
            Timer
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTimerSelect(false)}
              className={cn(
                'p-3 rounded-2xl border-2 border-text text-left cursor-pointer transition-all flex items-center gap-3 select-none',
                !isTimed
                  ? 'bg-accent-300 text-text shadow-none translate-x-[2px] translate-y-[2px]'
                  : 'bg-white/80 text-text hover:bg-white shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
              )}
            >
              <span className="text-xl">☕</span>
              <div className="flex flex-col leading-tight">
                <span className="font-heading text-sm text-text">Chill</span>
                <span className="text-[11px] font-semibold opacity-85 text-text">Untimed</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleTimerSelect(true)}
              className={cn(
                'p-3 rounded-2xl border-2 border-text text-left cursor-pointer transition-all flex items-center gap-3 select-none',
                isTimed
                  ? 'bg-accent-300 text-text shadow-none translate-x-[2px] translate-y-[2px]'
                  : 'bg-white/80 text-text hover:bg-white shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
              )}
            >
              <span className="text-xl">⚡</span>
              <div className="flex flex-col leading-tight">
                <span className="font-heading text-sm text-text">Exam</span>
                <span className="text-[11px] font-semibold opacity-85 text-text">90s per Q</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Topic Mastery Card Trigger */}
      <button
        type="button"
        onClick={() => {
          playPop();
          setIsMasteryOpen(true);
        }}
        className="flex items-center gap-3 p-4 rounded-2xl bg-surface border-2 border-text shadow-offset-3 cursor-pointer text-left transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none hover:brightness-[0.98]"
      >
        <span className="flex flex-col gap-2 flex-1 min-w-0">
          <span className="font-heading text-[17px] text-text leading-tight truncate">
            Topic mastery · {currentSubject.name}
          </span>
          {effectiveTopics.length === 0 ? (
            <span className="text-xs font-semibold text-neutral-600">
              No topics available
            </span>
          ) : (
            <span className="flex gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-accent-2-300 border-2 border-text font-bold text-xs text-text">
                👑 {tierCounts.master} Master
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-accent-300 border-2 border-text font-bold text-xs text-text">
                ⚡ {tierCounts.proficient} Proficient
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-neutral-200 border-2 border-text font-bold text-xs text-text">
                🌱 {tierCounts.novice} Novice
              </span>
            </span>
          )}
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text flex-shrink-0"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>

      {/* 5. Hero CTA: START ROUND */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 px-5 rounded-2xl bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4 font-heading text-xl sm:text-2xl tracking-wide flex items-center justify-center gap-2 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer select-none"
      >
        {selectedMode === 'paper'
          ? `START PAPER · ${selectedPaper?.questionsCount || 30} Qs 📝`
          : selectedMode === 'review' && reviewCount > 0
          ? `START REVIEW · ${reviewCount} Qs 🧠`
          : `START ROUND · ${roundLength === 'endless' ? '∞' : roundLength + ' Qs'} 🚀`}
      </button>

      <AdSlotBanner
        slotId="start_flow_banner"
        subjectCode={currentSubject.code}
        className="mt-0"
      />

      {/* Multi-Topic Selection Popup Modal */}
      {isTopicModalOpen && (
        <div
          data-testid="topic-picker-modal"
          onClick={() => {
            if (selectedTopicIds.length === 0) {
              setSelectedTopicIds(subjectTopics.map((t) => t.id));
            }
            setIsTopicModalOpen(false);
          }}
          className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] max-h-[85vh] overflow-y-auto p-5 pb-6 rounded-3xl bg-bg border-2 border-text shadow-offset-6 flex flex-col gap-4 animate-in fade-in-50 zoom-in-95 duration-200 select-none"
          >
            {/* Header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <h3 className="font-heading text-xl sm:text-2xl text-text m-0">
                    Topic Practice
                  </h3>
                </div>
                <button
                  type="button"
                  data-testid="topic-modal-close"
                  onClick={() => {
                    playPop();
                    if (selectedTopicIds.length === 0) {
                      setSelectedTopicIds(subjectTopics.map((t) => t.id));
                    }
                    setIsTopicModalOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-text hover:bg-neutral-200"
                  aria-label="Close topic selector"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Sub-header info and Quick Actions */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-text/10">
                <span className="text-xs font-semibold text-neutral-700">
                  {selectedTopicIds.length === 0 ? subjectTopics.length : selectedTopicIds.length} of {subjectTopics.length} topics selected · {selectedQuestionsCount} Qs
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    data-testid="topic-select-all"
                    onClick={() => {
                      playPop();
                      setSelectedTopicIds(subjectTopics.map((t) => t.id));
                    }}
                    className="px-3 py-1 rounded-full border-2 border-text bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-text shadow-offset-2 cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    data-testid="topic-clear-all"
                    onClick={() => {
                      playPop();
                      setSelectedTopicIds([]);
                    }}
                    className="px-3 py-1 rounded-full border-2 border-text bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-600 shadow-offset-2 cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Topic List */}
            <div role="listbox" data-testid="topic-picker-menu" className="flex flex-col gap-2 max-h-[45vh] overflow-y-auto pr-1">
              {subjectTopics.map((t) => {
                const isSelected = selectedTopicIds.includes(t.id);
                const qCount = effectiveQuestions.filter((q) => q.topic_id === t.id).length;

                return (
                  <button
                    key={t.id}
                    type="button"
                    role="checkbox"
                    data-testid={`topic-option-${t.id}`}
                    aria-checked={isSelected}
                    onClick={() => {
                      playPop();
                      setSelectedTopicIds((prev) =>
                        prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                      );
                    }}
                    className={cn(
                      'w-full p-3 rounded-2xl border-2 text-left cursor-pointer transition-all flex items-center justify-between gap-3 select-none',
                      isSelected
                        ? 'bg-accent-2-300 border-text shadow-none translate-x-[2px] translate-y-[2px]'
                        : 'bg-white/80 border-text shadow-offset-3 hover:bg-white'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <span
                        className={cn(
                          'w-6 h-6 rounded-lg border-2 border-text flex items-center justify-center flex-shrink-0 transition-colors',
                          isSelected ? 'bg-text text-neutral-100' : 'bg-white'
                        )}
                      >
                        {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                      </span>

                      {/* Topic info */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold flex-shrink-0">
                          Ch {t.orderIndex}
                        </span>
                        <span className="font-heading text-sm sm:text-base text-text truncate">
                          {t.name}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-neutral-200/80 border border-text/30 text-xs font-bold flex-shrink-0">
                      {qCount} Qs
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-text/10 flex flex-col gap-2">
              <button
                type="button"
                data-testid="topic-modal-done"
                onClick={() => {
                  playPop();
                  if (selectedTopicIds.length === 0) {
                    setSelectedTopicIds(subjectTopics.map((t) => t.id));
                  }
                  setIsTopicModalOpen(false);
                }}
                className="w-full py-3 rounded-2xl bg-accent text-neutral-100 font-heading text-lg border-2 border-text shadow-offset-4 hover:bg-accent-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                Done · {selectedTopicIds.length === 0 ? subjectTopics.length : selectedTopicIds.length} Topics ({selectedTopicIds.length === 0 ? effectiveQuestions.length : selectedQuestionsCount} Qs)
              </button>
              {selectedTopicIds.length === 0 && (
                <span className="text-[11px] font-semibold text-center text-neutral-600">
                  Tip: No topics selected will automatically include all topics.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Topic Mastery Drawer Modal */}
      {isMasteryOpen && (
        <div
          onClick={() => setIsMasteryOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-xs flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] max-h-[86vh] overflow-y-auto p-5 pb-8 rounded-t-3xl bg-bg border-2 border-b-0 border-text flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center gap-3">
              <h3 className="font-heading text-2xl text-text m-0 flex-1">
                Topic mastery
              </h3>
              <button
                type="button"
                onClick={() => setIsMasteryOpen(false)}
                className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-text"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p className="text-[13px] text-neutral-700 font-semibold m-0">
              {currentSubject.name} {currentSubject.code} · first-try accuracy per syllabus chapter. 🌱 under 50% · ⚡ 50–80% · 👑 over 80%
            </p>

            <TopicMasteryList
              subject={`${currentSubject.name} ${currentSubject.code}`}
              onPracticeTopic={(topicId, topicName) => {
                setIsMasteryOpen(false);
                onPracticeTopic(topicId, topicName);
              }}
              questions={effectiveQuestions}
              topics={effectiveTopics}
            />
          </div>
        </div>
      )}

      {/* Paper Picker Modal */}
      <PaperPickerModal
        isOpen={isPaperModalOpen}
        onClose={() => setIsPaperModalOpen(false)}
        papers={availablePapers}
        selectedPaperId={selectedPaper?.id || null}
        onSelectPaper={(paper) => {
          setSelectedPaper(paper);
          setIsPaperModalOpen(false);
        }}
        subjectName={currentSubject.name}
        loading={loadingPapers}
      />
    </div>
  );
}

export default StartFlow;
