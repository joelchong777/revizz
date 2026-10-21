'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';
import { escapeCurrencyDollars } from '@/lib/ingestion/katexSanitizer';
import { AutoFitTable } from '@/components/ui/AutoFitTable';

export const cambridgeTableComponents = {
  table: ({ node, ...props }: any) => (
    <AutoFitTable>
      <table className="w-fit max-w-full text-xs sm:text-sm border-collapse border border-neutral-900 bg-white" {...props} />
    </AutoFitTable>
  ),
  thead: ({ node, ...props }: any) => (
    <thead className="bg-neutral-50/80 border-b border-neutral-900 font-semibold text-neutral-900" {...props} />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody className="divide-y divide-neutral-900 text-neutral-900" {...props} />
  ),
  tr: ({ node, ...props }: any) => (
    <tr className="hover:bg-neutral-50/50 transition-colors" {...props} />
  ),
  th: ({ node, ...props }: any) => (
    <th className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-neutral-900 border-r border-neutral-900 last:border-r-0 text-center break-words" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-normal text-neutral-900 border-r border-neutral-900 last:border-r-0 text-center break-words" {...props} />
  ),
  img: ({ node, ...props }: any) => (
    <img className="max-w-full h-auto object-contain mx-auto rounded-lg my-2" {...props} />
  ),
};

export const neobrutalistTableComponents = {
  table: ({ node, ...props }: any) => (
    <div className="my-3 overflow-x-auto rounded-xl border-2 border-text bg-white shadow-offset-2">
      <table className="w-full text-sm border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead className="bg-accent-2-100 border-b-2 border-text font-bold text-text" {...props} />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody className="divide-y-2 divide-neutral-200" {...props} />
  ),
  tr: ({ node, ...props }: any) => (
    <tr className="hover:bg-neutral-50/80 transition-colors" {...props} />
  ),
  th: ({ node, ...props }: any) => (
    <th className="px-3.5 py-2 font-heading text-xs tracking-wider font-bold text-text border-r-2 last:border-r-0 border-text/20" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="px-3.5 py-2 font-medium text-text border-r-2 last:border-r-0 border-neutral-200" {...props} />
  ),
};

export const printableTableComponents = {
  table: ({ node, ...props }: any) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-sm border-collapse border-2 border-black" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead className="border-b-2 border-black font-bold text-black" {...props} />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody className="divide-y divide-black" {...props} />
  ),
  tr: ({ node, ...props }: any) => (
    <tr {...props} />
  ),
  th: ({ node, ...props }: any) => (
    <th className="px-3 py-1.5 text-xs sm:text-sm font-bold border-r border-black last:border-r-0 text-black" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="px-3 py-1.5 text-xs sm:text-sm border-r border-black last:border-r-0 text-black" {...props} />
  ),
};

export interface RichMarkdownProps {
  content: string;
  className?: string;
  variant?: 'cambridge' | 'neobrutalist' | 'printable' | 'plain';
  components?: Record<string, any>;
}

export function RichMarkdown({
  content,
  className,
  variant = 'cambridge',
  components,
}: RichMarkdownProps): React.ReactElement {
  const sanitizedContent = escapeCurrencyDollars(content || '');

  let tableComponents: Record<string, any> | undefined;
  if (variant === 'cambridge') {
    tableComponents = cambridgeTableComponents;
  } else if (variant === 'neobrutalist') {
    tableComponents = neobrutalistTableComponents;
  } else if (variant === 'printable') {
    tableComponents = printableTableComponents;
  } else if (variant === 'plain') {
    tableComponents = undefined;
  }

  const mergedComponents =
    tableComponents || components
      ? { ...(tableComponents || {}), ...(components || {}) }
      : undefined;

  return (
    <MarkdownErrorBoundary fallbackText={content}>
      <ReactMarkdown
        className={className}
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={mergedComponents}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}

export default RichMarkdown;
