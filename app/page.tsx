'use client';

import React, { useState, useRef } from 'react';
import { StartFlow } from '../components/StartFlow';
import { QuestionCard } from '../components/QuestionCard';
import { RoundSummary } from '../components/RoundSummary';
import { useQuizGame, Question, QuizRoundConfig } from '../hooks/useQuizGame';
import {
  CAMBRIDGE_QUESTIONS,
  getQuestionsForTopic,
  getQuestionsByIds,
  shuffleQuestions,
} from '../lib/questions';
import { getReviewPileIds } from '../lib/mastery';

export default function HomePage() {
  const game = useQuizGame();

  // Keep track of the last configured round for "Play Again"
  const [lastRoundConfig, setLastRoundConfig] = useState<QuizRoundConfig | null>(null);
  const [lastRoundQuestions, setLastRoundQuestions] = useState<Question[]>([]);

  const handleStartRound = (config: QuizRoundConfig, questions: Question[]) => {
    setLastRoundConfig(config);
    setLastRoundQuestions(questions);
    game.startRound(config, questions);
  };

  const handleStartStandard = (config: QuizRoundConfig) => {
    let pool = [...CAMBRIDGE_QUESTIONS];

    if (config.sourceType === 'topic' && config.sourceValue !== 'all') {
      const topicFiltered = getQuestionsForTopic(config.sourceValue);
      if (topicFiltered.length > 0) pool = topicFiltered;
    }

    pool = shuffleQuestions(pool);

    const limit = config.roundLength === 'endless' ? 30 : config.roundLength;
    let selected = [...pool];
    
    // Pad pool if user requested more questions than available in initial seed
    while (selected.length < limit && pool.length > 0) {
      selected = [...selected, ...pool.map((q) => ({ ...q, id: `${q.id}_repeat_${Math.random().toString(36).substring(2, 6)}` }))];
    }
    selected = selected.slice(0, limit as number);

    handleStartRound(config, selected);
  };

  const handleStartReviewPile = () => {
    const pileIds = getReviewPileIds();
    let reviewQuestions = getQuestionsByIds(pileIds);

    if (reviewQuestions.length === 0) {
      // Fallback if IDs were from a previous session or empty
      reviewQuestions = CAMBRIDGE_QUESTIONS.slice(0, 3);
    }

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
    let topicQuestions = getQuestionsForTopic(topicId);
    if (topicQuestions.length === 0) {
      topicQuestions = CAMBRIDGE_QUESTIONS.slice(0, 3);
    }
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
      });
    }
  };

  if (game.gameState === 'setup') {
    return (
      <main className="min-h-screen flex flex-col justify-center">
        <StartFlow
          onStart={handleStartStandard}
          onStartReview={handleStartReviewPile}
          onPracticeTopic={handlePracticeTopic}
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
