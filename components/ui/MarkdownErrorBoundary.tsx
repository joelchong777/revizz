'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackText?: string;
  className?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * MarkdownErrorBoundary:
 * Defensive boundary that catches KaTeX syntax failures or malformed markdown parsing
 * exceptions in dynamic content (e.g. question stems, option labels, derivations).
 * Prevents child math parsing crashes from unmounting the parent quiz card or action rails.
 */
export class MarkdownErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('MarkdownErrorBoundary caught dynamic rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={`p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-mono break-words ${
            this.props.className || ''
          }`}
          role="alert"
          aria-live="polite"
        >
          <div className="font-bold flex items-center gap-1.5 mb-1 text-[11px] text-amber-800">
            <span>⚠️</span> Formula / Markdown Fallback
          </div>
          <p className="whitespace-pre-wrap">{this.props.fallbackText || 'Formula display unavailable'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MarkdownErrorBoundary;
