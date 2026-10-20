import React from 'react';
import { RichMarkdown } from '@/components/ui/RichMarkdown';
import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { Code128Barcode } from '@/lib/barcode';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { stripCambridgeIgcse } from '@/lib/compilerFilters';

interface Props {
  config: TestPaperConfig;
  questions: CompiledExamQuestion[];
  showMarkScheme?: boolean;
}

export const PrintableExamLayout: React.FC<Props> = ({ config, questions, showMarkScheme = false }) => {
  if (showMarkScheme) {
    const showExplanations = config.includeExplanations !== false;

    return (
      <div className="print-container w-[210mm] max-w-full min-h-[297mm] mx-auto bg-white text-black p-[15mm] shadow-lg border border-gray-300 font-serif text-[11pt] print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">
        <div className="mark-scheme-content">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-center border-b-2 border-black pb-3 uppercase tracking-wide">
            {showExplanations ? 'TEACHER COPY — MARK SCHEME & EXPLANATIONS' : 'TEACHER COPY — MARK SCHEME'}
          </h2>
          <div className="mb-4 flex justify-between items-center text-xs font-mono border-b border-black pb-2">
            <div>
              <strong>{config.schoolName}</strong>
              {config.title ? ` — ${config.title}` : config.subjectName ? ` — ${config.subjectName}` : ''}
            </div>
            <div>
              {config.subjectCode ? `${config.subjectCode} • ` : ''}
              {questions.length} Questions
            </div>
          </div>
          <table className="w-full text-left border-collapse border border-black text-xs sm:text-sm">
            <thead style={{ display: 'table-header-group' }}>
              <tr className="border-b border-black bg-gray-50 print:bg-transparent" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <th className="p-1.5 sm:p-2 border-r border-black w-12 text-center font-bold">Q#</th>
                <th className="p-1.5 sm:p-2 border-r border-black w-12 text-center font-bold">Key</th>
                <th className="p-1.5 sm:p-2 border-r border-black w-44 font-bold">Syllabus Topic</th>
                <th className={`p-1.5 sm:p-2 ${showExplanations ? 'border-r border-black w-32' : 'w-32'} font-bold`}>Citation</th>
                {showExplanations && <th className="p-1.5 sm:p-2 font-bold">Explanation</th>}
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const correctOption = q.options.find(o => o.isCorrect);
                return (
                  <tr key={q.id} className="border-b border-black" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                    <td className="p-1.5 sm:p-2 border-r border-black font-bold text-center">{q.questionNumber}</td>
                    <td className="p-1.5 sm:p-2 border-r border-black text-center font-bold">{correctOption?.label || '-'}</td>
                    <td className="p-1.5 sm:p-2 border-r border-black">{q.topic || '-'}</td>
                    <td className={`p-1.5 sm:p-2 ${showExplanations ? 'border-r border-black text-xs' : 'text-xs'}`}>{stripCambridgeIgcse(q.citation) || '-'}</td>
                    {showExplanations && (
                      <td className="p-1.5 sm:p-2 text-xs">
                        {q.explanationMarkdown ? (
                          <div className="prose prose-sm max-w-none text-black">
                            <RichMarkdown content={q.explanationMarkdown} variant="printable" />
                          </div>
                        ) : '-'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <style jsx global>{`
          @media print {
            @page {
              size: A4 portrait;
              margin: 15mm;
            }
            html, body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              width: 100% !important;
              max-width: none !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="print-container w-[210mm] max-w-full min-h-[297mm] mx-auto bg-white text-black p-[15mm] shadow-lg border border-gray-300 font-serif text-[11pt] print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-none">
      {config.includeCoverPage && (
        <div
          className="cover-page mb-6 print:mb-0"
          style={{ pageBreakAfter: 'always', breakAfter: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{config.schoolName}</h1>
              {config.title && <div className="text-sm text-gray-700 mt-0.5">{config.title}</div>}
            </div>
            {config.testCode && (
              <div className="shrink-0">
                <Code128Barcode value={config.testCode} height={40} width={180} />
              </div>
            )}
          </div>

          <div className="border border-black p-3 mb-4">
            <div className="mb-3">
              <label className="block text-xs font-bold tracking-wider mb-1">CANDIDATE NAME</label>
              <div className="border-b border-black h-7 w-full"></div>
            </div>
            <div className="flex gap-8">
              <div>
                <label className="block text-xs font-bold tracking-wider mb-1">CENTRE NUMBER</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-7 h-7 border border-black text-center text-transparent text-xs">_</div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold tracking-wider mb-1">CANDIDATE NUMBER</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-7 h-7 border border-black text-center text-transparent text-xs">_</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4 border-t-2 border-b-2 border-black py-3">
            <h3 className="text-xl sm:text-2xl font-bold uppercase">{config.subjectName}</h3>
            <div className="flex justify-between mt-1 font-bold text-base">
              <span>{config.subjectCode}</span>
              <span>{config.durationMinutes} minutes</span>
            </div>
          </div>

          <div className="instructions text-xs sm:text-sm border border-black p-3.5 mb-4">
            <h4 className="font-bold text-sm sm:text-base mb-2 uppercase tracking-wide">READ THESE INSTRUCTIONS FIRST</h4>
            {config.instructionsText ? (
              <div className="whitespace-pre-wrap leading-relaxed">{config.instructionsText}</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>Write your name, Centre number and candidate number on the boxes above and the answer sheet.</li>
                <li>Answer all questions. For each question there are four possible answers A, B, C and D.</li>
                <li>Each correct answer will score one mark. Marks are not deducted for wrong answers.</li>
                <li>Any rough working should be done in this booklet.</li>
              </ul>
            )}
          </div>

          <div className="text-center text-xs text-gray-600 mt-4">
            <span>This document consists of printed pages.</span>
          </div>
        </div>
      )}

      {config.includeCandidateHeader && !config.includeCoverPage && (
        <div
          className="header-simple mb-6 border-b-2 border-black pb-3 flex justify-between items-end"
          style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
        >
          <div>
            <h1 className="text-xl font-bold">{config.schoolName}</h1>
            <div className="text-base">{config.title || config.subjectName}</div>
            <div className="text-xs mt-2">Candidate Name: _________________________________</div>
          </div>
          <div className="text-right">
            {config.testCode && <Code128Barcode value={config.testCode} height={40} width={150} />}
            <div className="mt-1 font-bold text-sm">
              {config.subjectCode ? `${config.subjectCode} • ` : ''}{config.durationMinutes} mins
            </div>
          </div>
        </div>
      )}

      <div className="questions-list space-y-6">
        {questions.map((q) => (
          <div
            key={q.id}
            className="question-item flex gap-3 text-black leading-relaxed"
            style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <div className="font-bold text-base w-7 shrink-0">{q.questionNumber}</div>
            <div className="flex-1 min-w-0">
              <div className="prose prose-sm max-w-none text-black mb-3">
                <RichMarkdown content={q.stemMarkdown} variant="printable" />
              </div>
              {q.imageUrl && (
                <div className="my-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveDiagramUrl(q.imageUrl) || q.imageUrl}
                    alt={`Question ${q.questionNumber}`}
                    className="max-w-full h-auto max-h-[190px] object-contain my-2"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 mt-2" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                {q.options.map((opt) => (
                  <div
                    key={opt.label}
                    className="flex items-start gap-3 text-black"
                    style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                  >
                    <span className="font-bold shrink-0 w-4 text-black">{opt.label}</span>
                    <div className="prose prose-sm max-w-none text-black">
                      <RichMarkdown content={opt.textMarkdown} variant="plain" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {config.includeBubbleSheet && (
        <div
          style={{ pageBreakBefore: 'always', breakBefore: 'page', pageBreakInside: 'avoid', breakInside: 'avoid' }}
          className="bubble-sheet pt-6"
        >
          <div className="text-center mb-6 border-b-2 border-black pb-4">
            <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-wide">MULTIPLE CHOICE ANSWER SHEET</h2>
            <div className="text-xs text-gray-700 mt-1">
              {config.schoolName} — {config.subjectName} ({config.subjectCode})
            </div>
            <div className="mt-4 border border-black p-3 text-left text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="font-bold block mb-1">CANDIDATE NAME:</span>
                <div className="border-b border-black h-5 w-full"></div>
              </div>
              <div>
                <span className="font-bold block mb-1">CENTRE NUMBER:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-5 h-5 border border-black text-center text-transparent text-[10px]">_</div>
                  ))}
                </div>
              </div>
              <div>
                <span className="font-bold block mb-1">CANDIDATE NUMBER:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-5 h-5 border border-black text-center text-transparent text-[10px]">_</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-gray-600 italic">
              Use a soft pencil (B or HB). Rub out any answers you wish to change using an eraser. Mark ONE circle only for each question.
            </div>
          </div>

          <div className="grid grid-cols-4 gap-x-6 gap-y-2">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between gap-1 py-0.5 border-b border-gray-200"
                style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
              >
                <span className="w-5 font-bold text-xs text-right shrink-0">{q.questionNumber}</span>
                <div className="flex gap-1.5 shrink-0">
                  {['A', 'B', 'C', 'D'].map((label) => (
                    <div
                      key={label}
                      className="w-[22px] h-[22px] rounded-full border border-black flex items-center justify-center text-[10px] font-bold leading-none select-none text-black"
                    >
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>
    </div>
  );
};
