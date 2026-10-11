'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  FileText,
  Bookmark,
  Sparkles,
  Eye,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Info,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  ChevronDown,
  Search,
  Columns,
  BookOpen,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX, validateKaTeXSyntax } from '@/lib/ingestion/katexSanitizer';
import { CAMBRIDGE_TOPICS } from '@/lib/questions';

export interface IngestionStemEditorProps {
  questionNumber: number;
  stemMarkdown: string;
  citation: string;
  onChangeStem: (newStem: string) => void;
  onChangeCitation: (newCitation: string) => void;
  topicName?: string;
  syllabusTopics?: Array<{ name: string; order_index?: number }> | string[];
  onChangeTopic?: (newTopic: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  className?: string;
}

export interface KatexSyntaxIssue {
  type: 'unclosed-delimiter' | 'syntax-error' | 'unclosed-bracket';
  message: string;
  snippet?: string;
}

/**
 * Analyzes markdown text for common KaTeX delimiters and syntax issues.
 */
export function detectKatexErrors(text: string): KatexSyntaxIssue[] {
  const result = validateKaTeXSyntax(text);
  if (result.isValid) return [];
  return result.errors.map((msg) => ({
    type: 'syntax-error',
    message: msg,
  }));
}

interface QuickToolbarItem {
  id: string;
  label: string;
  tooltip: string;
  insert: {
    before: string;
    after?: string;
    defaultContent?: string;
    selectPlaceholder?: boolean;
  };
}

// Quick Typography Toolbar Items required by Revizz design system
const QUICK_TYPOGRAPHY_TOOLS: QuickToolbarItem[] = [
  {
    id: 'math',
    label: 'Math ($...$)',
    tooltip: 'Insert inline math formula ($x$)',
    insert: {
      before: '$',
      after: '$',
      defaultContent: 'x',
      selectPlaceholder: true,
    },
  },
  {
    id: 'fraction',
    label: 'Fraction (\\frac{a}{b})',
    tooltip: 'Insert fraction (\\frac{a}{b})',
    insert: {
      before: '\\frac{',
      after: '}{b}',
      defaultContent: 'a',
      selectPlaceholder: true,
    },
  },
  {
    id: 'exponent',
    label: 'Exponent (x^2)',
    tooltip: 'Insert exponent / power (x^2)',
    insert: {
      before: '^{',
      after: '}',
      defaultContent: '2',
      selectPlaceholder: true,
    },
  },
  {
    id: 'unit',
    label: 'Unit (\\text{m/s})',
    tooltip: 'Insert scientific / unit notation (\\text{m/s})',
    insert: {
      before: '\\text{',
      after: '}',
      defaultContent: 'm/s',
      selectPlaceholder: true,
    },
  },
  {
    id: 'chemical',
    label: 'Chemical (\\text{CO}_2)',
    tooltip: 'Insert chemical formula (\\text{CO}_2)',
    insert: {
      before: '\\text{CO}_{',
      after: '}',
      defaultContent: '2',
      selectPlaceholder: true,
    },
  },
];

// Extended math symbols in "+ More" popover
const EXTENDED_MATH_TOOLS: QuickToolbarItem[] = [
  {
    id: 'display',
    label: '$$\\dots$$',
    tooltip: 'Display block math ($$\\dots$$)',
    insert: {
      before: '$$\n',
      after: '\n$$',
      defaultContent: '\\dots',
      selectPlaceholder: true,
    },
  },
  {
    id: 'times',
    label: '\\times',
    tooltip: 'Multiplication (\\times)',
    insert: { before: '\\times ' },
  },
  {
    id: 'delta',
    label: '\\Delta',
    tooltip: 'Delta difference (\\Delta)',
    insert: { before: '\\Delta ' },
  },
  {
    id: 'percent',
    label: '\\%',
    tooltip: 'Escaped percentage (\\%)',
    insert: { before: '\\%' },
  },
  {
    id: 'approx',
    label: '\\approx',
    tooltip: 'Approximately equal (\\approx)',
    insert: { before: '\\approx ' },
  },
  {
    id: 'subscript',
    label: 'x_1',
    tooltip: 'Subscript (x_1)',
    insert: { before: '_{', after: '}', defaultContent: '1', selectPlaceholder: true },
  },
  {
    id: 'sqrt',
    label: '\\sqrt{x}',
    tooltip: 'Square root (\\sqrt{x})',
    insert: { before: '\\sqrt{', after: '}', defaultContent: 'x', selectPlaceholder: true },
  },
  {
    id: 'pi',
    label: '\\pi',
    tooltip: 'Pi constant (\\pi)',
    insert: { before: '\\pi ' },
  },
];

type ViewLayoutMode = 'split' | 'edit-only' | 'preview-only';

export function IngestionStemEditor({
  questionNumber,
  stemMarkdown,
  citation,
  onChangeStem,
  onChangeCitation,
  topicName,
  syllabusTopics,
  onChangeTopic,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  className,
}: IngestionStemEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const moreMathRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<ViewLayoutMode>('split');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isMoreMathOpen, setIsMoreMathOpen] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Topic selector state
  const [isTopicMenuOpen, setIsTopicMenuOpen] = useState(false);
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Normalize topic options list
  const normalizedTopics = useMemo(() => {
    if (syllabusTopics && syllabusTopics.length > 0) {
      return syllabusTopics.map((item, idx) => {
        if (typeof item === 'string') {
          return { name: item, order_index: idx + 1 };
        }
        return { name: item.name, order_index: item.order_index ?? idx + 1 };
      });
    }
    return CAMBRIDGE_TOPICS.map((t) => ({
      name: t.name,
      order_index: t.orderIndex,
    }));
  }, [syllabusTopics]);

