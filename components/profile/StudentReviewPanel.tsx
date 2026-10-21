'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { RichMarkdown } from '@/components/ui/RichMarkdown';
import { Question } from '@/hooks/useQuizGame';
import { SyllabusTopic } from '@/lib/questions';
import { getReviewPile, resolveFromReviewPile, ReviewPileMap } from '@/lib/mastery';
import {
  getBookmarkedQuestions,
  toggleQuestionBookmark,
  updateBookmarkNote,
  removeQuestionBookmark,
  BookmarkEntry,
  subscribeStudentProfileChanges,
} from '@/lib/studentProfile';
import { applyReveal, revealAnswers } from '@/lib/quizApi';
import type { AnswerReveal } from '@/types/quiz';
import { stripCambridgeIgcse } from '@/lib/compilerFilters';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';

export interface StudentReviewPanelProps {
  questions: Question[];
  topics: SyllabusTopic[];
  isDemoSession: boolean;
  onOpenAuthModal: () => void;
  onStartCustomDrill: (questionIds: string[], modeLabel: string) => void;
}

export function StudentReviewPanel({
  questions,
  topics,
  isDemoSession,
  onOpenAuthModal,
  onStartCustomDrill,
}: StudentReviewPanelProps): React.ReactElement {
  // 1. Declare ALL React hooks unconditionally at the top (React Error #310 Defense)
  const [mode, setMode] = useState<'mistakes' | 'bookmarks'>('mistakes');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [mistakeSeverity, setMistakeSeverity] = useState<'all' | '2+' | '3+'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'missed' | 'topic'>('recent');
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [savedNoteSuccess, setSavedNoteSuccess] = useState<Record<string, boolean>>({});

  // Local state for review pile & bookmarks with sync listeners
  const [reviewPile, setReviewPile] = useState<ReviewPileMap>({});
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  // Refresh helper
  const refreshStorageData = useCallback(() => {
    setReviewPile(getReviewPile());
    setBookmarks(getBookmarkedQuestions());
  }, []);

  // Initial load & subscribe to changes
  useEffect(() => {
    refreshStorageData();

    // Listen for custom review pile and profile events
    const handlePileChange = () => refreshStorageData();
    window.addEventListener('revizz_review_pile_changed', handlePileChange);
    const unsubscribeProfile = subscribeStudentProfileChanges(refreshStorageData);

    return () => {
      window.removeEventListener('revizz_review_pile_changed', handlePileChange);
      unsubscribeProfile();
    };
  }, [refreshStorageData]);

  // Answer keys the server has revealed for questions this student has finished
  const [reveals, setReveals] = useState<Record<string, AnswerReveal>>({});

  const pileIdsKey = useMemo(() => {
    const ids = new Set<string>([
      ...Object.keys(reviewPile),
      ...bookmarks.map((b) => b.questionId),
    ]);
    return Array.from(ids).sort().join(',');
  }, [reviewPile, bookmarks]);

  useEffect(() => {
    if (isDemoSession || !pileIdsKey) return;
    let cancelled = false;
    const ids = pileIdsKey.split(',').filter((id) => !reveals[id]);
    if (ids.length === 0) return;
    (async () => {
      try {
        const found: Record<string, AnswerReveal> = {};
        for (let i = 0; i < ids.length; i += 200) {
          for (const r of await revealAnswers(ids.slice(i, i + 200))) found[r.questionId] = r;
        }
        if (!cancelled && Object.keys(found).length > 0) {
          setReveals((prev) => ({ ...prev, ...found }));
        }
      } catch {
        // No reveal: options are shown without marking the answer.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pileIdsKey, isDemoSession]);

  // Map of question lookup by ID for fast retrieval
  const questionsById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const q of questions) {
      map.set(q.id, reveals[q.id] ? applyReveal(q, reveals[q.id]) : q);
    }
    return map;
  }, [questions, reveals]);

  // Questions in mistake pile
  const mistakeQuestionsList = useMemo(() => {
    const list: { question: Question; mistakeCount: number; lastMistakeAt: number }[] = [];
    for (const [id, entry] of Object.entries(reviewPile)) {
      const q = questionsById.get(id);
      if (q && entry && entry.mistakeCount > 0) {
        list.push({
          question: q,
          mistakeCount: entry.mistakeCount,
          lastMistakeAt: entry.lastMistakeAt || 0,
        });
      }
    }
    return list;
  }, [reviewPile, questionsById]);

  // Questions in bookmarks list
  const bookmarkQuestionsList = useMemo(() => {
    const list: { question: Question; bookmark: BookmarkEntry }[] = [];
    for (const b of bookmarks) {
      const q = questionsById.get(b.questionId);
      if (q) {
        list.push({ question: q, bookmark: b });
      }
    }
    return list;
  }, [bookmarks, questionsById]);

  // Set of bookmarked IDs for fast lookup
  const bookmarkedIdSet = useMemo(() => {
    return new Set(bookmarks.map((b) => b.questionId));
  }, [bookmarks]);

  // Available topics in the current mode for filtering
  const availableTopicsInMode = useMemo(() => {
    const sourceQuestions =
      mode === 'mistakes'
        ? mistakeQuestionsList.map((m) => m.question)
        : bookmarkQuestionsList.map((b) => b.question);

    const topicSet = new Set<string>();
    for (const q of sourceQuestions) {
      const t = q.topic_id || q.topic;
      if (t) topicSet.add(t);
    }

    return topics.filter((t) => topicSet.has(t.id) || topicSet.has(t.name));
  }, [mode, mistakeQuestionsList, bookmarkQuestionsList, topics]);

  // Filtered and sorted questions for current mode
  const filteredQuestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (mode === 'mistakes') {
      let items = mistakeQuestionsList.filter((item) => {
        const q = item.question;

        // Mistake severity filter
        if (mistakeSeverity === '2+' && item.mistakeCount < 2) return false;
        if (mistakeSeverity === '3+' && item.mistakeCount < 3) return false;

        // Topic filter
        if (selectedTopicId !== 'all') {
          const matchId = q.topic_id === selectedTopicId || q.topic === selectedTopicId;
          const matchedTopicObj = topics.find((t) => t.id === selectedTopicId);
          const matchName = matchedTopicObj && q.topic === matchedTopicObj.name;
          if (!matchId && !matchName) return false;
        }

        // Search query filter
        if (query) {
          const stemMatch = (q.stem_markdown || '').toLowerCase().includes(query);
          const citationMatch = (q.citation || '').toLowerCase().includes(query);
          const topicMatch = (q.topic || '').toLowerCase().includes(query);
          const idMatch = q.id.toLowerCase().includes(query);
          if (!stemMatch && !citationMatch && !topicMatch && !idMatch) return false;
        }

        return true;
      });

      // Sort
      return items.sort((a, b) => {
        if (sortBy === 'missed') {
          return b.mistakeCount - a.mistakeCount;
        }
        if (sortBy === 'topic') {
          return (a.question.topic || '').localeCompare(b.question.topic || '');
        }
        // recent
        return b.lastMistakeAt - a.lastMistakeAt;
      });
    } else {
      // Bookmarks mode
      let items = bookmarkQuestionsList.filter((item) => {
        const q = item.question;

        // Topic filter
        if (selectedTopicId !== 'all') {
          const matchId = q.topic_id === selectedTopicId || q.topic === selectedTopicId;
          const matchedTopicObj = topics.find((t) => t.id === selectedTopicId);
          const matchName = matchedTopicObj && q.topic === matchedTopicObj.name;
          if (!matchId && !matchName) return false;
        }

        // Search query filter
        if (query) {
          const stemMatch = (q.stem_markdown || '').toLowerCase().includes(query);
          const citationMatch = (q.citation || '').toLowerCase().includes(query);
          const topicMatch = (q.topic || '').toLowerCase().includes(query);
          const noteMatch = (item.bookmark.note || '').toLowerCase().includes(query);
          const idMatch = q.id.toLowerCase().includes(query);
          if (!stemMatch && !citationMatch && !topicMatch && !noteMatch && !idMatch) return false;
        }

        return true;
      });

      // Sort
      return items.sort((a, b) => {
        if (sortBy === 'topic') {
          return (a.question.topic || '').localeCompare(b.question.topic || '');
        }
        // recent by savedAt
        return b.bookmark.savedAt - a.bookmark.savedAt;
      });
    }
  }, [
    mode,
    mistakeQuestionsList,
    bookmarkQuestionsList,
    mistakeSeverity,
    selectedTopicId,
    topics,
    searchQuery,
    sortBy,
  ]);

  // Action Handlers
  const toggleExpand = (questionId: string) => {
    setExpandedQuestionIds((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleToggleBookmark = (q: Question) => {
    toggleQuestionBookmark(q.id, {
      topicId: q.topic_id,
      subject: q.topic,
    });
    refreshStorageData();
  };

  const handleResolveMistake = (questionId: string) => {
    resolveFromReviewPile(questionId);
    refreshStorageData();
  };

  const handleRemoveBookmark = (questionId: string) => {
    removeQuestionBookmark(questionId);
    refreshStorageData();
  };

  const handleSaveNote = (questionId: string) => {
    const noteText = editingNotes[questionId] !== undefined
      ? editingNotes[questionId]
      : (bookmarks.find((b) => b.questionId === questionId)?.note || '');

    updateBookmarkNote(questionId, noteText);
    refreshStorageData();
    setSavedNoteSuccess((prev) => ({ ...prev, [questionId]: true }));
    setTimeout(() => {
      setSavedNoteSuccess((prev) => ({ ...prev, [questionId]: false }));
    }, 2000);
  };

  const handleStartReviewQuiz = () => {
    const questionIds = filteredQuestions.map((item) => item.question.id);
    if (questionIds.length === 0) return;
    const label = mode === 'mistakes' ? 'Mistake Review Pile' : 'Bookmarked Questions';
    onStartCustomDrill(questionIds, label);
  };

  return (
    <div className="space-y-6">
      {/* 1. SUB-MODE SEGMENTED SWITCHER & ACTION DOCK */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d] w-full">
          <button
            type="button"
            onClick={() => setMode('mistakes')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'mistakes'
                ? 'bg-[#FB7185] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading'
                : 'text-[#201e1d] hover:bg-neutral-100 border-2 border-transparent'
            }`}
          >
            <span>🔥</span>
            <span className="truncate">Mistakes</span>
            <span
              className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-black border ${
                mode === 'mistakes' ? 'bg-[#201e1d] text-[#FB7185] border-[#201e1d]' : 'bg-neutral-200 text-[#201e1d] border-[#201e1d]/30'
              }`}
            >
              {mistakeQuestionsList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMode('bookmarks')}
            className={`min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'bookmarks'
                ? 'bg-[#FFDE59] text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading'
                : 'text-[#201e1d] hover:bg-neutral-100 border-2 border-transparent'
            }`}
          >
            <span>⭐</span>
            <span className="truncate">Bookmarks</span>
            <span
              className={`shrink-0 text-[11px] px-1.5 py-0.5 rounded-full font-black border ${
                mode === 'bookmarks' ? 'bg-[#201e1d] text-[#FFDE59] border-[#201e1d]' : 'bg-neutral-200 text-[#201e1d] border-[#201e1d]/30'
              }`}
            >
              {bookmarkQuestionsList.length}
            </span>
          </button>
        </div>

        {/* Primary CTA: Launch Review Quiz */}
        <button
          type="button"
          onClick={handleStartReviewQuiz}
          disabled={filteredQuestions.length === 0}
          className={`w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl border-2 border-[#201e1d] font-heading text-sm sm:text-base transition-all cursor-pointer ${
            filteredQuestions.length > 0
              ? 'bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] shadow-[3px_3px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_#201e1d]'
              : 'bg-neutral-200 text-neutral-400 border-neutral-300 cursor-not-allowed shadow-none'
          }`}
        >
          <span>🚀</span>
          <span>Launch Review Quiz ({filteredQuestions.length})</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {/* 2. DEMO SESSION LOCK BANNER */}
      {isDemoSession && mode === 'mistakes' && (
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-5 shadow-[4px_4px_0_0_#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] flex items-center justify-center text-xl shrink-0 shadow-[2px_2px_0_0_#201e1d]">
              🔒
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-base sm:text-lg text-[#201e1d]">
                Log In to Save & Unlock Your Spaced Mistake Review Pile
              </h3>
              <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                Guest mistakes are stored temporarily in this browser session. Create or log in to your free account to sync your mistake queue across devices and unlock automated Leitner spaced repetition.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenAuthModal}
            className="w-full sm:w-auto shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#201e1d] hover:bg-neutral-800 text-white rounded-xl text-xs font-heading shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <span>🔑 Log In to Sync</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {/* 3. FILTER & DRILL CONTROLS BAR */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] space-y-3.5">
        <div className="flex flex-col gap-3">
          {/* Search Input */}
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder={`Search ${mode === 'mistakes' ? 'mistakes' : 'bookmarks'}...`}
              className="w-full pl-9 pr-8 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold bg-neutral-50 border-2 border-[#201e1d] rounded-xl text-[#201e1d] placeholder:text-neutral-400 placeholder:font-normal focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-xs font-black text-neutral-400 hover:text-neutral-800"
              >
                ✕
              </button>
            )}
          </div>

          {/* Topic & Sort Selectors Row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="review-topic-filter" className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Topic
              </label>
              <select
                id="review-topic-filter"
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="w-full min-h-[42px] text-xs font-bold bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-2.5 py-2 text-[#201e1d] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFDE59] truncate"
              >
                <option value="all">All Topics ({availableTopicsInMode.length})</option>
                {availableTopicsInMode.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <label htmlFor="review-sort" className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                Sort By
              </label>
              <select
                id="review-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full min-h-[42px] text-xs font-bold bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-2.5 py-2 text-[#201e1d] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFDE59]"
              >
                <option value="recent">Most Recent</option>
                {mode === 'mistakes' && <option value="missed">Most Missed</option>}
                <option value="topic">Topic (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Severity Pills (Only for Mistakes Mode) */}
        {mode === 'mistakes' && (
          <div className="flex items-center gap-1.5 pt-2.5 border-t-2 border-neutral-100 flex-wrap">
            <span className="text-[11px] font-bold text-neutral-500 mr-1 shrink-0 uppercase tracking-wider">Severity:</span>
            <button
              type="button"
              onClick={() => setMistakeSeverity('all')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[38px] rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                mistakeSeverity === 'all'
                  ? 'bg-[#201e1d] text-white shadow-[1.5px_1.5px_0_0_#201e1d]'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              All ({mistakeQuestionsList.length})
            </button>
            <button
              type="button"
              onClick={() => setMistakeSeverity('2+')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[38px] rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                mistakeSeverity === '2+'
                  ? 'bg-[#FB7185] text-white shadow-[1.5px_1.5px_0_0_#201e1d]'
                  : 'bg-[#fff2eb] text-rose-900 hover:bg-[#FECDD3] shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              🔥 2+ Missed
            </button>
            <button
              type="button"
              onClick={() => setMistakeSeverity('3+')}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 min-h-[38px] rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                mistakeSeverity === '3+'
                  ? 'bg-rose-700 text-white shadow-[1.5px_1.5px_0_0_#201e1d]'
                  : 'bg-rose-100 text-rose-900 hover:bg-rose-200 shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              🚨 3+ Critical
            </button>
          </div>
        )}
      </div>

      {/* 4. INTERACTIVE QUESTION INSPECTOR LIST */}
      <div>
        {filteredQuestions.length > 0 ? (
          <div className="space-y-4">
            {filteredQuestions.map((item) => {
              const q = item.question;
              const isExpanded = Boolean(expandedQuestionIds[q.id]);
              const isBookmarked = bookmarkedIdSet.has(q.id);
              const mistakeCount =
                mode === 'mistakes'
                  ? (item as { mistakeCount: number }).mistakeCount
                  : reviewPile[q.id]?.mistakeCount || 0;

              const cleanCitation = stripCambridgeIgcse(q.citation || q.id);
              const resolvedDiagram = resolveDiagramUrl(q.diagram?.image_url || q.image_url);
              const currentNote =
                editingNotes[q.id] !== undefined
                  ? editingNotes[q.id]
                  : bookmarks.find((b) => b.questionId === q.id)?.note || '';

              return (
                <div
                  key={q.id}
                  className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_0_#201e1d] transition-all overflow-hidden"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b-2 border-neutral-100">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                      {cleanCitation && (
                        <span className="shrink-0 text-xs font-heading bg-neutral-100 text-neutral-800 border border-[#201e1d] rounded-lg px-2.5 py-0.5">
                          {cleanCitation}
                        </span>
                      )}
                      {q.topic && (
                        <span className="shrink-0 text-xs font-bold bg-[#fff8db] text-amber-950 border border-[#201e1d] rounded-lg px-2.5 py-0.5">
                          {q.topic}
                        </span>
                      )}
                      {mistakeCount > 0 && (
                        <span className="shrink-0 text-xs font-black bg-[#FECDD3] text-rose-950 border border-[#201e1d] rounded-lg px-2.5 py-0.5">
                          🔥 {mistakeCount}× missed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {/* Star Bookmark Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(q)}
                        className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 min-h-[38px] rounded-xl border-2 border-[#201e1d] text-xs font-heading flex items-center gap-1 transition-all cursor-pointer ${
                          isBookmarked
                            ? 'bg-[#FFDE59] text-[#201e1d] shadow-[1.5px_1.5px_0_0_#201e1d]'
                            : 'bg-white text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title={isBookmarked ? 'Remove bookmark' : 'Bookmark for revision'}
                      >
                        <span>{isBookmarked ? '⭐ Saved' : '☆ Bookmark'}</span>
                      </button>

                      {/* Expand / Collapse Button */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(q.id)}
                        className="shrink-0 whitespace-nowrap px-3.5 py-1.5 min-h-[38px] rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-neutral-200 text-[#201e1d] text-xs font-heading flex items-center gap-1 active:translate-y-0.5 transition-all cursor-pointer shadow-[1.5px_1.5px_0_0_#201e1d]"
                      >
                        <span>{isExpanded ? 'Collapse ▴' : 'Inspect Answer ▾'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Stem Preview: Exam Paper Snippet Box */}
                  <div className="mt-3.5 p-4 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d]/20 text-neutral-900 leading-relaxed font-normal">
                    <RichMarkdown
                      content={q.stem_markdown}
                      variant="neobrutalist"
                      className="prose prose-sm max-w-none text-neutral-900"
                    />
                  </div>

                  {/* Expanded Inspector Section */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t-2 border-neutral-100 space-y-4">
                      {/* Diagram if present */}
                      {resolvedDiagram && (
                        <div className="p-3 bg-neutral-50 rounded-2xl border-2 border-[#201e1d] flex flex-col items-center">
                          <p className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
                            Question Diagram
                          </p>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolvedDiagram}
                            alt="Question Diagram"
                            className="max-h-72 object-contain rounded-xl border-2 border-[#201e1d] bg-white p-2 shadow-xs"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* 4 Options Grid */}
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">
                          Options & Answer Key
                        </p>
                        <div className="grid grid-cols-1 gap-2.5">
                          {(q.options || []).map((opt, idx) => {
                            const isCorrect = opt.id === q.correct_option_id;
                            const optionLetter = ['A', 'B', 'C', 'D'][idx] || String.fromCharCode(65 + idx);

                            return (
                              <div
                                key={opt.id}
                                className={`p-3.5 rounded-xl border-2 flex items-start gap-3 transition-colors ${
                                  isCorrect
                                    ? 'bg-[#BBF7D0]/40 border-emerald-600 text-emerald-950 shadow-[2px_2px_0_0_#15803D]'
                                    : 'bg-white border-[#201e1d]/30 text-neutral-800'
                                }`}
                              >
                                <span
                                  className={`w-7 h-7 rounded-lg font-heading text-xs flex items-center justify-center shrink-0 border-2 ${
                                    isCorrect
                                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                                      : 'bg-neutral-100 text-[#201e1d] border-[#201e1d]'
                                  }`}
                                >
                                  {optionLetter}
                                </span>

                                <div className="flex-1 text-xs sm:text-sm font-medium pt-0.5">
                                  <RichMarkdown
                                    content={opt.text_markdown}
                                    variant="plain"
                                  />
                                </div>

                                {isCorrect && (
                                  <span className="shrink-0 text-[11px] font-heading bg-emerald-700 text-white px-2.5 py-0.5 rounded-full border border-emerald-800">
                                    ✓ Correct Key
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Explanation */}
                      {(q.explanation_markdown || q.topic) && (
                        <div className="p-4 bg-[#fff8db] rounded-2xl border-2 border-[#201e1d] text-amber-950 shadow-[2px_2px_0_0_#201e1d]">
                          <p className="text-xs font-heading text-amber-900 flex items-center gap-1.5 mb-2">
                            <span>💡</span> Step-by-Step Mark Scheme Explanation
                          </p>
                          <div className="text-xs font-medium leading-relaxed">
                            <RichMarkdown
                              content={q.explanation_markdown ||
                                `This question tests understanding of "${q.topic || 'the syllabus'}". Review the correct option above to consolidate this concept.`}
                              variant="neobrutalist"
                              className="prose prose-sm max-w-none text-amber-950"
                            />
                          </div>
                        </div>
                      )}

                      {/* Study Notes Input Field */}
                      <div className="p-3.5 bg-neutral-100 rounded-2xl border-2 border-[#201e1d] space-y-2">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`note-${q.id}`}
                            className="text-xs font-heading text-[#201e1d] flex items-center gap-1.5"
                          >
                            <span>📝</span> Personal Study Note
                          </label>
                          {savedNoteSuccess[q.id] && (
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded-md animate-fade-in">
                              ✓ Note Saved!
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            id={`note-${q.id}`}
                            rows={2}
                            value={currentNote}
                            onChange={(e) =>
                              setEditingNotes((prev) => ({ ...prev, [q.id]: e.target.value }))
                            }
                            placeholder="Add your personal reminder, formula tip, or mnemonic for this question..."
                            className="flex-1 text-xs font-medium bg-white border-2 border-[#201e1d] rounded-xl p-2.5 text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FFDE59]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNote(q.id)}
                            className="self-end px-3.5 py-2.5 bg-[#201e1d] hover:bg-neutral-800 text-white rounded-xl text-xs font-heading shrink-0 whitespace-nowrap transition-all cursor-pointer shadow-[1.5px_1.5px_0_0_#201e1d]"
                          >
                            Save Note
                          </button>
                        </div>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t-2 border-neutral-100 flex-wrap">
                        {mode === 'mistakes' ? (
                          <button
                            type="button"
                            onClick={() => handleResolveMistake(q.id)}
                            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-emerald-600 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-all cursor-pointer active:translate-y-0.5"
                          >
                            <span>✓ Mark Mastered & Remove from Pile</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveBookmark(q.id)}
                            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition-all cursor-pointer active:translate-y-0.5"
                          >
                            <span>✕ Remove from Bookmarks</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onStartCustomDrill([q.id], 'Single Question Drill')}
                          className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] text-xs font-heading shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                        >
                          <span>Drill This Question</span>
                          <span aria-hidden="true">→</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#FFFDF7] border-2 border-dashed border-[#201e1d] rounded-3xl p-8 sm:p-12 text-center shadow-[3px_3px_0_0_#201e1d]">
            {mode === 'mistakes' ? (
              mistakeQuestionsList.length === 0 ? (
                <div>
                  <div className="text-4xl">🎉</div>
                  <h3 className="text-lg sm:text-xl font-heading text-[#201e1d] mt-3">
                    Review Pile is Clean!
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-neutral-600 max-w-md mx-auto mt-1 leading-relaxed">
                    You have zero unresolved mistakes waiting in your queue. Whenever you make a mistake during a revision round, it will automatically enqueue here for targeted retrieval practice.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-4xl">🔍</div>
                  <h3 className="text-lg sm:text-xl font-heading text-[#201e1d] mt-3">
                    No mistakes match your filter
                  </h3>
                  <p className="text-xs font-bold text-neutral-500 mt-1">
                    Try relaxing your search query or selecting &quot;All Mistakes&quot;.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedTopicId('all');
                      setMistakeSeverity('all');
                    }}
                    className="mt-4 px-4 py-2 text-xs font-heading rounded-xl bg-[#FFFDF7] hover:bg-neutral-100 text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )
            ) : bookmarkQuestionsList.length === 0 ? (
              <div>
                <div className="text-4xl">⭐</div>
                <h3 className="text-lg sm:text-xl font-heading text-[#201e1d] mt-3">
                  No Bookmarked Questions Yet
                </h3>
                <p className="text-xs sm:text-sm font-medium text-neutral-600 max-w-md mx-auto mt-1 leading-relaxed">
                  Tap the star icon on any tricky exam question during practice or test compilation to save it here for deep revision with personal study notes.
                </p>
              </div>
            ) : (
              <div>
                <div className="text-4xl">🔍</div>
                <h3 className="text-lg sm:text-xl font-heading text-[#201e1d] mt-3">
                  No bookmarked questions match your filter
                </h3>
                <p className="text-xs font-bold text-neutral-500 mt-1">
                  Try clearing your search keyword or switching topic filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTopicId('all');
                  }}
                  className="mt-4 px-4 py-2 text-xs font-heading rounded-xl bg-[#FFFDF7] hover:bg-neutral-100 text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
