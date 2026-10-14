'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';
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
        'w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_#201e1d] overflow-hidden flex flex-col font-body text-[#201e1d] transition-all',
        className
      )}
    >
      {/* 1. TOP HEADER BAR */}
      <div className="p-3.5 sm:p-4 border-b-2 border-[#201e1d] bg-[#f9f4ed] flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Question Badge & Citation */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffe1d0] border-2 border-[#c67139] text-[#c67139] font-adminHeading font-bold text-xs select-none shadow-[1px_1px_0_#c67139]">
              <FileText className="w-3.5 h-3.5 text-[#c67139]" />
              Question {questionNumber}
            </span>
          </div>

          {/* Cambridge Citation Input */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor={`citation-q${questionNumber}`}
              className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1 select-none whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#c67139]" />
              <span className="hidden sm:inline font-adminHeading font-bold">Citation:</span>
            </label>
            <input
              id={`citation-q${questionNumber}`}
              type="text"
              value={citation}
              onChange={(e) => onChangeCitation(e.target.value)}
              placeholder="e.g. 0455/12/M/J/24 Q1"
              className="w-44 sm:w-52 px-3 py-1 bg-white border-2 border-[#201e1d] rounded-full text-xs font-mono text-[#201e1d] outline-none focus:border-[#c67139] transition-all placeholder:text-[#82796a] shadow-[1px_1px_0_#201e1d]"
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-[#201e1d] rounded-full text-xs font-adminHeading font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 transition-all cursor-pointer select-none max-w-[220px] truncate shadow-[1.5px_1.5px_0_#201e1d]"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#728157] shrink-0" />
              <span className="truncate">{currentTopicDisplay}</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 text-[#645c50] transition-transform duration-150 shrink-0',
                  isTopicMenuOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Fuzzy Dropdown Combobox */}
            {isTopicMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 p-2.5 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[4px_4px_0_#201e1d] z-40 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2 font-body">
                <div className="text-[11px] font-adminHeading font-bold text-[#645c50] uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>Syllabus Topic</span>
                  <span className="text-[10px] lowercase text-[#82796a] font-mono">
                    {filteredTopics.length} available
                  </span>
                </div>

                {/* Fuzzy Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#82796a] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    placeholder="Search topic (fuzzy match)..."
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border-2 border-[#dcd3c4] focus:border-[#201e1d] rounded-full outline-none text-[#201e1d] font-sans"
                  />
                  {topicSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setTopicSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d]"
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
                          'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-all cursor-pointer border',
                          isSelected
                            ? 'bg-[#ffe1d0] text-[#201e1d] border-[#c67139] font-bold'
                            : 'hover:bg-[#eee7db] text-[#474238] border-transparent'
                        )}
                      >
                        <span className="truncate">
                          <span className="font-mono text-[10px] text-[#82796a] mr-1.5">
                            {topic.order_index ? `${topic.order_index}.` : '•'}
                          </span>
                          {topic.name}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#c67139] shrink-0 stroke-[2.5]" />}
                      </button>
                    );
                  })}
                  {filteredTopics.length === 0 && (
                    <div className="p-3 text-center text-xs text-[#82796a] italic">
                      No matching syllabus topics found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dual Split View Controls: [Split View] / [Edit Only] / [Preview Only] */}
          <div className="inline-flex items-center bg-white p-1 rounded-full border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d] select-none">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Side-by-side Dual Split View"
              className={cn(
                'px-3 py-1 rounded-full text-xs font-adminHeading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'split'
                  ? 'bg-[#201e1d] text-[#f9f4ed]'
                  : 'text-[#645c50] hover:text-[#201e1d]'
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
                'px-3 py-1 rounded-full text-xs font-adminHeading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'edit-only'
                  ? 'bg-[#201e1d] text-[#f9f4ed]'
                  : 'text-[#645c50] hover:text-[#201e1d]'
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
                'px-3 py-1 rounded-full text-xs font-adminHeading font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'preview-only'
                  ? 'bg-[#201e1d] text-[#f9f4ed]'
                  : 'text-[#645c50] hover:text-[#201e1d]'
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
                className="p-1.5 bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] border-[1.5px] border-[#dcd3c4] rounded-full transition-all cursor-pointer flex items-center select-none"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl shadow-lg z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                  {onMoveUp && (
                    <button
                      type="button"
                      onClick={() => {
                        onMoveUp();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-[#645c50]" />
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
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-[#645c50]" />
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
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#645c50]" />
                      <span>Duplicate Question</span>
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-[#dcd3c4]" />
                      {confirmingDelete ? (
                        <div className="p-2 bg-[#fff8eb] border border-[#f3d9c7] rounded-xl mx-1.5 my-1">
                          <p className="text-[11px] font-bold text-[#c67139] mb-1.5 leading-tight">
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
                              className="flex-1 py-1 px-2 text-[11px] font-bold text-white bg-[#c67139] hover:bg-[#b2622d] rounded-lg transition-colors cursor-pointer text-center"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete(false)}
                              className="flex-1 py-1 px-2 text-[11px] font-semibold text-[#474238] bg-[#eee7db] hover:bg-[#e4dcce] rounded-lg transition-colors cursor-pointer text-center"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingDelete(true)}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-[#c67139] hover:bg-[#ffe1d0]/50 flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#c67139]" />
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
      <div className="p-2.5 sm:px-4 sm:py-2 border-b-2 border-[#201e1d] bg-[#fcfaf6] flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Quick Typography Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="hidden lg:flex items-center gap-1 text-xs font-adminHeading font-bold uppercase tracking-wider text-[#645c50] mr-1 select-none">
            <Sparkles className="w-3.5 h-3.5 text-[#c67139]" />
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
              className="inline-flex items-center justify-center px-2 py-1 bg-white hover:bg-[#eee7db] border border-[#dcd3c4] hover:border-[#201e1d] text-[#201e1d] text-xs font-mono font-bold rounded-lg transition-colors select-none cursor-pointer whitespace-nowrap shadow-xs"
            >
              {tool.label}
            </button>
          ))}

          {/* Clean KaTeX Button */}
          <button
            type="button"
            onClick={handleCleanKaTeX}
            title="Auto-format delimiters and normalize LaTeX math notation (sanitizeKaTeX)"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#eee7db] text-[#201e1d] text-xs font-adminHeading font-bold border-2 border-[#201e1d] rounded-lg transition-colors cursor-pointer select-none shadow-[1px_1px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
          >
            <Wand2 className="w-3.5 h-3.5 text-[#728157]" />
            <span>Clean KaTeX</span>
          </button>

          {/* [+ More Math] Popover Button */}
          <div className="relative" ref={moreMathRef}>
            <button
              type="button"
              onClick={() => setIsMoreMathOpen((prev) => !prev)}
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-[#eee7db] text-[#474238] hover:text-[#201e1d] text-xs font-adminHeading font-bold rounded-lg border border-[#dcd3c4] transition-colors cursor-pointer select-none"
            >
              <span>+ More</span>
              <ChevronDown
                className={cn(
                  'w-3 h-3 text-[#645c50] transition-transform duration-150',
                  isMoreMathOpen && 'rotate-180'
                )}
              />
            </button>

            {isMoreMathOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 p-3 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[4px_4px_0_#201e1d] z-30 animate-in fade-in zoom-in-95 duration-100 font-body">
                <div className="text-[11px] font-adminHeading font-bold text-[#645c50] uppercase tracking-wider mb-2 px-1">
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
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-white hover:bg-[#eee7db] text-[#201e1d] text-xs font-mono font-bold border border-[#dcd3c4] hover:border-[#201e1d] rounded-lg transition-colors cursor-pointer select-none"
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
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0fae1] text-[#3d472b] border border-[#8fa073] font-mono font-bold text-xs rounded-full select-none"
              title="KaTeX syntax is valid and ready for student rendering"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#728157]" />
              <span>KaTeX Valid</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowErrorDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffe1d0] hover:bg-[#fed6bf] text-[#c67139] border border-[#c67139] font-mono font-bold text-xs rounded-full cursor-pointer transition-colors select-none"
              title="Click to view KaTeX syntax errors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#c67139]" />
              <span>KaTeX Syntax Error ({validationResult.errors.length})</span>
            </button>
          )}

          <span className="font-mono text-[11px] text-[#645c50] hidden md:inline ml-1 font-bold">
            {stemMarkdown.length} chars · {wordCount} words
          </span>
        </div>
      </div>

      {/* 3. EXPANDABLE KATEX SYNTAX ERROR BANNER */}
      {(!validationResult.isValid || showErrorDetails) && validationResult.errors.length > 0 && (
        <div className="p-3.5 bg-[#fff8eb] border-b-2 border-[#201e1d] text-[#201e1d] flex items-start gap-3 animate-in fade-in">
          <div className="p-1 rounded-lg bg-[#ffe1d0] border border-[#c67139]/30 shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-[#c67139]" />
          </div>
          <div className="flex-1 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-adminHeading font-bold text-[#c67139] uppercase tracking-wide">
                KaTeX Syntax Verification ({validationResult.errors.length} issue
                {validationResult.errors.length === 1 ? '' : 's'})
              </span>
              <button
                type="button"
                onClick={handleCleanKaTeX}
                className="px-2.5 py-1 rounded-full bg-white border border-[#201e1d] font-adminHeading font-bold text-xs text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer shadow-[1px_1px_0_#201e1d]"
              >
                Auto-Fix Delimiters
              </button>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[#474238] font-mono text-[11px]">
              {validationResult.errors.map((err, idx) => (
                <li key={idx} className="leading-snug">
                  {err}
                </li>
              ))}
            </ul>
            <div className="text-[11px] text-[#645c50] pt-0.5">
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
              <div className="flex items-center justify-between text-xs font-adminHeading font-bold uppercase tracking-wider text-[#645c50] px-1">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-[#c67139]" />
                  Markdown Stem Input
                </span>
                <span className="text-[11px] font-mono text-[#82796a]">
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
                className="w-full min-h-[220px] p-3 text-xs sm:text-sm font-mono text-[#201e1d] bg-white border-2 border-[#201e1d] rounded-xl outline-none focus:border-[#c67139] leading-relaxed transition-all resize-y placeholder:text-[#82796a] shadow-[1.5px_1.5px_0_#201e1d]"
              />
            </div>
          )}

          {/* RIGHT: Live KaTeX Rendered Preview */}
          {(viewMode === 'split' || viewMode === 'preview-only') && (
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between text-xs font-adminHeading font-bold uppercase tracking-wider text-[#645c50] px-1">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#728157]" />
                  KaTeX Live Preview
                </span>
                {validationResult.isValid && stemMarkdown.trim() && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-[#3d472b]">
                    <CheckCircle2 className="w-3 h-3 text-[#728157]" />
                    Verified Output
                  </span>
                )}
              </div>
              <div className="w-full min-h-[220px] p-4 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] leading-relaxed overflow-y-auto flex-1 shadow-[1.5px_1.5px_0_#201e1d]">
                {stemMarkdown.trim() ? (
                  <div className="prose prose-sm max-w-none text-xs sm:text-sm leading-relaxed font-body text-[#201e1d]">
                    <MarkdownErrorBoundary fallbackText={stemMarkdown}>
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#c67139' }]]}
                        components={{
                          p: ({ ...props }) => (
                            <p className="mb-3 last:mb-0 leading-relaxed text-[#201e1d]" {...props} />
                          ),
                          strong: ({ ...props }) => (
                            <strong className="font-bold text-[#201e1d]" {...props} />
                          ),
                          em: ({ ...props }) => <em className="italic" {...props} />,
                          code: ({ ...props }) => (
                            <code
                              className="font-mono text-xs bg-[#eee7db] px-1.5 py-0.5 rounded border border-[#dcd3c4] text-[#201e1d]"
                              {...props}
                            />
                          ),
                        }}
                      >
                        {stemMarkdown}
                      </ReactMarkdown>
                    </MarkdownErrorBoundary>
                  </div>
                ) : (
                  <div className="text-[#82796a] italic text-sm py-12 text-center flex flex-col items-center justify-center gap-2">
                    <Edit3 className="w-6 h-6 text-[#dcd3c4]" />
                    <span>No question stem content entered yet. Start typing in the Markdown editor.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. FOOTER STATUS BAR */}
      <div className="px-4 py-2.5 bg-[#f9f4ed] border-t border-[#dcd3c4] flex flex-wrap items-center justify-between gap-2 text-xs text-[#645c50] select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 font-medium">
            <Info className="w-3.5 h-3.5 text-[#c67139]" />
            Cambridge KaTeX Renderer Active
          </span>
          <span className="hidden sm:inline text-[#dcd3c4]">|</span>
          <span className="font-mono text-[11px] text-[#645c50]">
            Topic: <strong className="text-[#201e1d]">{currentTopicDisplay}</strong>
          </span>
        </div>
        <div className="font-mono text-[11px] text-[#82796a]">
          Tip: Wrap inline math in <code>$formula$</code> &amp; display math in <code>$$formula$$</code>
        </div>
      </div>
    </div>
  );
}

export default IngestionStemEditor;
