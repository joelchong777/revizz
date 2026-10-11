'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import katex from 'katex';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';

export interface IngestionStemEditorProps {
  questionNumber: number;
  stemMarkdown: string;
  citation: string;
  onChangeStem: (newStem: string) => void;
  onChangeCitation: (newCitation: string) => void;
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
  if (!text) return [];
  const errors: KatexSyntaxIssue[] = [];

  // Strip code blocks to avoid false positives inside code fences
  const stripped = text.replace(/```[\s\S]*?```|`[^`]*`/g, '');
  // Ignore escaped currency dollars
  const noEscapedDollars = stripped.replace(/\\\$/g, '');

  // 1. Check display math delimiters ($$)
  const displayDollarMatches = noEscapedDollars.match(/\$\$/g);
  if (displayDollarMatches && displayDollarMatches.length % 2 !== 0) {
    errors.push({
      type: 'unclosed-delimiter',
      message: 'Unclosed display math block ($$): Missing closing "$$" delimiter.',
    });
  }

  // 2. Check inline math delimiters ($)
  // Remove matched $$...$$ to isolate single $
  const withoutDisplay = noEscapedDollars.replace(/\$\$[\s\S]*?\$\$/g, '');
  const inlineDollarMatches = withoutDisplay.match(/\$/g);
  if (inlineDollarMatches && inlineDollarMatches.length % 2 !== 0) {
    errors.push({
      type: 'unclosed-delimiter',
      message:
        'Unclosed inline math delimiter ($): Found an unpaired single "$" delimiter. (Tip: Use "\\$" for dollar amounts)',
    });
  }

  // 3. Test display math blocks with katex.renderToString
  const displayRegex = /\$\$([\s\S]*?)\$\$/g;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = displayRegex.exec(stripped)) !== null) {
    const expr = dMatch[1].trim();
    if (expr) {
      // Check curly brace balance inside the block
      const openBraces = (expr.match(/(?<!\\)\{/g) || []).length;
      const closeBraces = (expr.match(/(?<!\\)\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          type: 'unclosed-bracket',
          message: `Mismatched curly braces: Found ${openBraces} "{" and ${closeBraces} "}".`,
          snippet: `$$${expr.length > 35 ? expr.slice(0, 32) + '...' : expr}$$`,
        });
      }

      try {
        katex.renderToString(expr, { displayMode: true, throwOnError: true });
      } catch (err: unknown) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        const cleanMsg = rawMsg.replace(/^KaTeX parse error:\s*/, '');
        if (!errors.some((e) => e.snippet?.includes(expr.slice(0, 20)))) {
          errors.push({
            type: 'syntax-error',
            message: cleanMsg,
            snippet: `$$${expr.length > 35 ? expr.slice(0, 32) + '...' : expr}$$`,
          });
        }
      }
    }
  }

  // 4. Test inline math blocks with katex.renderToString
  const inlineRegex = /(?<!\$)\$(?!\$)(.*?)(?<!\$)\$(?!\$)/g;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = inlineRegex.exec(withoutDisplay)) !== null) {
    const expr = iMatch[1].trim();
    if (expr) {
      // Check curly brace balance
      const openBraces = (expr.match(/(?<!\\)\{/g) || []).length;
      const closeBraces = (expr.match(/(?<!\\)\}/g) || []).length;
      if (openBraces !== closeBraces) {
        errors.push({
          type: 'unclosed-bracket',
          message: `Mismatched curly braces: Found ${openBraces} "{" and ${closeBraces} "}".`,
          snippet: `$${expr.length > 25 ? expr.slice(0, 22) + '...' : expr}$`,
        });
      }

      try {
        katex.renderToString(expr, { displayMode: false, throwOnError: true });
      } catch (err: unknown) {
        const rawMsg = err instanceof Error ? err.message : String(err);
        const cleanMsg = rawMsg.replace(/^KaTeX parse error:\s*/, '');
        if (!errors.some((e) => e.snippet?.includes(expr.slice(0, 20)))) {
          errors.push({
            type: 'syntax-error',
            message: cleanMsg,
            snippet: `$${expr.length > 25 ? expr.slice(0, 22) + '...' : expr}$`,
          });
        }
      }
    }
  }

  return errors;
}

interface MathToolbarItem {
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

// Sleek primary math tools (the 5 most common math tokens)
const PRIMARY_MATH_TOOLS: MathToolbarItem[] = [
  {
    id: 'inline',
    label: '$x$',
    tooltip: 'Inline math formula ($x$)',
    insert: {
      before: '$',
      after: '$',
      defaultContent: 'x',
      selectPlaceholder: true,
    },
  },
  {
    id: 'display',
    label: '$$\\dots$$',
    tooltip: 'Display math block ($$\\dots$$)',
    insert: {
      before: '$$\n',
      after: '\n$$',
      defaultContent: '\\dots',
      selectPlaceholder: true,
    },
  },
  {
    id: 'fraction',
    label: '\\frac{a}{b}',
    tooltip: 'Fraction (\\frac{a}{b})',
    insert: {
      before: '\\frac{',
      after: '}{b}',
      defaultContent: 'a',
      selectPlaceholder: true,
    },
  },
  {
    id: 'times',
    label: '\\times',
    tooltip: 'Multiplication symbol (\\times)',
    insert: {
      before: '\\times ',
    },
  },
  {
    id: 'delta',
    label: '\\Delta',
    tooltip: 'Delta symbol (\\Delta)',
    insert: {
      before: '\\Delta ',
    },
  },
];

// Extended math symbols available in [+ More Math] popover
const EXTENDED_MATH_TOOLS: MathToolbarItem[] = [
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
    id: 'le',
    label: '\\le',
    tooltip: 'Less than or equal (\\le)',
    insert: { before: '\\le ' },
  },
  {
    id: 'ge',
    label: '\\ge',
    tooltip: 'Greater than or equal (\\ge)',
    insert: { before: '\\ge ' },
  },
  {
    id: 'pm',
    label: '\\pm',
    tooltip: 'Plus-minus (\\pm)',
    insert: { before: '\\pm ' },
  },
  {
    id: 'superscript',
    label: 'x^2',
    tooltip: 'Power / Superscript (x^2)',
    insert: { before: '^{', after: '}', defaultContent: '2', selectPlaceholder: true },
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
    id: 'rightarrow',
    label: '\\rightarrow',
    tooltip: 'Arrow (\\rightarrow)',
    insert: { before: '\\rightarrow ' },
  },
  {
    id: 'text',
    label: '\\text{...}',
    tooltip: 'Text inside math (\\text{...})',
    insert: { before: '\\text{', after: '}', defaultContent: 'text', selectPlaceholder: true },
  },
  {
    id: 'neq',
    label: '\\neq',
    tooltip: 'Not equal (\\neq)',
    insert: { before: '\\neq ' },
  },
  {
    id: 'pi',
    label: '\\pi',
    tooltip: 'Pi constant (\\pi)',
    insert: { before: '\\pi ' },
  },
  {
    id: 'theta',
    label: '\\theta',
    tooltip: 'Theta angle (\\theta)',
    insert: { before: '\\theta ' },
  },
];

type TabMode = 'write' | 'preview';

export function IngestionStemEditor({
  questionNumber,
  stemMarkdown,
  citation,
  onChangeStem,
  onChangeCitation,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  className,
}: IngestionStemEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const moreMathRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<TabMode>('write');
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isMoreMathOpen, setIsMoreMathOpen] = useState(false);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        actionMenuRef.current &&
        !actionMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionMenuOpen(false);
        setConfirmingDelete(false);
      }
      if (
        moreMathRef.current &&
        !moreMathRef.current.contains(event.target as Node)
      ) {
        setIsMoreMathOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-resizing textarea to accommodate content smoothly
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.max(180, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    if (activeTab === 'write') {
      adjustHeight();
    }
  }, [stemMarkdown, activeTab, adjustHeight]);

  // Insert math snippet at cursor position in the textarea
  const handleInsert = useCallback(
    (tool: MathToolbarItem) => {
      // If we are currently in preview tab, switch to write tab first
      if (activeTab !== 'write') {
        setActiveTab('write');
      }

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

      // Restore focus and selection after React updates controlled state
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(targetStart, targetEnd);
          adjustHeight();
        }
      }, 0);
    },
    [stemMarkdown, onChangeStem, adjustHeight, activeTab]
  );

  // Auto-sanitize math button
  const handleAutoSanitize = useCallback(() => {
    if (!stemMarkdown) return;
    const sanitized = sanitizeKaTeX(stemMarkdown);
    if (sanitized !== stemMarkdown) {
      onChangeStem(sanitized);
    }
  }, [stemMarkdown, onChangeStem]);

  // KaTeX syntax error detection
  const katexErrors = useMemo(() => {
    return detectKatexErrors(stemMarkdown);
  }, [stemMarkdown]);

  // Formula count for validation feedback
  const mathFormulaCount = useMemo(() => {
    if (!stemMarkdown) return 0;
    const inline = (stemMarkdown.match(/(?<!\$)\$(?!\$)[^$\n]+(?<!\$)\$(?!\$)/g) || []).length;
    const display = (stemMarkdown.match(/\$\$[\s\S]*?\$\$/g) || []).length;
    return inline + display;
  }, [stemMarkdown]);

  // Character and word metrics
  const wordCount = useMemo(() => {
    const trimmed = stemMarkdown.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [stemMarkdown]);

  const hasActionProps = Boolean(onMoveUp || onMoveDown || onDuplicate || onDelete);

  return (
    <div
      className={cn(
        'w-full bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-2 overflow-hidden flex flex-col gap-0 text-[#201e1d]',
        className
      )}
    >
      {/* 1. HEADER BAR */}
      <div className="p-3.5 sm:p-4 border-b-2 border-[#201e1d] bg-neutral-100/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Question Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-yellow border-2 border-[#201e1d] flex items-center justify-center shadow-offset-2 shrink-0">
            <FileText className="w-4 h-4 text-[#201e1d]" />
          </div>
          <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-brand-yellow text-slate-900 border-2 border-[#201e1d] font-heading font-black text-xs sm:text-sm shadow-offset-2 select-none tracking-tight">
            Question {questionNumber}
          </span>
        </div>

        {/* Center / Right: Citation Input, Tabs, and Action Overflow Menu */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Sleek Cambridge Citation Input */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-none">
            <label
              htmlFor={`citation-q${questionNumber}`}
              className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1 select-none whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 text-accent" />
              <span className="hidden sm:inline">Citation:</span>
            </label>
            <input
              id={`citation-q${questionNumber}`}
              type="text"
              value={citation}
              onChange={(e) => onChangeCitation(e.target.value)}
              placeholder="e.g. 0455/12/M/J/23 Q4"
              className="w-full sm:w-48 lg:w-56 px-3 py-1.5 text-xs sm:text-sm font-mono bg-white text-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-neutral-400"
            />
          </div>

          {/* Simple [Write] and [Preview] Tabs */}
          <div className="inline-flex items-center bg-neutral-200/90 p-1 rounded-xl border-2 border-[#201e1d] select-none shadow-offset-2">
            <button
              type="button"
              onClick={() => setActiveTab('write')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                activeTab === 'write'
                  ? 'bg-brand-yellow text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Write</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1.5 cursor-pointer',
                activeTab === 'preview'
                  ? 'bg-brand-yellow text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
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
                className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white hover:bg-neutral-100 text-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1 select-none"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {isActionMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100">
                  {onMoveUp && (
                    <button
                      type="button"
                      onClick={() => {
                        onMoveUp();
                        setIsActionMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-neutral-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-neutral-600" />
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
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-neutral-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-neutral-600" />
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
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-neutral-100 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-neutral-600" />
                      <span>Duplicate Question</span>
                    </button>
                  )}

                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-neutral-200" />
                      {confirmingDelete ? (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg mx-1.5 my-1">
                          <p className="text-[11px] font-bold text-rose-800 mb-1.5 leading-tight">
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
                              className="flex-1 py-1 px-2 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors cursor-pointer text-center"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingDelete(false)}
                              className="flex-1 py-1 px-2 text-[11px] font-semibold text-neutral-700 bg-neutral-200 hover:bg-neutral-300 rounded-md transition-colors cursor-pointer text-center"
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

      {/* 2. MATH TOOLBAR (Sleek, low visual noise) */}
      <div className="p-2.5 sm:px-4 sm:py-2.5 border-b-2 border-[#201e1d] bg-neutral-50/90 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Common Math Tokens + [+ More Math] Popover */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#645c50] mr-1">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Math:</span>
          </div>

          {/* 5 Primary Math Tokens */}
          {PRIMARY_MATH_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.tooltip}
              onMouseDown={(e) => {
                // Prevent button click from blurring the textarea
                e.preventDefault();
              }}
              onClick={() => handleInsert(tool)}
              className="inline-flex items-center justify-center px-2.5 py-1 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-[#201e1d] text-xs font-mono font-bold border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all select-none cursor-pointer whitespace-nowrap"
            >
              {tool.label}
            </button>
          ))}

          {/* [+ More Math] Popover Button */}
          <div className="relative" ref={moreMathRef}>
            <button
              type="button"
              onClick={() => setIsMoreMathOpen((prev) => !prev)}
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-[#201e1d] text-xs font-bold border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer select-none"
            >
              <span>+ More Math</span>
              <ChevronDown
                className={cn('w-3 h-3 text-[#645c50] transition-transform duration-150', isMoreMathOpen && 'rotate-180')}
              />
            </button>

            {isMoreMathOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 p-2.5 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 z-30 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-bold text-[#645c50] uppercase tracking-wider mb-2 px-1">
                  Extended Mathematical Symbols
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
                      className="inline-flex items-center justify-center px-2 py-1.5 bg-neutral-50 hover:bg-brand-yellow/30 text-[#201e1d] text-xs font-mono font-bold border border-[#201e1d] rounded-md transition-colors cursor-pointer select-none"
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Clean Math Sanitizer + Counters */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoSanitize}
            title="Auto-format LaTeX delimiters ($ / $$) and escape currency dollar signs"
            className="inline-flex items-center gap-1 px-2 py-1 bg-white hover:bg-neutral-100 text-[#201e1d] text-xs font-bold border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer select-none"
          >
            <Wand2 className="w-3 h-3 text-accent" />
            <span className="hidden sm:inline">Clean Math</span>
          </button>

          <span className="font-mono text-[11px] text-[#645c50] hidden md:inline">
            {stemMarkdown.length} chars | {wordCount} words
          </span>
        </div>
      </div>

      {/* 3. WORKSPACE AREA: Controlled by [Write] / [Preview] Tabs */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Live KaTeX Syntax Alert Helper */}
        {katexErrors.length > 0 && (
          <div className="p-3 bg-amber-50 border-2 border-[#201e1d] text-[#201e1d] rounded-xl shadow-offset-2 flex items-start gap-2.5 animate-in fade-in">
            <div className="p-1 rounded-lg bg-brand-amber/20 border border-brand-amber shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-brand-amber" />
            </div>
            <div className="flex-1 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 uppercase tracking-wide">
                  KaTeX Syntax Check ({katexErrors.length}{' '}
                  {katexErrors.length === 1 ? 'Notice' : 'Notices'})
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">Live</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-neutral-800">
                {katexErrors.map((err, idx) => (
                  <li key={idx} className="leading-snug">
                    <span className="font-semibold">{err.message}</span>
                    {err.snippet && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100/90 rounded font-mono text-[11px] border border-amber-300">
                        {err.snippet}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="text-[11px] text-neutral-600 pt-0.5">
                💡 Tip: For prices/currencies (e.g. $50), escape with a backslash: <code>\$50</code>, or click <strong>Clean Math</strong>.
              </div>
            </div>
          </div>
        )}

        {/* WRITE TAB: Expandable monospace textarea */}
        {activeTab === 'write' && (
          <div className="flex flex-col gap-2">
            <textarea
              ref={textareaRef}
              value={stemMarkdown}
              onChange={(e) => {
                onChangeStem(e.target.value);
                adjustHeight();
              }}
              placeholder="Enter question stem in Markdown. Use $...$ for inline math and $$...$$ for display equations..."
              className="w-full min-h-[180px] p-4 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] font-mono text-sm leading-relaxed shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all resize-y placeholder:text-neutral-400"
            />
          </div>
        )}

        {/* PREVIEW TAB: Live KaTeX Preview */}
        {activeTab === 'preview' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-accent" />
                Live KaTeX Preview
              </span>
              {katexErrors.length === 0 && mathFormulaCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 rounded-md font-sans text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  KaTeX Valid ({mathFormulaCount})
                </span>
              )}
            </div>

            <div className="w-full min-h-[200px] p-5 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] text-[#201e1d] shadow-offset-2 overflow-y-auto">
              {stemMarkdown.trim() ? (
                <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
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
                          className="font-mono text-xs bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-300"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {stemMarkdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-neutral-400 italic text-sm py-8 text-center">
                  No stem text entered yet. Switch to the <strong>Write</strong> tab to enter content.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div className="px-4 py-2 bg-neutral-100 border-t-2 border-[#201e1d] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#645c50]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Info className="w-3 h-3 text-accent" />
            Markdown & KaTeX enabled
          </span>
          {mathFormulaCount > 0 && (
            <span className="font-mono">
              Math formulas: <strong>{mathFormulaCount}</strong>
            </span>
          )}
        </div>
        <div className="font-mono text-neutral-500">
          Tip: Wrap inline math in <code>$formula$</code> & display math in <code>$$formula$$</code>
        </div>
      </div>
    </div>
  );
}