  // Fuzzy filter for topics
  const filteredTopics = useMemo(() => {
    const q = topicSearchQuery.trim().toLowerCase();
    if (!q) return normalizedTopics;

    return normalizedTopics.filter((t) => {
      const name = t.name.toLowerCase();
      // Direct substring match
      if (name.includes(q)) return true;

      // Sequential character fuzzy match
      let qi = 0;
      for (let ni = 0; ni < name.length && qi < q.length; ni++) {
        if (name[ni] === q[qi]) {
          qi++;
        }
      }
      return qi === q.length;
    });
  }, [normalizedTopics, topicSearchQuery]);

  // KaTeX syntax validation
  const validationResult = useMemo(() => {
    return validateKaTeXSyntax(stemMarkdown);
  }, [stemMarkdown]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setIsActionMenuOpen(false);
        setConfirmingDelete(false);
      }
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(target)) {
        setIsTopicMenuOpen(false);
      }
      if (moreMathRef.current && !moreMathRef.current.contains(target)) {
        setIsMoreMathOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resize textarea smoothly
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.max(220, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [stemMarkdown, viewMode, adjustHeight]);

  // Insert math snippet at cursor position
  const handleInsert = useCallback(
    (tool: QuickToolbarItem) => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? stemMarkdown.length;
      const end = textarea?.selectionEnd ?? stemMarkdown.length;
      const selected = stemMarkdown.slice(start, end);

      const { before, after = '', defaultContent = '', selectPlaceholder } = tool.insert;

      let insertion = '';
      let targetStart = start;
      let targetEnd = start;

      if (selected.length > 0) {
        insertion = `${before}${selected}${after}`;
        targetStart = start + insertion.length;
        targetEnd = targetStart;
      } else {
        insertion = `${before}${defaultContent}${after}`;
        if (selectPlaceholder && defaultContent.length > 0) {
          targetStart = start + before.length;
          targetEnd = targetStart + defaultContent.length;
        } else {
          targetStart = start + before.length;
          targetEnd = targetStart;
        }
      }

      const nextVal = stemMarkdown.slice(0, start) + insertion + stemMarkdown.slice(end);
      onChangeStem(nextVal);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(targetStart, targetEnd);
          adjustHeight();
        }
      }, 0);
    },
    [stemMarkdown, onChangeStem, adjustHeight]
  );

  // Auto-clean KaTeX
  const handleCleanKaTeX = useCallback(() => {
    if (!stemMarkdown) return;
    const sanitized = sanitizeKaTeX(stemMarkdown);
    if (sanitized !== stemMarkdown) {
      onChangeStem(sanitized);
    }
  }, [stemMarkdown, onChangeStem]);

  // Character and word counts
  const wordCount = useMemo(() => {
    const trimmed = stemMarkdown.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [stemMarkdown]);

  const hasActionProps = Boolean(onMoveUp || onMoveDown || onDuplicate || onDelete);
  const currentTopicDisplay = topicName || normalizedTopics[0]?.name || 'General Topic';

  return (
    <div
      className={cn(
        'w-full bg-white border-2 border-slate-800 rounded-3xl shadow-chunky overflow-hidden flex flex-col text-slate-800 transition-all',
        className
      )}
    >
      {/* 1. TOP NEOBRUTALIST HEADER BAR */}
      <div className="p-3.5 sm:p-4 border-b-2 border-slate-800 bg-[#FFFDF7] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Question Badge & Citation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-yellow border-2 border-slate-800 flex items-center justify-center shadow-chunky shrink-0">
              <FileText className="w-4 h-4 text-slate-900" />
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-xl bg-brand-yellow text-slate-900 border-2 border-slate-800 font-heading font-black text-xs sm:text-sm shadow-chunky select-none tracking-tight">
              Question {questionNumber}
            </span>
          </div>

          {/* Cambridge Citation Input */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={`citation-q${questionNumber}`}
              className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1 select-none whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 text-brand-indigo" />
              <span className="hidden sm:inline">Citation:</span>
            </label>
            <input
              id={`citation-q${questionNumber}`}
              type="text"
              value={citation}
              onChange={(e) => onChangeCitation(e.target.value)}
              placeholder="e.g. 0455/12/M/J/24 Q1"
              className="w-44 sm:w-52 px-3 py-1 text-xs font-mono bg-white text-slate-800 border-2 border-slate-800 rounded-xl shadow-chunky outline-none focus:ring-2 focus:ring-brand-yellow transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Center / Right: Syllabus Topic Selector & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Syllabus Topic Selector with Fuzzy Topic Match */}
          <div className="relative" ref={topicDropdownRef}>
            <button
              type="button"
              onClick={() => setIsTopicMenuOpen((prev) => !prev)}
              aria-label="Select syllabus topic"
              title="Assign Cambridge syllabus topic"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border-2 border-b-4 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer select-none max-w-[220px] truncate"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-teal shrink-0" />
              <span className="truncate">{currentTopicDisplay}</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 text-slate-600 transition-transform duration-150 shrink-0',
                  isTopicMenuOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Fuzzy Dropdown Combobox */}
            {isTopicMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-2.5 bg-white border-2 border-slate-800 rounded-2xl shadow-chunky-lg z-40 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Syllabus Topic</span>
                  <span className="text-[10px] lowercase text-slate-400 font-mono">
                    {filteredTopics.length} available
                  </span>
                </div>

                {/* Fuzzy Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    placeholder="Search topic (fuzzy match)..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border-2 border-slate-800 rounded-xl outline-none focus:bg-white focus:ring-1 focus:ring-brand-teal font-sans"
                  />
                  {topicSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTopicSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Topics list */}
                <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1">
                  {filteredTopics.map((topic) => {
                    const isSelected = topic.name === topicName;
                    return (
                      <button
                        key={topic.name}
                        type="button"
                        onClick={() => {
                          onChangeTopic?.(topic.name);
                          setIsTopicMenuOpen(false);
                          setTopicSearchQuery('');
                        }}
                        className={cn(
                          'w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-all cursor-pointer border',
                          isSelected
                            ? 'bg-brand-teal/15 text-teal-950 border-brand-teal font-bold'
                            : 'hover:bg-slate-100 text-slate-700 border-transparent'
                        )}
                      >
                        <span className="truncate">
                          <span className="font-mono text-[10px] text-slate-500 mr-1.5">
                            {topic.order_index ? `${topic.order_index}.` : '•'}
                          </span>
                          {topic.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand-teal shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredTopics.length === 0 && (
                    <div className="p-3 text-center text-xs text-slate-500 italic">
                      No matching syllabus topics found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dual Split View Controls: [Split View] / [Edit Only] / [Preview Only] */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-800 shadow-chunky select-none">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Side-by-side Dual Split View"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'split'
                  ? 'bg-brand-yellow text-slate-900 border-2 border-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('edit-only')}
              title="Markdown Editor Only"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'edit-only'
                  ? 'bg-brand-yellow text-slate-900 border-2 border-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview-only')}
              title="Live KaTeX Preview Only"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'preview-only'
                  ? 'bg-brand-yellow text-slate-900 border-2 border-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>

          {/* Action Overflow Menu [···] */}
          {hasActionProps && (
            <div className="relative" ref={actionMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsActionMenuOpen((prev) => !prev);
                  setConfirmingDelete(false);
                }}
                aria-label="Question actions menu"
                title="Question Actions"
                className="p-1.5 bg-white hover:bg-slate-100 text-slate-900 border-2 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center select-none"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-slate-800 rounded-2xl shadow-chunky-lg z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                  {onMoveUp && (
                    <button
                      type="button"
                      onClick={() => {
                        onMoveUp();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-slate-600" />
                      <span>Move Up</span>
                    </button>
                  )}
                  {onMoveDown && (
                    <button
                      type="button"
                      onClick={() => {
                        onMoveDown();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-slate-600" />
                      <span>Move Down</span>
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={() => {
                        onDuplicate();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Duplicate Question</span>
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-slate-200" />
                      {confirmingDelete ? (
                        <div className="p-2 bg-rose-50 border border-rose-300 rounded-xl mx-1.5 my-1">
                          <p className="text-[11px] font-bold text-rose-900 mb-1.5 leading-tight">
                            Delete question {questionNumber}?
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDelete();
                                setIsActionMenuOpen(false);
                                setConfirmingDelete(false);
                              }}
                              className="flex-1 py-1 px-2 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer text-center"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete(false)}
                              className="flex-1 py-1 px-2 text-[11px] font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors cursor-pointer text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(true)}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                          <span>Delete Question</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. QUICK TYPOGRAPHY TOOLBAR & KATEX VALIDATION BADGE */}
      <div className="p-2.5 sm:px-4 sm:py-2.5 border-b-2 border-slate-800 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Quick Typography Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 select-none">
            <Sparkles className="w-3.5 h-3.5 text-brand-indigo" />
            <span>Format:</span>
          </div>

          {/* Quick Typography Tools */}
          {QUICK_TYPOGRAPHY_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.tooltip}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleInsert(tool)}
              className="inline-flex items-center justify-center px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-900 text-xs font-mono font-bold border-2 border-b-4 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all select-none cursor-pointer whitespace-nowrap"
            >
              {tool.label}
            </button>
          ))}

          {/* Clean KaTeX Button */}
          <button
            type="button"
            onClick={handleCleanKaTeX}
            title="Auto-format delimiters and normalize LaTeX math notation (sanitizeKaTeX)"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-brand-yellow/30 text-slate-900 text-xs font-bold border-2 border-b-4 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer select-none"
          >
            <Wand2 className="w-3.5 h-3.5 text-brand-teal" />
            <span>Clean KaTeX</span>
          </button>

          {/* [+ More Math] Popover Button */}
          <div className="relative" ref={moreMathRef}>
            <button
              type="button"
              onClick={() => setIsMoreMathOpen((prev) => !prev)}
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border-2 border-b-4 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer select-none"
            >
              <span>+ More</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 text-slate-600 transition-transform duration-150',
                  isMoreMathOpen && 'rotate-180'
                )}
              />
            </button>

            {isMoreMathOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-white border-2 border-slate-800 rounded-2xl shadow-chunky-lg z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  Extended Mathematical Tokens
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {EXTENDED_MATH_TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      title={tool.tooltip}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        handleInsert(tool);
                        setIsMoreMathOpen(false);
                      }}
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-slate-50 hover:bg-brand-yellow/30 text-slate-900 text-xs font-mono font-bold border border-slate-800 rounded-lg transition-colors cursor-pointer select-none"
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live KaTeX Syntax Validation Badge */}
        <div className="flex items-center gap-2">
          {validationResult.isValid ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-900 border-2 border-emerald-600 font-bold text-xs rounded-full shadow-chunky select-none"
              title="KaTeX syntax is valid and ready for student rendering"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>KaTeX Valid</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowErrorDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-950 border-2 border-rose-500 font-bold text-xs rounded-full shadow-chunky cursor-pointer transition-transform active:translate-y-0.5 select-none animate-pulse"
              title="Click to view KaTeX syntax errors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
              <span>KaTeX Syntax Error ({validationResult.errors.length})</span>
            </button>
          )}

          <span className="font-mono text-[11px] text-slate-500 hidden md:inline ml-1">
            {stemMarkdown.length} chars · {wordCount} words
          </span>
        </div>
      </div>

      {/* 3. EXPANDABLE KATEX SYNTAX ERROR BANNER */}
      {(!validationResult.isValid || showErrorDetails) && validationResult.errors.length > 0 && (
        <div className="p-3.5 bg-rose-50 border-b-2 border-slate-800 text-slate-900 flex items-start gap-3 animate-in fade-in">
          <div className="p-1 rounded-lg bg-rose-200 border border-rose-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-rose-800" />
          </div>
          <div className="flex-1 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-heading font-black text-rose-950 uppercase tracking-wide">
                KaTeX Syntax Verification ({validationResult.errors.length} issue
                {validationResult.errors.length === 1 ? '' : 's'})
              </span>
              <button
                type="button"
                onClick={handleCleanKaTeX}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-800 font-bold text-xs shadow-chunky hover:bg-brand-yellow/30 active:translate-y-0.5"
              >
                Auto-Fix Delimiters
              </button>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-800 font-mono text-[11px]">
              {validationResult.errors.map((err, idx) => (
                <li key={idx} className="leading-snug">
                  {err}
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-slate-600 pt-0.5">
              Tip: For currency figures (e.g. $50), escape dollar signs as <code>\$50</code>, or click <strong>Clean KaTeX</strong>.
            </div>
          </div>
        </div>
      )}

      {/* 4. DUAL SPLIT WORKSPACE: Markdown Input on Left, Live KaTeX Preview on Right */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col">
        <div
          className={cn(
            'grid gap-4 flex-1',
            viewMode === 'split' && 'grid-cols-1 lg:grid-cols-2',
            viewMode === 'edit-only' && 'grid-cols-1',
            viewMode === 'preview-only' && 'grid-cols-1'
          )}
        >
          {/* LEFT: Markdown Input Surface */}
          {(viewMode === 'split' || viewMode === 'edit-only') && (
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-brand-indigo" />
                  Markdown Stem Input
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  $...$ inline · $$...$$ display
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={stemMarkdown}
                onChange={(e) => {
                  onChangeStem(e.target.value);
                  adjustHeight();
                }}
                placeholder="Enter Cambridge question stem in Markdown. Use $...$ for inline equations and $$...$$ for display blocks..."
                className="w-full min-h-[220px] p-4 rounded-2xl border-2 border-slate-800 bg-white text-slate-900 font-mono text-sm leading-relaxed shadow-chunky outline-none focus:ring-2 focus:ring-brand-yellow transition-all resize-y placeholder:text-slate-400"
              />
            </div>
          )}

          {/* RIGHT: Live KaTeX Rendered Preview */}
          {(viewMode === 'split' || viewMode === 'preview-only') && (
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-brand-teal" />
                  KaTeX Live Preview
                </span>
                {validationResult.isValid && stemMarkdown.trim() && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verified Output
                  </span>
                )}
              </div>
              <div className="w-full min-h-[220px] p-5 rounded-2xl border-2 border-slate-800 bg-amber-50/60 text-slate-900 shadow-chunky overflow-y-auto flex-1">
                {stemMarkdown.trim() ? (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed font-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#e11d48' }]]}
                      components={{
                        p: ({ ...props }) => (
                          <p className="mb-3 last:mb-0 leading-relaxed text-slate-900" {...props} />
                        ),
                        strong: ({ ...props }) => (
                          <strong className="font-bold text-slate-900" {...props} />
                        ),
                        em: ({ ...props }) => <em className="italic" {...props} />,
                        code: ({ ...props }) => (
                          <code
                            className="font-mono text-xs bg-slate-200 px-1.5 py-0.5 rounded border border-slate-300 text-slate-800"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {stemMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-slate-400 italic text-sm py-12 text-center flex flex-col items-center justify-center gap-2">
                    <Edit3 className="w-6 h-6 text-slate-300" />
                    <span>No question stem content entered yet. Start typing in the Markdown editor.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. FOOTER STATUS BAR */}
      <div className="px-4 py-2.5 bg-slate-100 border-t-2 border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium">
            <Info className="w-3.5 h-3.5 text-brand-indigo" />
            Cambridge KaTeX Renderer Active
          </span>
          <span className="hidden sm:inline text-slate-400">|</span>
          <span className="font-mono text-[11px] text-slate-500">
            Topic: <strong>{currentTopicDisplay}</strong>
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Tip: Wrap inline math in <code>$formula$</code> & display math in <code>$$formula$$</code>
        </div>
      </div>
    </div>
  );
}

export default IngestionStemEditor;
