import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { Code128Barcode } from '@/lib/barcode';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';

interface Props {
  config: TestPaperConfig;
  questions: CompiledExamQuestion[];
  showMarkScheme?: boolean;
}

export const PrintableExamLayout: React.FC<Props> = ({ config, questions, showMarkScheme = false }) => {
  if (showMarkScheme) {
    return (
      <div className="print-container text-black font-serif">
        <div style={{ pageBreakBefore: 'always' }} className="p-8">
          <h2 className="text-2xl font-bold mb-6 text-center border-b-2 border-black pb-4 uppercase">
            TEACHER COPY — MARK SCHEME & EXPLANATIONS
          </h2>
          <table className="w-full text-left border-collapse border border-black">
            <thead>
              <tr className="border-b border-black">
                <th className="p-2 border-r border-black w-12 text-center">Q#</th>
                <th className="p-2 border-r border-black w-12 text-center">Key</th>
                <th className="p-2 border-r border-black w-48">Syllabus Topic</th>
                <th className="p-2 border-r border-black w-32">Citation</th>
                <th className="p-2">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => {
                const correctOption = q.options.find(o => o.isCorrect);
                return (
                  <tr key={q.id} className="border-b border-black">
                    <td className="p-2 border-r border-black font-bold text-center">{q.questionNumber}</td>
                    <td className="p-2 border-r border-black text-center font-bold">{correctOption?.label}</td>
                    <td className="p-2 border-r border-black">{q.topic || '-'}</td>
                    <td className="p-2 border-r border-black text-xs">{q.citation || '-'}</td>
                    <td className="p-2 text-sm">
                      {q.explanationMarkdown ? (
                        <div className="prose prose-sm max-w-none text-black">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {q.explanationMarkdown}
                          </ReactMarkdown>
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <style jsx global>{`
          @media print {
            @page { size: A4; margin: 15mm; }
            body { background: white; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="print-container max-w-4xl mx-auto bg-white text-black text-[11pt] font-serif p-8">
      {config.includeCoverPage && (
        <div className="cover-page mb-8" style={{ pageBreakAfter: 'always', pageBreakInside: 'avoid' }}>
          <div className="flex justify-between items-start mb-8">
            <div>
              <h1 className="text-2xl font-bold">{config.schoolName}</h1>
              <h2 className="text-xl mt-1">Cambridge IGCSE™</h2>
            </div>
            {config.testCode && (
              <Code128Barcode value={config.testCode} height={50} width={200} />
            )}
          </div>
          
          <div className="border border-black p-4 mb-8">
            <div className="mb-4">
              <label className="block text-sm mb-1">CANDIDATE NAME</label>
              <div className="border-b border-black h-8 w-full"></div>
            </div>
            <div className="flex gap-8">
              <div>
                <label className="block text-sm mb-1">CENTRE NUMBER</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-8 h-8 border border-black text-center text-transparent">_</div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1">CANDIDATE NUMBER</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-8 h-8 border border-black text-center text-transparent">_</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-8 border-t-2 border-b-2 border-black py-4">
            <h3 className="text-2xl font-bold uppercase">{config.subjectName}</h3>
            <div className="flex justify-between mt-2 font-bold text-lg">
              <span>{config.subjectCode}</span>
              <span>{config.durationMinutes} minutes</span>
            </div>
          </div>

          <div className="instructions text-sm mt-8 border border-black p-4">
            <h4 className="font-bold text-lg mb-4">READ THESE INSTRUCTIONS FIRST</h4>
            {config.instructionsText ? (
              <div className="whitespace-pre-wrap">{config.instructionsText}</div>
            ) : (
              <ul className="list-disc pl-5 space-y-2">
                <li>Write your name, Centre number and candidate number on the boxes above and the answer sheet.</li>
                <li>Answer all questions. For each question there are four possible answers A, B, C and D.</li>
                <li>Each correct answer will score one mark. Marks are not deducted for wrong answers.</li>
                <li>Any rough working should be done in this booklet.</li>
              </ul>
            )}
          </div>
        </div>
      )}

      {config.includeCandidateHeader && !config.includeCoverPage && (
        <div className="header-simple mb-8 border-b-2 border-black pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-bold">{config.schoolName}</h1>
            <div className="text-lg">{config.title}</div>
            <div className="text-sm mt-2">Candidate Name: _________________________________</div>
          </div>
          <div className="text-right">
            {config.testCode && <Code128Barcode value={config.testCode} height={40} width={150} />}
            <div className="mt-2 font-bold">{config.subjectCode} - {config.durationMinutes} mins</div>
          </div>
        </div>
      )}

      <div className="questions-list space-y-8">
        {questions.map((q) => (
          <div key={q.id} className="question-item flex gap-4" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
            <div className="font-bold text-lg w-6 shrink-0">{q.questionNumber}</div>
            <div className="flex-1">
              <div className="prose prose-sm max-w-none text-black mb-4">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {q.stemMarkdown}
                </ReactMarkdown>
              </div>
              {q.imageUrl && (
                <div className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveDiagramUrl(q.imageUrl) || q.imageUrl}
                    alt={`Question ${q.questionNumber}`}
                    className="max-w-full h-auto max-h-[300px] object-contain"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {q.options.map((opt) => (
                  <div key={opt.label} className="flex gap-3">
                    <span className="font-bold">{opt.label}</span>
                    <div className="prose prose-sm max-w-none text-black">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {opt.textMarkdown}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {config.includeBubbleSheet && (
        <div style={{ pageBreakBefore: 'always', breakBefore: 'page' }} className="bubble-sheet pt-8">
          <div className="text-center mb-8 border-b-2 border-black pb-4">
            <h2 className="text-2xl font-bold">MULTIPLE CHOICE ANSWER SHEET</h2>
            <div className="mt-4 flex flex-wrap justify-between px-8 text-left text-sm gap-4">
              <div>Name: ________________________</div>
              <div>Centre: [ ][ ][ ][ ][ ]</div>
              <div>Cand No: [ ][ ][ ][ ]</div>
            </div>
          </div>
          
          <div className="columns-2 sm:columns-3 gap-8">
            {questions.map((q) => (
              <div key={q.id} className="flex items-center gap-4 mb-3" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                <span className="w-6 font-bold text-right">{q.questionNumber}</span>
                <div className="flex gap-2">
                  {['A', 'B', 'C', 'D'].map(label => (
                    <div key={label} className="w-6 h-6 rounded-full border border-black flex items-center justify-center text-xs">
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
          @page { size: A4; margin: 15mm; }
          @page :first { margin-top: 10mm; }
          body { background: white; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};
