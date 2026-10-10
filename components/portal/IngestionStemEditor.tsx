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
  Columns,
  Layers,
  Eye,
  Edit3,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';

export interface IngestionStemEditorProps {
  questionNumber: number;
  stemMarkdown: string;
  citation: string;
  onChangeStem: (newStem: string) => void;
  onChangeCitation: (newCitation: string) => void;
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
        // Avoid duplicate reporting if already flagged by brace balance
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
  badge?: string;
  insert: {
    before: string;
    after?: string;
    defaultContent?: string;
    selectPlaceholder?: boolean;
  };
}

// Required buttons as specified in requirements
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
    id: 'percent',
    label: '\\%',
    tooltip: 'Escaped percentage symbol (\\%)',
    insert: {
      before: '\\%',
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
  {
    id: 'text',
    label: '\\text{...}',
    tooltip: 'Text within math expression (\\text{...})',
    insert: {
      before: '\\text{',
      after: '}',
      defaultContent: 'text',
      selectPlaceholder: true,
    },
  },
  {
    id: 'approx',
    label: '\\approx',
    tooltip: 'Approximately equal (\\approx)',
    insert: {
      before: '\\approx ',
    },
  },
];

// Supplementary math symbols for Cambridge STEM MCQs
const EXTRA_MATH_TOOLS: MathToolbarItem[] = [
  {
    id: 'pm',
    label: '\\pm',
    tooltip: 'Plus-minus (\\pm)',
    insert: { before: '\\pm ' },
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
    id: 'rightarrow',
    label: '\\rightarrow',
    tooltip: 'Arrow (\\rightarrow)',
    insert: { before: '\\rightarrow ' },
  },
  {
    id: 'sqrt',
    label: '\\sqrt{x}',
    tooltip: 'Square root (\\sqrt{x})',
    insert: { before: '\\sqrt{', after: '}', defaultContent: 'x', selectPlaceholder: true },
  },
];

type ViewMode = 'split' | 'stacked' | 'editor' | 'preview';

