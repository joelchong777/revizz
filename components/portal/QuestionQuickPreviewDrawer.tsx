'use client';

import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export interface QuestionQuickPreviewDrawerProps {
  question: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditor: (id: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
}

export default function QuestionQuickPreviewDrawer({
  question,
  isOpen,
  onClose,
  onOpenEditor,
  onPrevious,
  onNext,
  hasNext,
  hasPrevious,
}: QuestionQuickPreviewDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPrevious, onNext, hasPrevious, hasNext]);

  if (!isOpen || !question) return null;

  const cite = question.citation || '0455/12 M/J/24 Q1';
  const topic = question.topic || 'Economics';
  const rawDiagramUrl = question.image_url || question.diagram?.image_url;
  const diagramUrl = question.has_diagram === false ? undefined : rawDiagramUrl;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl h-full bg-amber-50 border-l-4 border-slate-800 shadow-[-8px_0_0_0_rgba(30,41,59,0.1)] flex flex-col transform transition-transform duration-300">
        
        {/* Header */}
        <div className="flex-none p-4 sm:p-6 border-b-4 border-slate-800 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-500">{question.id}</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-white text-xs font-bold tracking-wider">{cite}</span>
                <span className="px-2 py-0.5 rounded-full border-2 border-slate-800 bg-teal-100 text-teal-900 text-xs font-bold">{topic}</span>
                <span className="px-2 py-0.5 rounded-full border-2 border-slate-800 bg-emerald-100 text-emerald-900 text-xs font-bold tracking-wide">Live</span>
                <span className="px-2 py-0.5 rounded-full border-2 border-slate-800 bg-amber-100 text-amber-900 text-xs font-bold">Medium</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onClose(); onOpenEditor(question.id); }}
                className="px-4 py-2 rounded-xl bg-brand-yellow border-2 border-b-4 border-slate-800 text-slate-800 text-sm font-bold shadow-chunky hover:bg-yellow-300 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all whitespace-nowrap"
              >
                Open in Full Editor
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border-2 border-b-4 border-slate-800 text-slate-800 text-lg font-bold shadow-chunky hover:bg-slate-50 active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 text-slate-800">
          
          <div className="p-5 rounded-2xl bg-white border-2 border-slate-800 shadow-chunky-lg text-lg font-semibold leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {question.stem_markdown || ''}
            </ReactMarkdown>
            
            {diagramUrl && (
              <div className="mt-4 rounded-xl border-2 border-slate-800 p-2 overflow-hidden flex justify-center bg-slate-50">
                <img src={diagramUrl} alt="Question diagram" className="max-h-64 object-contain" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {question.options?.map((opt: any, i: number) => {
              const letters = ['A', 'B', 'C', 'D'];
              const isCorrect = opt.id === question.correct_option_id;
              
              return (
                <div key={opt.id} className={`flex flex-col p-3 rounded-2xl border-2 border-b-4 border-slate-800 shadow-chunky ${isCorrect ? 'bg-[#f0fae1] border-emerald-600' : 'bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex-none flex items-center justify-center font-bold border-2 border-slate-800 ${isCorrect ? 'bg-brand-green text-emerald-950' : 'bg-slate-100 text-slate-800'}`}>
                      {letters[i]}
                    </div>
                    <div className="flex-1 text-base font-bold mt-1">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt.text_markdown || ''}
                      </ReactMarkdown>
                    </div>
                    {isCorrect && (
                      <div className="flex-none px-2 py-1 rounded-lg bg-brand-green border-2 border-emerald-700 text-emerald-950 text-xs font-bold flex items-center gap-1">
                        ✓ Correct
                      </div>
                    )}
                  </div>
                  {!isCorrect && (
                    <div className="mt-2 ml-11 text-sm font-medium text-slate-600 bg-slate-50 p-2 rounded-lg border-2 border-slate-200 border-dashed">
                      <span className="font-bold text-slate-700">Why it's a distractor:</span> A common misconception.
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-slate-800 shadow-chunky flex flex-col gap-2">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Explanation</h3>
            <p className="text-sm font-semibold text-slate-700 leading-relaxed">
              Step-by-step reasoning for this question would go here. Scarcity exists because economic resources are finite, while human wants are infinite.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border-2 border-slate-800 shadow-chunky flex flex-col gap-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Metadata & Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Syllabus</p>
                <p className="text-sm font-bold">0455 Economics</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Topic</p>
                <p className="text-sm font-bold">{topic}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">1st-Try Accuracy</p>
                <p className="text-sm font-bold">64%</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase">Paper & Session</p>
                <p className="text-sm font-bold">{cite}</p>
              </div>
            </div>
          </div>
          
        </div>

        {/* Footer Navigation */}
        <div className="flex-none p-4 border-t-4 border-slate-800 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className={`px-4 py-2 rounded-xl font-bold border-2 border-b-4 border-slate-800 shadow-chunky transition-all flex items-center gap-2 ${hasPrevious ? 'bg-white hover:bg-slate-100 active:translate-y-0.5 active:border-b-2 active:shadow-none text-slate-800' : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'}`}
          >
            <span>←</span> Previous
          </button>
          
          <span className="text-xs font-bold text-slate-500">Use ← → arrow keys</span>
          
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className={`px-4 py-2 rounded-xl font-bold border-2 border-b-4 border-slate-800 shadow-chunky transition-all flex items-center gap-2 ${hasNext ? 'bg-white hover:bg-slate-100 active:translate-y-0.5 active:border-b-2 active:shadow-none text-slate-800' : 'bg-slate-200 text-slate-400 opacity-50 cursor-not-allowed'}`}
          >
            Next <span>→</span>
          </button>
        </div>

      </div>
    </div>
  );
}
