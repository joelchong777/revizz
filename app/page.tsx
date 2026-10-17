'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { StartFlow } from '../components/StartFlow';
import { QuestionCard } from '../components/QuestionCard';
import { RoundSummary } from '../components/RoundSummary';
import { StudentAuthGate } from '../components/StudentAuthGate';
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
  const { userProfile, loading: authLoading } = useAuth();
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
      const topicFiltered = pool.filter((q) => q.topic_id === config.sourceValue);
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
    if (questions.length === 0) return;
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
            The question bank is completely empty right now. Once exam papers are uploaded and published in the Educator Portal, practice rounds will appear here!
          </p>
          <div className="pt-2">
            <Link
              href="/portal"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] font-bold text-sm text-[#201e1d] hover:bg-[#ffc6a5] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            >
              Go to Educator Portal →
            </Link>
          </div>
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