export function IngestionStemEditor({
  questionNumber,
  stemMarkdown,
  citation,
  onChangeStem,
  onChangeCitation,
  className,
}: IngestionStemEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [showExtraSymbols, setShowExtraSymbols] = useState<boolean>(false);

  // Auto-resizing textarea to accommodate growing stem text smoothly
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.max(160, el.scrollHeight);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [stemMarkdown, adjustHeight]);

  // Insert math snippet at cursor position in the textarea
  const handleInsert = useCallback(
    (tool: MathToolbarItem) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart ?? stemMarkdown.length;
      const end = textarea.selectionEnd ?? stemMarkdown.length;
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

      // Restore focus and precise selection after React applies controlled state
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

  return (
    <div
      className={cn(
        'w-full bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-2 overflow-hidden flex flex-col gap-0 text-[#201e1d]',
        className
      )}
    >
      {/* 1. HEADER: Title + Question Number Badge + Citation Input + View Mode Switcher */}
      <div className="p-4 sm:p-5 border-b-2 border-[#201e1d] bg-neutral-100/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Title & Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-yellow border-2 border-[#201e1d] flex items-center justify-center shadow-offset-2">
              <FileText className="w-4 h-4 text-[#201e1d]" />
            </div>
            <h2 className="font-heading text-lg sm:text-xl tracking-tight text-[#201e1d]">
              Question Stem
            </h2>
          </div>

          {/* Question Number Badge */}
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-yellow text-slate-900 border-2 border-[#201e1d] font-heading text-xs sm:text-sm shadow-offset-2 select-none">
            Q{questionNumber}
          </span>
        </div>

        {/* Right: Cambridge Citation Input & View Modes */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Citation Input Field */}
          <div className="flex items-center gap-2 flex-1 sm:flex-none">
            <label
              htmlFor={`citation-q${questionNumber}`}
              className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1 select-none whitespace-nowrap"
            >
              <Bookmark className="w-3.5 h-3.5 text-accent" />
              <span>Citation:</span>
            </label>
            <input
              id={`citation-q${questionNumber}`}
              type="text"
              value={citation}
              onChange={(e) => onChangeCitation(e.target.value)}
              placeholder="e.g. 0455/12/M/J/23 Q4"
              className="w-full sm:w-56 px-3 py-1.5 text-xs sm:text-sm font-mono bg-white text-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all placeholder:text-neutral-400"
            />
          </div>

          {/* View Mode Segmented Controls */}
          <div className="inline-flex items-center bg-neutral-200 p-1 rounded-xl border-2 border-[#201e1d] select-none">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              title="Split View (Side-by-side / Stacked)"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'split'
                  ? 'bg-white text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Split</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('stacked')}
              title="Stacked View (Editor over Live Preview)"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'stacked'
                  ? 'bg-white text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Stacked</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('editor')}
              title="Editor Only"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'editor'
                  ? 'bg-white text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('preview')}
              title="Preview Only"
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer',
                viewMode === 'preview'
                  ? 'bg-white text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              )}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MATHEMATICAL FORMULA INSERTION TOOLBAR */}
      <div className="p-3 sm:px-5 sm:py-3 border-b-2 border-[#201e1d] bg-neutral-50/90 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Section Title */}
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#645c50]">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Math & KaTeX Toolbar</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Clean / Sanitize Math button */}
            <button
              type="button"
              onClick={handleAutoSanitize}
              title="Auto-format LaTeX delimiters ($ / $$) and escape currency dollar signs"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-neutral-100 text-[#201e1d] text-xs font-bold border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer select-none"
            >
              <Wand2 className="w-3 h-3 text-accent" />
              <span>Clean Math</span>
            </button>

            {/* Extra symbols toggle */}
            <button
              type="button"
              onClick={() => setShowExtraSymbols((prev) => !prev)}
              className="text-xs font-bold text-accent hover:underline cursor-pointer select-none"
            >
              {showExtraSymbols ? 'Fewer Symbols' : '+ More Symbols'}
            </button>
          </div>
        </div>

        {/* Primary Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PRIMARY_MATH_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              title={tool.tooltip}
              onMouseDown={(e) => {
                // Prevent button click from causing textarea to lose selection
                e.preventDefault();
              }}
              onClick={() => handleInsert(tool)}
              className="inline-flex items-center justify-center px-2.5 py-1.5 bg-white hover:bg-neutral-100 active:bg-neutral-200 text-[#201e1d] text-xs font-mono font-bold border-2 border-[#201e1d] rounded-lg shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all select-none cursor-pointer whitespace-nowrap"
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Supplementary Symbols (Collapsible) */}
        {showExtraSymbols && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-neutral-200 animate-in fade-in duration-150">
            <span className="text-[11px] font-bold text-[#82796a] uppercase mr-1">Extra:</span>
            {EXTRA_MATH_TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                title={tool.tooltip}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(tool)}
                className="inline-flex items-center justify-center px-2 py-1 bg-white hover:bg-neutral-100 text-[#201e1d] text-xs font-mono font-medium border-2 border-[#201e1d] rounded-md shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all select-none cursor-pointer"
              >
                {tool.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. MAIN WORKSPACE AREA: Controlled by View Mode */}
      <div className="p-4 sm:p-5 flex flex-col gap-5">
        {/* Helper Notification for KaTeX Syntax Issues */}
        {katexErrors.length > 0 && (
          <div className="p-3.5 bg-amber-50 border-2 border-[#201e1d] text-[#201e1d] rounded-xl shadow-offset-2 flex items-start gap-3 animate-in fade-in">
            <div className="p-1 rounded-lg bg-brand-amber/20 border border-brand-amber">
              <AlertTriangle className="w-4 h-4 text-brand-amber" />
            </div>
            <div className="flex-1 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 uppercase tracking-wide">
                  KaTeX Syntax Helper ({katexErrors.length}{' '}
                  {katexErrors.length === 1 ? 'Notice' : 'Notices'})
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">Live Check</span>
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
                💡 Tip: If writing a currency value (e.g. $50), escape it with a backslash: <code>\$50</code>, or click <strong>Clean Math</strong> above.
              </div>
            </div>
          </div>
        )}

        {/* View Layouts */}
        {/* A. SPLIT VIEW: Side-by-side on lg screens, stacked on smaller screens */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* Textarea Column */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
                <span>Markdown Editor</span>
                <span className="font-mono text-[11px] text-neutral-500 font-normal">
                  {stemMarkdown.length} chars | {wordCount} words
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={stemMarkdown}
                onChange={(e) => {
                  onChangeStem(e.target.value);
                  adjustHeight();
                }}
                placeholder="Enter question stem in Markdown. Use $...$ for inline math and $$...$$ for display formulas..."
                className="w-full min-h-[180px] p-4 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] font-mono text-sm leading-relaxed shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all resize-y placeholder:text-neutral-400"
              />
            </div>

            {/* Live Preview Column */}
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
              <div className="w-full min-h-[180px] p-4 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] text-[#201e1d] shadow-offset-2 overflow-y-auto">
                {stemMarkdown.trim() ? (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
                      components={{
                        p: ({ ...props }) => <p className="mb-3 last:mb-0 leading-relaxed text-[#201e1d]" {...props} />,
                        strong: ({ ...props }) => <strong className="font-bold text-[#201e1d]" {...props} />,
                        em: ({ ...props }) => <em className="italic" {...props} />,
                        code: ({ ...props }) => (
                          <code className="font-mono text-xs bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-300" {...props} />
                        ),
                      }}
                    >
                      {stemMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-neutral-400 italic text-sm py-4 text-center">
                    Rendered stem with KaTeX equations will appear live here...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* B. STACKED VIEW: Editor on top, Live Preview right beneath */}
        {viewMode === 'stacked' && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
                <span>Markdown Editor</span>
                <span className="font-mono text-[11px] text-neutral-500 font-normal">
                  {stemMarkdown.length} chars | {wordCount} words
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={stemMarkdown}
                onChange={(e) => {
                  onChangeStem(e.target.value);
                  adjustHeight();
                }}
                placeholder="Enter question stem in Markdown..."
                className="w-full min-h-[160px] p-4 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] font-mono text-sm leading-relaxed shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all resize-y placeholder:text-neutral-400"
              />
            </div>

            {/* Preview Box Right Beneath */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-accent" />
                  Live KaTeX Preview (Below Editor)
                </span>
                {katexErrors.length === 0 && mathFormulaCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 rounded-md font-sans text-[11px] font-bold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    KaTeX Valid ({mathFormulaCount})
                  </span>
                )}
              </div>
              <div className="w-full min-h-[140px] p-4 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] text-[#201e1d] shadow-offset-2 overflow-y-auto">
                {stemMarkdown.trim() ? (
                  <div className="prose prose-sm max-w-none text-sm leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
                      components={{
                        p: ({ ...props }) => <p className="mb-3 last:mb-0 leading-relaxed text-[#201e1d]" {...props} />,
                        strong: ({ ...props }) => <strong className="font-bold text-[#201e1d]" {...props} />,
                        em: ({ ...props }) => <em className="italic" {...props} />,
                        code: ({ ...props }) => (
                          <code className="font-mono text-xs bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-300" {...props} />
                        ),
                      }}
                    >
                      {stemMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-neutral-400 italic text-sm py-4 text-center">
                    Rendered stem with KaTeX equations will appear live here...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* C. EDITOR ONLY */}
        {viewMode === 'editor' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
              <span>Markdown Editor (Full Focus)</span>
              <span className="font-mono text-[11px] text-neutral-500 font-normal">
                {stemMarkdown.length} chars | {wordCount} words
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={stemMarkdown}
              onChange={(e) => {
                onChangeStem(e.target.value);
                adjustHeight();
              }}
              placeholder="Enter question stem in Markdown..."
              className="w-full min-h-[260px] p-4 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] font-mono text-sm leading-relaxed shadow-offset-2 outline-none focus:ring-2 focus:ring-accent transition-all resize-y placeholder:text-neutral-400"
            />
          </div>
        )}

        {/* D. PREVIEW ONLY */}
        {viewMode === 'preview' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#645c50]">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-accent" />
                Live KaTeX Preview (Full)
              </span>
              {katexErrors.length === 0 && mathFormulaCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border-2 border-emerald-500 rounded-lg font-sans text-xs font-bold shadow-offset-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  All Formulas Valid ({mathFormulaCount})
                </span>
              )}
            </div>
            <div className="w-full min-h-[260px] p-6 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] text-[#201e1d] shadow-offset-2 overflow-y-auto">
              {stemMarkdown.trim() ? (
                <div className="prose max-w-none text-base leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#dc2626' }]]}
                    components={{
                      p: ({ ...props }) => <p className="mb-4 last:mb-0 leading-relaxed text-[#201e1d]" {...props} />,
                      strong: ({ ...props }) => <strong className="font-bold text-[#201e1d]" {...props} />,
                      em: ({ ...props }) => <em className="italic" {...props} />,
                      code: ({ ...props }) => (
                        <code className="font-mono text-xs bg-neutral-200 px-1.5 py-0.5 rounded border border-neutral-300" {...props} />
                      ),
                    }}
                  >
                    {stemMarkdown}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-neutral-400 italic text-base py-8 text-center">
                  No question stem content entered yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 4. FOOTER STATUS BAR */}
      <div className="px-4 py-2.5 bg-neutral-100 border-t-2 border-[#201e1d] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#645c50]">
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
