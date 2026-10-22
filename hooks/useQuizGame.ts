import { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { playChime, playBuzzer, playFanfare } from '../lib/audio';
import {
  addToReviewPile,
  resolveFromReviewPile,
  recordFirstTryCorrect,
} from '../lib/mastery';
import { calculateAttemptScore } from '../lib/scoring';
import { submitAnswer, applyReveal, labelOf } from '../lib/quizApi';
import type { QuizAnswerResponse, QuizScoring } from '../types/quiz';
import { useAuth } from '../lib/auth';
import { recordCompletedRound } from '../lib/studentProfile';

export type Question = {
  id: string;
  stem_markdown: string;
  options: {
    id: string;
    text_markdown: string;
    label?: string;
    distractor_reasoning?: string;
  }[];
  correct_option_id?: string; // undefined until the server reveals it
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
  paper_id?: string;
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

export type DiagramFilter = 'all' | 'mixed' | 'graph' | 'diagram' | 'diagrams' | 'text' | 'no-diagrams';

export type QuizRoundConfig = {
  subject: string;
  sourceType: 'topic' | 'paper' | 'random' | 'review';
  sourceValue: string; // e.g., topic id, paper id, or 'review'
  roundLength: 3 | 5 | 10 | 30 | 40 | 'endless' | number;
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
  const hasRecordedRoundRef = useRef(false);
  const isCheckingRef = useRef(false);
  // In-flight background give-up; later submits wait on it so the server scores events in order.
  const pendingGiveUpRef = useRef<Promise<void> | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);

  const startRound = (newConfig: QuizRoundConfig, initialQuestions: Question[]) => {
    setConfig(newConfig);
    setQuestions(initialQuestions);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    resetQuestionState();
    hasRecordedRoundRef.current = false;

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

  // Signed-in users get server-computed XP/streak; guests (scoring === null) keep the local calculation.
  const applyServerScoring = useCallback((scoring: QuizScoring | null) => {
    if (!scoring) return;
    if (userProfile) {
      setUserProfile({ ...userProfile, total_xp: scoring.totalXp, current_streak: scoring.streak });
    }
  }, [userProfile, setUserProfile]);

  const revealInState = useCallback((q: Question, resp: QuizAnswerResponse): Question => {
    if (!resp.reveal) return q;
    const revealed = applyReveal(q, resp.reveal);
    setQuestions(prev => prev.map(item => (item.id === q.id ? applyReveal(item, resp.reveal!) : item)));
    return revealed;
  }, []);

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

  // Swap in the server-revealed copy of a question everywhere recordMissed's dedupe kept a stale one.
  const replaceMissedCopy = useCallback((q: Question) => {
    setMissedDetails(prev => prev.map(item => (item.question.id === q.id ? { ...item, question: q } : item)));
    setMissedQuestions(prev => prev.map(item => (item.id === q.id ? q : item)));
    setReviewPile(prev => prev.map(item => (item.id === q.id ? q : item)));
  }, []);

  useEffect(() => {
    const next = questions[currentQuestionIndex + 1];
    const url = next?.diagram?.image_url ?? next?.image_url;
    if (url && typeof window !== 'undefined') {
      const img = new Image();
      img.src = url;
    }
  }, [questions, currentQuestionIndex]);

  const handleTimeout = useCallback(() => {
    if (isCheckingRef.current) return;
    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;
    const qNum = currentQuestionIndex + 1;
    const timeSpentMs = Date.now() - questionStartTime;

    setStatus('timeout');
    playBuzzer();
    isCheckingRef.current = true;
    setIsChecking(true);

    const { newStreak: localStreak, shouldAddToReview } = calculateAttemptScore('timeout', currentStreak);
    setWrongCount(prev => prev + 1);
    setCurrentStreak(localStreak);

    const shouldIncrement = !hasQueuedMistakeRef.current;
    const canSaveToReview = !isDemoSession && Boolean(userProfile?.email);
    if (shouldAddToReview && shouldIncrement && canSaveToReview) addToReviewPile(currentQ.id);
    hasQueuedMistakeRef.current = true;

    (async () => {
      let recorded = currentQ;
      await pendingGiveUpRef.current;
      try {
        const resp = await submitAnswer({
          questionId: currentQ.id,
          event: 'timeout',
          attempt: firstWrongOptionId ? 2 : 1,
          timeSpentMs,
        });
        recorded = revealInState(currentQ, resp);
        if (resp.scoring) {
          setCurrentStreak(resp.scoring.streak);
          applyServerScoring(resp.scoring);
        }
      } catch (e) {
        console.error('Failed to record timeout:', e);
      } finally {
        recordMissed(recorded, 'timeout', qNum);
        isCheckingRef.current = false;
        setIsChecking(false);
      }
    })();
  }, [questions, currentQuestionIndex, currentStreak, questionStartTime, firstWrongOptionId, recordMissed, revealInState, applyServerScoring, isDemoSession, userProfile?.email]);

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

  const handleAnswer = async (optionId: string) => {
    if (status === 'answered' || status === 'timeout') return;
    if (isCheckingRef.current) return;
    if (status === 'first-wrong' && optionId === firstWrongOptionId) return;

    const currentQ = questions[currentQuestionIndex];
    if (!currentQ) return;
    const qNum = currentQuestionIndex + 1;
    const wasRetry = status === 'first-wrong';

    isCheckingRef.current = true;
    setIsChecking(true);
    setPendingOptionId(optionId);
    await pendingGiveUpRef.current;
    let resp: QuizAnswerResponse;
    try {
      resp = await submitAnswer({
        questionId: currentQ.id,
        optionLabel: labelOf(currentQ, optionId),
        event: 'answer',
        attempt: wasRetry ? 2 : 1,
        timeSpentMs: Date.now() - questionStartTime,
      });
    } catch (e) {
      // Network or server error: nothing is revealed, status is unchanged so the student can tap again.
      console.error('Failed to submit answer:', e);
      isCheckingRef.current = false;
      setIsChecking(false);
      setPendingOptionId(null);
      return;
    }

    try {
      const correct = resp.correct === true;
      const isFirstAttempt = resp.attempt === 1;
      const revealedQ = resp.final ? revealInState(currentQ, resp) : currentQ;
      const server = resp.scoring;

      if (correct && resp.final) {
        setStatus('answered');
        setSelectedOptionId(optionId);
        if (isFirstAttempt) {
          const local = calculateAttemptScore('first-correct', currentStreak);
          const xp = server ? server.xpAwarded : local.xpAwarded;
          const streak = server ? server.streak : local.newStreak;
          setCurrentStreak(streak);
          if (streak > peakStreak) setPeakStreak(streak);
          setTotalXP(prev => prev + xp);
          setCorrectFirstTryCount(prev => prev + 1);
          recordFirstTryCorrect(currentQ.id);
          if (config?.sourceType === 'review') resolveFromReviewPile(currentQ.id);
          playChime();
          triggerCelebration(streak);
        } else {
          const local = calculateAttemptScore('retry-correct', currentStreak);
          const xp = server ? server.xpAwarded : local.xpAwarded;
          setTotalXP(prev => prev + xp);
          if (server) setCurrentStreak(server.streak);
          setCorrectRetryCount(prev => prev + 1);
          recordMissed(revealedQ, 'retry-correct', qNum);
          playChime();
        }
        applyServerScoring(server);
      } else if (!correct && !resp.final) {
        setStatus('first-wrong');
        setFirstWrongOptionId(optionId);
        const local = calculateAttemptScore('first-wrong', currentStreak);
        setCurrentStreak(server ? server.streak : local.newStreak);
        if (!hasQueuedMistakeRef.current) {
          hasQueuedMistakeRef.current = true;
          recordMissed(currentQ, 'retry-correct', qNum);
          if (!isDemoSession && Boolean(userProfile?.email)) addToReviewPile(currentQ.id);
        }
        applyServerScoring(server);
        playBuzzer();
      } else {
        // Wrong and final (second wrong attempt)
        setStatus('answered');
        setSelectedOptionId(optionId);
        setWrongCount(prev => prev + 1);
        if (server) setCurrentStreak(server.streak);
        else setCurrentStreak(0);
        recordMissed(revealedQ, 'wrong', qNum);
        if (!hasQueuedMistakeRef.current && !isDemoSession && Boolean(userProfile?.email)) {
          addToReviewPile(currentQ.id);
        }
        hasQueuedMistakeRef.current = true;
        applyServerScoring(server);
        playBuzzer();
      }
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
      setPendingOptionId(null);
    }
  };

  const nextQuestion = async () => {
    if (isCheckingRef.current) return;
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    let effectiveWrongCount = wrongCount;
    if (status === 'first-wrong') {
      const currentQ = questions[currentQuestionIndex];
      if (currentQ) {
        setWrongCount(prev => prev + 1);
        effectiveWrongCount = wrongCount + 1;
        const recorded = currentQ;
        recordMissed(recorded, 'wrong', currentQuestionIndex + 1);
        const giveUpTimeMs = Date.now() - questionStartTime;
        // Fire and forget: the next question is tappable at once; the reveal lands when the server answers.
        pendingGiveUpRef.current = submitAnswer({
          questionId: currentQ.id,
          event: 'give-up',
          attempt: 2,
          timeSpentMs: giveUpTimeMs,
        })
          .then(resp => {
            const revealed = revealInState(currentQ, resp);
            if (revealed !== currentQ) replaceMissedCopy(revealed);
            if (resp.scoring) {
              setCurrentStreak(resp.scoring.streak);
              applyServerScoring(resp.scoring);
            }
          })
          .catch(e => {
            console.error('Failed to record give-up:', e);
          });
      }
    }

    const isEndless = config?.roundLength === 'endless';
    const limit = isEndless ? questions.length : (config?.roundLength as number);

    if (currentQuestionIndex + 1 >= Math.min(limit, questions.length)) {
      if (!hasRecordedRoundRef.current) {
        hasRecordedRoundRef.current = true;
        const totalAnswered = correctFirstTryCount + correctRetryCount + effectiveWrongCount;
        recordCompletedRound({
          subject: config?.subject || 'Economics 0455',
          sourceType: config?.sourceType || 'topic',
          sourceLabel: config?.sourceValue || 'General Revision',
          totalQuestions: totalAnswered > 0 ? totalAnswered : (currentQuestionIndex + 1),
          correctFirstTry: correctFirstTryCount,
          correctRetry: correctRetryCount,
          wrongCount: effectiveWrongCount,
          xpEarned: totalXP,
          peakStreak,
          isTimed: Boolean(config?.isTimed),
        });
      }
      setGameState('finished');
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
      resetQuestionState();
    }
  };

  const finishEarly = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    const totalAnswered = correctFirstTryCount + correctRetryCount + wrongCount;
    if (totalAnswered > 0 && !hasRecordedRoundRef.current) {
      hasRecordedRoundRef.current = true;
      recordCompletedRound({
        subject: config?.subject || 'Economics 0455',
        sourceType: config?.sourceType || 'topic',
        sourceLabel: config?.sourceValue || 'General Revision',
        totalQuestions: totalAnswered,
        correctFirstTry: correctFirstTryCount,
        correctRetry: correctRetryCount,
        wrongCount,
        xpEarned: totalXP,
        peakStreak,
        isTimed: Boolean(config?.isTimed),
      });
    }
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
    isChecking,
    pendingOptionId,
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

