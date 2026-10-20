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
  variant?: 'neobrutalist' | 'printable' | 'plain';
  components?: Record<string, any>;
}

export function RichMarkdown({
  content,
  className,
  variant = 'neobrutalist',
  components,
}: RichMarkdownProps): React.ReactElement {
  const sanitizedContent = escapeCurrencyDollars(content || '');

  let tableComponents: Record<string, any> | undefined;
  if (variant === 'neobrutalist') {
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
