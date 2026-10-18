'use client';

import React, { useState, useEffect } from 'react';
import { StartFlow } from '../components/StartFlow';
import { QuestionCard } from '../components/QuestionCard';
import { RoundSummary } from '../components/RoundSummary';
import { StudentAuthGate } from '../components/StudentAuthGate';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';
import { useAuth } from '@/lib/auth';
import { useQuizGame, Question, QuizRoundConfig } from '../hooks/useQuizGame';
import {
  fetchQuestionsFromDb,
  fetchTopicsFromDb,
  SyllabusTopic,
  shuffleQuestions,
  CAMBRIDGE_QUESTIONS,
  isDiagramQuestion,
  filterQuestionsByDiagram,
} from '../lib/questions';
import { getReviewPileIds } from '../lib/mastery';

export default function HomePage() {
  const { userProfile, loading: authLoading, isDemo } = useAuth();
  const isDemoSession = Boolean(
    isDemo ||
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student'
  );
  const game = useQuizGame();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [qData, tData] = await Promise.all([
          fetchQuestionsFromDb(),
          fetchTopicsFromDb(),
        ]);
        if (mounted) {
          setQuestions(qData);
          setTopics(tData);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load questions and topics:', err);
        if (mounted) {
          setQuestions([]);
          setTopics([]);
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [game.gameState]);

  // Keep track of the last configured round for "Play Again"
  const [lastRoundConfig, setLastRoundConfig] = useState<QuizRoundConfig | null>(null);
  const [lastRoundQuestions, setLastRoundQuestions] = useState<Question[]>([]);

  const handleStartRound = (config: QuizRoundConfig, questionsToStart: Question[]) => {
    setLastRoundConfig(config);
    setLastRoundQuestions(questionsToStart);
    game.startRound(config, questionsToStart);
  };

  const handleStartStandard = (config: QuizRoundConfig) => {
    if (questions.length === 0) return;
    let pool = [...questions];

    if (config.sourceType === 'topic' && config.sourceValue !== 'all') {
      const targetTopicIds = new Set(config.sourceValue.split(',').filter(Boolean));
      const topicFiltered = pool.filter((q) => q.topic_id && targetTopicIds.has(q.topic_id));
      if (topicFiltered.length > 0) pool = topicFiltered;
    }

    if (config.diagramFilter && config.diagramFilter !== 'mixed') {
      const filtered = filterQuestionsByDiagram(pool, config.diagramFilter);
      if (filtered.length > 0) {
        pool = filtered;
      } else {
        // Fallback across full question bank if topic had zero matching questions
        const subjectFallback = filterQuestionsByDiagram(CAMBRIDGE_QUESTIONS, config.diagramFilter);
        if (subjectFallback.length > 0) {
          pool = subjectFallback;
        }
      }
    }

    pool = shuffleQuestions(pool);
    const limit = config.roundLength === 'endless' ? Math.min(30, pool.length) : Math.min(config.roundLength, pool.length);
    const selected = pool.slice(0, limit);
    if (selected.length > 0) {
      handleStartRound(config, selected);
    }
  };

  const handleStartReviewPile = () => {
    if (isDemoSession || questions.length === 0) return;
    const pileIds = new Set(getReviewPileIds());
    const reviewQuestions = questions.filter((q) => pileIds.has(q.id));
    if (reviewQuestions.length === 0) return;

    const reviewConfig: QuizRoundConfig = {
      subject: 'Economics 0455',
      sourceType: 'review',
      sourceValue: 'review_pile',
      roundLength: Math.min(30, Math.max(3, reviewQuestions.length)) as 3 | 5 | 10 | 30 | 'endless',
      isTimed: false,
    };

    handleStartRound(reviewConfig, reviewQuestions);
  };

  const handlePracticeTopic = (topicId: string, topicName: string) => {
    let topicQuestions = questions.filter((q) => q.topic_id === topicId);
    if (topicQuestions.length === 0) return;
    topicQuestions = shuffleQuestions(topicQuestions);

    const topicConfig: QuizRoundConfig = {
      subject: 'Economics 0455',
      sourceType: 'topic',
      sourceValue: topicId,
      roundLength: Math.min(30, Math.max(3, topicQuestions.length)) as 3 | 5 | 10 | 30 | 'endless',
      isTimed: true,
    };

    handleStartRound(topicConfig, topicQuestions);
  };

  const handleReviewMissed = () => {
    const missed = game.stats.missedQuestions;
    if (missed.length === 0) return;

    const reviewConfig: QuizRoundConfig = {
      subject: game.config?.subject || 'Economics 0455',
      sourceType: 'review',
      sourceValue: 'round_missed',
      roundLength: Math.min(30, Math.max(3, missed.length)) as 3 | 5 | 10 | 30 | 'endless',
      isTimed: false,
    };

    handleStartRound(reviewConfig, missed);
  };

  const handlePlayAgain = () => {
    if (lastRoundConfig && lastRoundQuestions.length > 0) {
      if (lastRoundConfig.sourceType === 'review' && isDemoSession) {
        handleStartStandard({
          subject: 'Economics 0455',
          sourceType: 'topic',
          sourceValue: 'all',
          roundLength: 5,
          isTimed: true,
          diagramFilter: 'mixed',
        });
        return;
      }
      handleStartRound(lastRoundConfig, lastRoundQuestions);
    } else {
      handleStartStandard({
        subject: 'Economics 0455',
        sourceType: 'topic',
        sourceValue: 'all',
        roundLength: 5,
        isTimed: true,
        diagramFilter: 'mixed',
      });
    }
  };

  // Handle direct drill deep-links from Student Profile Hub (?drill=custom, ?drill=topic, ?drill=review)
  useEffect(() => {
    if (typeof window === 'undefined' || loading || questions.length === 0 || game.gameState !== 'setup') {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const drill = searchParams.get('drill');
    if (!drill) return;

    if (drill === 'custom') {
      const idsParam = searchParams.get('ids');
      if (idsParam) {
        const targetIds = new Set(
          idsParam
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        );
        const matchedQuestions = questions.filter((q) => targetIds.has(q.id));
        if (matchedQuestions.length > 0) {
          window.history.replaceState({}, '', '/');
          const customConfig: QuizRoundConfig = {
            subject: 'Economics 0455',
            sourceType: 'review',
            sourceValue: 'custom_drill',
            roundLength: Math.min(30, Math.max(3, matchedQuestions.length)) as 3 | 5 | 10 | 30 | 'endless',
            isTimed: false,
          };
          handleStartRound(customConfig, matchedQuestions);
        }
      }
    } else if (drill === 'topic') {
      const topicId = searchParams.get('topicId');
      if (topicId) {
        window.history.replaceState({}, '', '/');
        handlePracticeTopic(topicId, topicId);
      }
    } else if (drill === 'review') {
      window.history.replaceState({}, '', '/');
      handleStartReviewPile();
    }
  }, [loading, questions, game.gameState]);

  // 1. Sleek loading skeleton while checking auth session
  if (authLoading && !userProfile) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-[460px] bg-neutral-100 border-4 border-text shadow-[6px_6px_0_#201e1d] rounded-3xl sm:rounded-[32px] p-8 text-center space-y-4 animate-pulse">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent-200 border-2 border-text shadow-offset-2 flex items-center justify-center text-xl">
            ✨
          </div>
          <div className="h-6 w-48 mx-auto bg-neutral-200 rounded-lg border border-text/20" />
          <div className="h-4 w-64 mx-auto bg-neutral-200 rounded-lg border border-text/10" />
          <div className="pt-4 space-y-3">
            <div className="h-14 w-full bg-neutral-200 rounded-2xl border-2 border-text/30" />
            <div className="h-14 w-full bg-neutral-200 rounded-2xl border-2 border-text/30" />
          </div>
        </div>
      </main>
    );
  }

  // 2. Student Auth Gate when unauthenticated
  if (!userProfile) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
        <StudentAuthGate />
      </main>
    );
  }

  // 3. Question bank loading
  if (loading) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
        <div className="bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[6px_6px_0_#201e1d] rounded-[24px] p-8 text-center space-y-3">
          <div className="text-3xl animate-bounce">⏳</div>
          <p className="font-heading text-lg font-black text-[#201e1d]">
            Loading question bank...
          </p>
        </div>
      </main>
    );
  }

  if (questions.length === 0) {
    return (
      <main className="min-h-screen flex flex-col justify-center items-center px-4 py-8">
        <div className="w-full max-w-md bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[6px_6px_0_#201e1d] rounded-[28px] p-8 sm:p-10 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] flex items-center justify-center text-3xl">
            📭
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">
            No Questions Available
          </h1>
          <p className="text-sm font-medium text-[#645c50] leading-relaxed">
            The question bank is currently empty. Check back soon for new practice questions!
          </p>
        </div>
      </main>
    );
  }

  if (game.gameState === 'setup') {
    return (
      <main className="min-h-screen flex flex-col justify-center">
        <StartFlow
          onStart={handleStartStandard}
          onStartReview={handleStartReviewPile}
          onPracticeTopic={handlePracticeTopic}
          questions={questions}
          topics={topics}
        />
      </main>
    );
  }

  if (game.gameState === 'playing' && game.currentQuestion) {
    return (
      <main className="min-h-screen pt-2 sm:pt-6">
        <AdSlotBanner
          slotId="between_questions_interstitial"
          subjectCode={game.config?.subject}
          isTimedMode={game.config?.isTimed || false}
          questionIndex={game.currentQuestionIndex}
          className="max-w-2xl mx-auto px-4 mb-3"
        />
        <QuestionCard
          question={game.currentQuestion}
          questionNumber={game.currentQuestionIndex + 1}
          totalQuestions={game.totalQuestions}
          status={game.status}
          timeLeft={game.timeLeft}
          isTimed={game.config?.isTimed || false}
          onAnswer={game.handleAnswer}
          onNext={game.nextQuestion}
          selectedOptionId={game.selectedOptionId}
          firstWrongOptionId={game.firstWrongOptionId}
          currentStreak={game.currentStreak}
          isEndless={game.config?.roundLength === 'endless'}
          onFinish={game.finishEarly}
          totalXP={game.totalXP}
          subject={game.config?.subject}
        />
      </main>
    );
  }

  if (game.gameState === 'finished') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center py-4">
        <RoundSummary
          totalXP={game.totalXP}
          peakStreak={game.peakStreak}
          correctFirstTryCount={game.stats.correctFirstTryCount}
          correctRetryCount={game.stats.correctRetryCount}
          wrongCount={game.stats.wrongCount}
          missedQuestions={game.stats.missedDetails}
          onReviewMissed={handleReviewMissed}
          onPlayAgain={handlePlayAgain}
          onHome={game.returnToSetup}
        />
      </main>
    );
  }

  return null;
}
