'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadTestDraft, buildCompiledQuestions } from '@/lib/testCompiler';
import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { PrintableExamLayout } from '@/components/portal/compiler/PrintableExamLayout';
import { CAMBRIDGE_QUESTIONS, fetchQuestionsFromDb } from '@/lib/questions';
import { AlertTriangle, ArrowLeft, Sparkles, Loader2, Printer, FileText } from 'lucide-react';

function PrintPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams?.get('testId');

  const [config, setConfig] = useState<TestPaperConfig | null>(null);
  const [questions, setQuestions] = useState<CompiledExamQuestion[]>([]);
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function loadTest() {
      setIsLoading(true);
      setNotFound(false);

      if (!testId) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const loadedConfig = loadTestDraft(testId);
      if (!loadedConfig) {
        setNotFound(true);
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

  const handleLoadDemo = () => {
    const sampleIds = CAMBRIDGE_QUESTIONS.slice(0, 5).map((q) => q.id);
    const demoCompiled = buildCompiledQuestions(sampleIds, CAMBRIDGE_QUESTIONS);
    const sampleConfig: TestPaperConfig = {
      id: 'demo-sample-test',
      title: 'Cambridge IGCSE Economics — Sample Diagnostic Exam',
      subjectCode: '0455',
      subjectName: 'Economics',
      schoolName: 'Revizz Cambridge Exam Academy',
      durationMinutes: 45,
      totalMarks: demoCompiled.length,
      testCode: 'REV-0455-2026-DEMO',
      dateString: 'October 2026',
      includeCoverPage: true,
      includeCandidateHeader: false,
      includeBubbleSheet: true,
      includeMarkScheme: true,
      questionIds: sampleIds,
      compiledQuestions: demoCompiled,
      createdAt: new Date().toISOString(),
    };

    setConfig(sampleConfig);
    setQuestions(demoCompiled);
    setNotFound(false);
    setIsLoading(false);
  };

  // Error state: Draft not found in browser storage
  if (notFound && !config) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl border-2 border-[#201e1d] shadow-[6px_6px_0px_#201e1d] p-6 sm:p-8 flex flex-col gap-4 text-left">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffe1d0] border border-[#c67139] text-[#c67139] font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" /> Draft Not Found
            </span>
          </div>

          <div>
            <h1 className="text-xl font-bold text-[#201e1d]">Test Paper Draft Unavailable</h1>
            <p className="text-xs text-[#645c50] mt-1.5 leading-relaxed">
              Draft <code className="font-mono bg-[#eee7db] text-[#201e1d] px-1.5 py-0.5 rounded font-bold">{testId || 'unknown'}</code> was not found in browser storage.
            </p>
            <p className="text-xs text-[#8c8273] mt-2 leading-relaxed">
              Test compiler drafts are cached in local browser memory. If you opened this link from another tab, incognito mode, or another computer, return to the compiler to generate a fresh printable draft.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => router.push('/portal?tab=compiler')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-[#c67139] text-white font-bold text-xs font-mono shadow-[2px_2px_0px_#201e1d] hover:bg-[#b05f2b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Return to Compiler
            </button>
            <button
              type="button"
              onClick={handleLoadDemo}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] font-bold text-xs font-mono shadow-[2px_2px_0px_#201e1d] hover:bg-[#f7f4ee] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#c67139]" aria-hidden="true" /> Load Sample Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading || !config) {
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

  return (
    <div className="min-h-screen bg-gray-100 pb-12 font-sans">
      {/* Top Action Bar (hidden during printing) */}
      <div className="no-print sticky top-0 z-50 bg-[#f7f4ee] border-b-2 border-[#201e1d] shadow-sm p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push('/portal?tab=compiler')}
          className="px-3.5 py-2 text-xs font-bold font-mono text-[#201e1d] bg-white border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0px_#201e1d] hover:bg-[#ffe1d0] hover:text-[#c67139] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" /> Back to Compiler
        </button>

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
      <div className="mt-8">
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
