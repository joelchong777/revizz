'use client';

import React from 'react';
import { Image as ImageIcon, Table as TableIcon } from 'lucide-react';
import type { StagingQuestion } from '@/types/ingestion';
import { hasDiagram } from '@/lib/paperViewer';

export interface PaperTableViewProps {
  questions: StagingQuestion[];
  totalQuestions: number;
  showAnswers: boolean;
  onView: (questionNumber: number) => void;
}

export function PaperTableView({ questions, totalQuestions, showAnswers, onView }: PaperTableViewProps) {
  return (
    <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-3xl shadow-[3px_3px_0_0_#201e1d] overflow-hidden print:shadow-none">
      <div className="px-4 py-3 bg-[#ebddc5] border-b-2 border-[#201e1d] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TableIcon className="w-4 h-4 text-[#201e1d] shrink-0" />
          <h3 className="font-heading font-black text-sm text-[#201e1d] truncate">Mark scheme table</h3>
        </div>
        <span className="text-xs font-mono font-bold text-[#645c50] shrink-0">
          {questions.length} of {totalQuestions}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#f5ead8] border-b-2 border-[#201e1d] font-heading font-black text-[#201e1d]">
              <th className="p-3 w-16 text-center">Q#</th>
              <th className="p-3 w-20 text-center">Key</th>
              <th className="p-3">Syllabus Topic</th>
              <th className="p-3">Cambridge Citation</th>
              <th className="p-3 w-24 text-center">Diagram</th>
              <th className="p-3">Mark Scheme Summary</th>
              <th className="p-3 w-24 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#201e1d]/15">
            {questions.map((q) => {
              const keyLetter = q.options?.find((o) => o.is_correct)?.label || '-';
              const cleanExpSnippet = (q.explanation_markdown || '')
                .replace(/[#*`$\\]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 110);

              return (
                <tr key={q.question_number} className="hover:bg-[#fff9f2] transition-colors">
                  <td className="p-3 text-center font-heading font-black text-sm text-[#201e1d]">
                    Q{q.question_number}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex w-7 h-7 rounded-lg border font-heading font-black text-xs items-center justify-center ${
                        showAnswers
                          ? 'bg-[#f0fae1] border-[#728157] text-[#272e1b]'
                          : 'bg-[#eee7db] border-[#201e1d]/30 text-[#645c50]'
                      }`}
                    >
                      {showAnswers ? keyLetter : '•'}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-[#201e1d] max-w-xs">{q.topic_name || 'General'}</td>
                  <td className="p-3 font-mono text-[11px] text-[#645c50] max-w-xs truncate">
                    {q.cambridge_source_ref || `0455 Q${q.question_number}`}
                  </td>
                  <td className="p-3 text-center">
                    {hasDiagram(q) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d]/30 text-[10px] font-bold text-[#8c491a]">
                        <ImageIcon className="w-3 h-3" />
                        Yes
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#a19786] font-mono">None</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-[#474238] max-w-md">
                    <span className="line-clamp-2">{cleanExpSnippet || 'Derivation available'}</span>
                  </td>
                  <td className="p-3 text-right print:hidden">
                    <button
                      type="button"
                      onClick={() => onView(q.question_number)}
                      className="px-2.5 py-1 rounded-lg bg-white border-2 border-[#201e1d] font-heading font-bold text-[11px] text-[#201e1d] hover:bg-[#ffe1d0] transition-colors active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
