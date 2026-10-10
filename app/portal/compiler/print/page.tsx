'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadTestDraft, buildCompiledQuestions } from '@/lib/testCompiler';
import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { PrintableExamLayout } from '@/components/portal/compiler/PrintableExamLayout';
import { CAMBRIDGE_QUESTIONS } from '@/lib/questions';

function PrintPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams?.get('testId');
  
  const [config, setConfig] = useState<TestPaperConfig | null>(null);
  const [questions, setQuestions] = useState<CompiledExamQuestion[]>([]);
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let loadedConfig = testId ? loadTestDraft(testId) : null;
    
    if (!loadedConfig) {
      loadedConfig = {
        id: 'default-test',
        title: 'Term 1 Mock Assessment - Economics',
        subjectCode: '0455',
        subjectName: 'Economics',
        schoolName: 'Frontier International Academy',
        durationMinutes: 45,
        totalMarks: 30,
        testCode: 'REV-0455-2026-T1',
        dateString: 'October 2026',
        includeCoverPage: true,
        includeCandidateHeader: false,
        includeBubbleSheet: true,
        includeMarkScheme: true,
        questionIds: CAMBRIDGE_QUESTIONS.slice(0, 5).map(q => q.id), // Just grab some
        createdAt: new Date().toISOString()
      };
    }
    
    setConfig(loadedConfig);
    setQuestions(buildCompiledQuestions(loadedConfig.questionIds));
    setIsLoaded(true);
  }, [testId]);

  if (!isLoaded || !config) {
    return <div className="p-8 text-center text-black">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <div className="no-print sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm p-4 flex items-center justify-between">
        <button 
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          &larr; Back to Portal
        </button>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md border border-gray-200">
            <button
              onClick={() => setShowMarkScheme(false)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${!showMarkScheme ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Student Copy
            </button>
            <button
              onClick={() => setShowMarkScheme(true)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${showMarkScheme ? 'bg-white shadow text-black' : 'text-gray-500 hover:text-gray-800'}`}
            >
              Teacher Mark Scheme
            </button>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors shadow-sm"
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

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
    <Suspense fallback={<div className="p-8 text-center text-black">Loading...</div>}>
      <PrintPageContent />
    </Suspense>
  );
}
