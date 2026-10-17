'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadTestDraft, saveTestDraft, buildCompiledQuestions } from '@/lib/testCompiler';
import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { PrintableExamLayout } from '@/components/portal/compiler/PrintableExamLayout';
import { fetchQuestionsFromDb } from '@/lib/questions';
import { AlertTriangle, ArrowLeft, Loader2, Printer } from 'lucide-react';

function PrintPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams?.get('testId');

  const [config, setConfig] = useState<TestPaperConfig | null>(null);
  const [questions, setQuestions] = useState<CompiledExamQuestion[]>([]);
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadTest() {
      setIsLoading(true);

      if (!testId) {
        setIsLoading(false);
        return;
      }

      const loadedConfig = loadTestDraft(testId);
      if (!loadedConfig) {
        setIsLoading(false);
        return;
      }

      setConfig(loadedConfig);

      // a) If loadedConfig.compiledQuestions exists and is non-empty, use it immediately
      if (loadedConfig.compiledQuestions && loadedConfig.compiledQuestions.length > 0) {
        setQuestions(loadedConfig.compiledQuestions);
        setIsLoading(false);
        return;
      }

      // b) If compiledQuestions is missing but questionIds has IDs, fetch from Supabase
      if (loadedConfig.questionIds && loadedConfig.questionIds.length > 0) {
        try {
          const dbQuestions = await fetchQuestionsFromDb({ questionIds: loadedConfig.questionIds });
          if (isCancelled) return;

          const compiled = buildCompiledQuestions(loadedConfig.questionIds, dbQuestions);
          setQuestions(compiled);
        } catch (err) {
          console.error('[PrintPageContent] Error fetching questions from Supabase:', err);
          if (isCancelled) return;
          // Fallback to local questions if Supabase query fails
          const fallback = buildCompiledQuestions(loadedConfig.questionIds);
          setQuestions(fallback);
        } finally {
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      } else {
        setQuestions([]);
        setIsLoading(false);
      }
    }

    loadTest();

    return () => {
      isCancelled = true;
    };
  }, [testId]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="bg-white rounded-2xl border-2 border-[#201e1d] shadow-[4px_4px_0px_#201e1d] p-8 max-w-sm w-full flex flex-col items-center text-center gap-3">
          <Loader2 className="w-8 h-8 text-[#c67139] animate-spin" aria-hidden="true" />
          <h2 className="font-bold text-base text-[#201e1d]">Compiling Printable Exam</h2>
          <p className="text-xs text-[#645c50] leading-relaxed">
            Resolving questions, options, and diagram assets for print layout...
          </p>
          <span className="font-mono text-[10px] text-[#8c8273] bg-[#eee7db] px-2.5 py-1 rounded-md mt-1">
            Test ID: {testId || 'Initializing'}
          </span>
        </div>
      </div>
    );
  }

  // Guardrail 6 Compliance (Zero-Fallback Data Layer): Empty State when no valid config found
  if (!config) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] p-4 sm:p-6 font-sans">
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-3xl p-8 max-w-lg mx-auto mt-16 text-center shadow-[4px_4px_0_0_#201e1d]">
          <div className="w-12 h-12 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center mx-auto mb-4 text-[#c67139] shadow-[2px_2px_0_0_#201e1d]">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-black text-[#201e1d] mb-2 font-mono">No Compiled Test Paper Found</h1>
          <p className="text-xs text-[#645c50] mb-6 leading-relaxed">
            The requested test paper draft could not be found or loaded from browser storage. Return to the compiler to generate or open a valid test draft.
          </p>
          <button
            type="button"
            onClick={() => router.push('/portal?nav=compiler')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#201e1d] bg-[#c67139] text-white font-bold text-xs font-mono shadow-[2px_2px_0px_#201e1d] hover:bg-[#b05f2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Return to Test Compiler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans print:bg-white print:p-0 print:m-0 print:min-h-0">
      {/* Top Action Bar (hidden during printing) */}
      <div className="no-print sticky top-0 z-50 bg-[#f7f4ee] border-b-2 border-[#201e1d] shadow-sm p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/portal?nav=compiler')}
            className="px-3.5 py-2 text-xs font-bold font-mono text-[#201e1d] bg-white border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0px_#201e1d] hover:bg-[#ffe1d0] hover:text-[#c67139] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to Compiler
          </button>

          {/* A4 Print Tip Helper Pill */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#645c50] bg-[#eee7db] px-3 py-1.5 rounded-full border border-[#dcd3c4]">
            <span aria-hidden="true">💡</span>
            <span>Print tip: Choose Paper size: A4 and Margins: Default in your browser&apos;s print dialog.</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-[#eee7db] p-1 rounded-xl border border-[#dcd3c4]">
            <button
              type="button"
              onClick={() => setShowMarkScheme(false)}
              className={`px-3 py-1.5 text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer ${
                !showMarkScheme
                  ? 'bg-white shadow-sm text-[#201e1d] border border-[#dcd3c4]'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              }`}
            >
              Student Copy
            </button>
            <button
              type="button"
              onClick={() => setShowMarkScheme(true)}
              className={`px-3 py-1.5 text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer ${
                showMarkScheme
                  ? 'bg-white shadow-sm text-[#201e1d] border border-[#dcd3c4]'
                  : 'text-[#645c50] hover:text-[#201e1d]'
              }`}
            >
              Teacher Mark Scheme
            </button>
          </div>

          {showMarkScheme && (
            <button
              type="button"
              onClick={() => {
                const nextVal = config.includeExplanations === false;
                const updatedConfig = { ...config, includeExplanations: nextVal };
                setConfig(updatedConfig);
                saveTestDraft(updatedConfig);
              }}
              className={`px-3 py-1.5 text-xs font-bold font-mono rounded-xl border-2 border-[#201e1d] shadow-[2px_2px_0px_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer ${
                config.includeExplanations !== false
                  ? 'bg-[#ffe1d0] text-[#c67139]'
                  : 'bg-white text-[#201e1d] hover:bg-[#f7f4ee]'
              }`}
            >
              {config.includeExplanations !== false ? 'Explanations: ON' : 'Explanations: OFF'}
            </button>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 text-xs font-bold font-mono text-white bg-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0px_#c67139] hover:bg-[#34302d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" aria-hidden="true" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Printable Exam Paper Area */}
      <div className="mt-8 print:mt-0 print:p-0">
        <PrintableExamLayout
          config={config}
          questions={questions}
          showMarkScheme={showMarkScheme}
        />
      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-6 font-sans">
          <div className="bg-white rounded-2xl border-2 border-[#201e1d] shadow-[4px_4px_0px_#201e1d] p-6 text-center">
            <Loader2 className="w-6 h-6 text-[#c67139] animate-spin mx-auto mb-2" aria-hidden="true" />
            <span className="font-mono text-xs font-bold text-[#201e1d]">Loading print preview...</span>
          </div>
        </div>
      }
    >
      <PrintPageContent />
    </Suspense>
  );
}
