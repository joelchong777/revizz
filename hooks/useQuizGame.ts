import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { playChime, playBuzzer, playFanfare } from '../lib/audio';
import {
  addToReviewPile,
  resolveFromReviewPile,
  recordFirstTryCorrect,
} from '../lib/mastery';
import { calculateAttemptScore } from '../lib/scoring';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/auth';

export type Question = {
  id: string;
  stem_markdown: string;
  options: { id: string; text_markdown: string }[];
  correct_option_id: string;
  citation?: string;
  topic?: string;
  topic_id?: string;
  has_diagram?: boolean;
  image_url?: string;
  diagram?: {
    has_diagram?: boolean;
    image_url?: string;
    alt_description?: string;
  };
  explanation_markdown?: string;
  // Optional extended metadata fields:
  year?: number;
  variant?: string;
  series?: string;
  paper_code?: string;
  question_number?: number;
  tags?: string[];
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  status?: 'Live' | 'Needs review' | 'Agent draft' | 'Withdrawn' | 'active' | 'flagged' | string;
  subtopic?: string;
};

export type DiagramFilter = 'mixed' | 'diagrams' | 'no-diagrams';

export type QuizRoundConfig = {
  subject: string;
  sourceType: 'topic' | 'paper' | 'random' | 'review';
  sourceValue: string; // e.g., topic id, paper id, or 'review'
  roundLength: 3 | 5 | 10 | 30 | 'endless';
  isTimed: boolean;
  diagramFilter?: DiagramFilter;
};

export type GameState = 'setup' | 'playing' | 'finished';

export type QuestionStatus = 'unanswered' | 'first-wrong' | 'answered' | 'timeout';

export interface MissedQuestionItem {
  question: Question;
  outcome: 'retry-correct' | 'wrong' | 'timeout';
  questionNumber: number;
}

export function useQuizGame() {
  const { userProfile, setUserProfile, isDemo } = useAuth();
  const isDemoSession = Boolean(
    isDemo ||
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student'
  );
  
  const [gameState, setGameState] = useState<GameState>('setup');
  const [config, setConfig] = useState<QuizRoundConfig | null>(null);

  // Quiz State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [status, setStatus] = useState<QuestionStatus>('unanswered');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [firstWrongOptionId, setFirstWrongOptionId] = useState<string | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(90);
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());

  // Stats
  const [totalXP, setTotalXP] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [peakStreak, setPeakStreak] = useState(0);
  const [correctFirstTryCount, setCorrectFirstTryCount] = useState(0);
  const [correctRetryCount, setCorrectRetryCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);

  const [reviewPile, setReviewPile] = useState<Question[]>([]);
  const [missedQuestions, setMissedQuestions] = useState<Question[]>([]);
  const [missedDetails, setMissedDetails] = useState<MissedQuestionItem[]>([]);

  // Refs for intervals/timeouts
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null);
  const hasQueuedMistakeRef = useRef(false);

  const startRound = (newConfig: QuizRoundConfig, initialQuestions: Question[]) => {
    setConfig(newConfig);
    setQuestions(initialQuestions);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    resetQuestionState();

    // Reset stats
    setTotalXP(0);
    setCurrentStreak(0);
    setPeakStreak(0);
    setCorrectFirstTryCount(0);
    setCorrectRetryCount(0);
    setWrongCount(0);
    setReviewPile([]);
    setMissedQuestions([]);
    setMissedDetails([]);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('revizz:stats', {
          detail: { xp: totalXP, streak: currentStreak },
        })
      );
    }
  }, [totalXP, currentStreak]);

  const resetQuestionState = useCallback(() => {
    setStatus('unanswered');
    setSelectedOptionId(null);
    setFirstWrongOptionId(null);
    setQuestionStartTime(Date.now());
    hasQueuedMistakeRef.current = false;
    if (config?.isTimed) {
      setTimeLeft(90);
    }
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, [config]);

  const saveAttempt = async (
    q: Question,
    outcome: 'first-correct' | 'first-wrong' | 'retry-correct' | 'wrong' | 'timeout',
    xpAwarded: number,
    streak: number,
    incrementReviewMistakes?: boolean
  ) => {
    if (!userProfile) return;
    const timeSpentMs = Date.now() - questionStartTime;
    const isFirstCorrect = outcome === 'first-correct';
    const isRetryCorrect = outcome === 'retry-correct';

    const shouldIncrementMistakes = incrementReviewMistakes !== undefined
      ? incrementReviewMistakes
      : (outcome === 'first-wrong' || (!hasQueuedMistakeRef.current && !isFirstCorrect));

    try {
      await supabase.from('user_attempts').upsert({
        user_id: userProfile.id,
        question_id: q.id,
        first_attempt_correct: isFirstCorrect,
        retry_correct: isRetryCorrect,
        xp_awarded: xpAwarded,
        time_spent_ms: timeSpentMs
      }, { onConflict: 'user_id, question_id' });

      if (!isFirstCorrect && shouldIncrementMistakes) {
        const { data } = await supabase.from('review_pile').select('mistakes_count').eq('user_id', userProfile.id).eq('question_id', q.id).single();
        const count = (data?.mistakes_count || 0) + 1;
        await supabase.from('review_pile').upsert({
          user_id: userProfile.id,
          question_id: q.id,
          mistakes_count: count
        }, { onConflict: 'user_id, question_id' });
      }

      const newTotalXp = userProfile.total_xp + xpAwarded;
      const newStreak = isFirstCorrect ? streak : 0;
      
      await supabase.from('profiles').update({
        total_xp: newTotalXp,
        current_streak: newStreak
      }).eq('id', userProfile.id);

      setUserProfile({ ...userProfile, total_xp: newTotalXp, current_streak: newStreak });
    } catch (e) {
      console.error('Failed to save attempt to supabase:', e);
    }
  };

  const recordMissed = useCallback((q: Question, outcome: 'retry-correct' | 'wrong' | 'timeout', qNum: number) => {
    setMissedDetails(prev => {
      const existingIndex = prev.findIndex(item => item.question.id === q.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { question: q, outcome, questionNumber: qNum };
        return updated;
      }
      return [...prev, { question: q, outcome, questionNumber: qNum }];
    });
    setMissedQuestions(prev => {
      if (prev.some(item => item.id === q.id)) return prev;
      return [...prev, q];
    });
    setReviewPile(prev => {
      if (prev.some(item => item.id === q.id)) return prev;
      return [...prev, q];
    });
  }, []);

  const handleTimeout = useCallback(() => {
    setStatus('timeout');
    const { xpAwarded, newStreak, shouldAddToReview } = calculateAttemptScore('timeout', currentStreak);
    setCurrentStreak(newStreak);
    setWrongCount(prev => prev + 1);

    const currentQ = questions[currentQuestionIndex];
    if (currentQ) {
      const shouldIncrement = !hasQueuedMistakeRef.current;
      const canSaveToReview = !isDemoSession && Boolean(userProfile?.email);
      if (shouldAddToReview && shouldIncrement && canSaveToReview) addToReviewPile(currentQ.id);
      recordMissed(currentQ, 'timeout', currentQuestionIndex + 1);
      saveAttempt(currentQ, 'timeout', xpAwarded, newStreak, shouldIncrement);
      hasQueuedMistakeRef.current = true;
    }
    playBuzzer();
  }, [questions, currentQuestionIndex, currentStreak, recordMissed, isDemoSession, userProfile?.email]);

  // Timer logic
  useEffect(() => {
    if (gameState === 'playing' && config?.isTimed && (status === 'unanswered' || status === 'first-wrong')) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, config, status, handleTimeout]);

  const triggerCelebration = useCallback((streak: number) => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    if (streak >= 5) {
      playFanfare();
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
    } else if (streak >= 3) {
      playFanfare();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } else {
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.6 }
      });
    }
  }, []);

  const handleAnswer = (optionId: string) => {
    if (status === 'answered' || status === 'timeout') return;

    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;

    const isCorrect = optionId === currentQ.correct_option_id;
    const qNum = currentQuestionIndex + 1;

    if (status === 'unanswered') {
      if (isCorrect) {
        // Correct on first try
        setStatus('answered');
        setSelectedOptionId(optionId);

        const { xpAwarded, newStreak } = calculateAttemptScore('first-correct', currentStreak);
        setCurrentStreak(newStreak);
        if (newStreak > peakStreak) setPeakStreak(newStreak);

        setTotalXP(prev => prev + xpAwarded);
        setCorrectFirstTryCount(prev => prev + 1);

        recordFirstTryCorrect(currentQ.id);

        if (config?.sourceType === 'review') {
          resolveFromReviewPile(currentQ.id);
        }

        saveAttempt(currentQ, 'first-correct', xpAwarded, newStreak);
        playChime();
        triggerCelebration(newStreak);
      } else {
        // Wrong on first try
        setStatus('first-wrong');
        setFirstWrongOptionId(optionId);
        const { newStreak } = calculateAttemptScore('first-wrong', currentStreak);
        setCurrentStreak(newStreak);

        if (!hasQueuedMistakeRef.current) {
          hasQueuedMistakeRef.current = true;
          recordMissed(currentQ, 'retry-correct', qNum);
          if (!isDemoSession && Boolean(userProfile?.email)) {
            addToReviewPile(currentQ.id);
          }
          saveAttempt(currentQ, 'first-wrong', 0, 0);
        }

        playBuzzer();
      }
    } else if (status === 'first-wrong') {
      if (optionId === firstWrongOptionId) return;

      if (isCorrect) {
        // Correct on second try
        setStatus('answered');
        setSelectedOptionId(optionId);
        const { xpAwarded } = calculateAttemptScore('retry-correct', currentStreak);
        setTotalXP(prev => prev + xpAwarded);
        setCorrectRetryCount(prev => prev + 1);

        recordMissed(currentQ, 'retry-correct', qNum);
        saveAttempt(currentQ, 'retry-correct', xpAwarded, 0, false);

        playChime();
      } else {
        // Wrong on second try
        setStatus('answered');
        setSelectedOptionId(optionId);
        const { xpAwarded } = calculateAttemptScore('wrong', currentStreak);
        setWrongCount(prev => prev + 1);

        recordMissed(currentQ, 'wrong', qNum);

        const shouldIncrementMistakes = !hasQueuedMistakeRef.current;
        saveAttempt(currentQ, 'wrong', xpAwarded, 0, shouldIncrementMistakes);

        if (shouldIncrementMistakes && !isDemoSession && Boolean(userProfile?.email)) {
          addToReviewPile(currentQ.id);
        }
        hasQueuedMistakeRef.current = true;

        playBuzzer();
      }
    }
  };

  const nextQuestion = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    const isEndless = config?.roundLength === 'endless';
    const limit = isEndless ? questions.length : (config?.roundLength as number);

    if (currentQuestionIndex + 1 >= Math.min(limit, questions.length)) {
      setGameState('finished');
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    }
  };

  const finishEarly = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setGameState('finished');
  };

  const returnToSetup = () => {
    setGameState('setup');
  };

  return {
    gameState,
    config,
    currentQuestion: questions[currentQuestionIndex],
    currentQuestionIndex,
    totalQuestions: questions.length,
    status,
    timeLeft,
    totalXP,
    currentStreak,
    peakStreak,
    selectedOptionId,
    firstWrongOptionId,
    startRound,
    handleAnswer,
    nextQuestion,
    finishEarly,
    returnToSetup,
    stats: {
      correctFirstTryCount,
      correctRetryCount,
      wrongCount,
      reviewPile,
      missedQuestions,
      missedDetails,
    }
  };
}

