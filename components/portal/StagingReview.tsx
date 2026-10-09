import React, { useState } from 'react';
import QuestionCard from '@/components/QuestionCard';

export default function StagingReview() {
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);

  // Mock data for staging review
  const [stagedQuestions, setStagedQuestions] = useState([
    {
      id: 'stg-1',
      stem_markdown: 'What is the main economic problem?',
      options: [
        { id: 'opt-a', text_markdown: 'Scarcity' },
        { id: 'opt-b', text_markdown: 'Inflation' },
        { id: 'opt-c', text_markdown: 'Unemployment' },
        { id: 'opt-d', text_markdown: 'Taxation' }
      ],
      correct_option_id: 'opt-a',
      explanation_markdown: 'Scarcity is the fundamental economic problem of having seemingly unlimited human wants in a world of limited resources.',
      citation: '0455/12/M/J/25 Q11',
      topic_id: 'mock-topic-1',
      topic: '1. Basic Economic Problem',
      has_diagram: false,
      status: 'complete' // 'complete', 'review'
    },
    {
      id: 'stg-2',
      stem_markdown: 'Look at the diagram showing a production possibility curve. What is the opportunity cost of producing more consumer goods?',
      options: [
        { id: 'opt-a', text_markdown: 'Capital goods foregone' },
        { id: 'opt-b', text_markdown: 'Zero' },
        { id: 'opt-c', text_markdown: 'Increased profits' },
        { id: 'opt-d', text_markdown: 'More taxes' }
      ],
      correct_option_id: 'opt-a',
      explanation_markdown: 'The opportunity cost of choosing more of one good is the amount of the other good that must be given up.',
      citation: '0455/12/M/J/25 Q12',
      topic_id: 'mock-topic-1',
      topic: '1. Basic Economic Problem',
      has_diagram: true,
      status: 'review'
    }
  ]);

  const activeQuestion = stagedQuestions[selectedQuestionIdx];

  const handleUpdateActiveQuestion = (updatedFields: Partial<typeof activeQuestion>) => {
    setStagedQuestions(prev => prev.map((q, i) => i === selectedQuestionIdx ? { ...q, ...updatedFields } : q));
  };

  const validatedCount = stagedQuestions.filter(q => q.status === 'complete').length;
  const diagramCount = stagedQuestions.filter(q => q.has_diagram).length;
  const totalCount = stagedQuestions.length;

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-xl font-black text-slate-800">Physics 0625/12 M/J 2023 (Staged)</h2>
            <div className="text-sm font-bold text-slate-500 uppercase">Batch ID: BATCH-90210</div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-xl font-bold border-2 border-emerald-300">
            {validatedCount} / {totalCount} Validated ✅
          </div>
          <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-xl font-bold border-2 border-indigo-300">
            {diagramCount} Diagrams Extracted 🖼️
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Navigator List */}
        <div className="lg:col-span-1 bg-white p-4 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky max-h-[800px] overflow-y-auto">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b-2 border-slate-100 pb-2">Questions</h3>
          <div className="space-y-2">
            {stagedQuestions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setSelectedQuestionIdx(idx)}
                className={`w-full text-left p-3 rounded-xl font-bold text-sm flex items-center justify-between border-2 transition-all ${
                  selectedQuestionIdx === idx 
                    ? 'border-indigo-600 bg-indigo-50 shadow-[0_2px_0_rgb(79,70,229)] translate-y-[-2px]' 
                    : 'border-slate-200 hover:border-slate-400 bg-white'
                }`}
              >
                <span>Q{idx + 1}</span>
                <span className="flex gap-1 text-base">
                  {q.has_diagram && '🖼️'}
                  {q.status === 'complete' ? '✅' : '⚠️'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Center/Right Column: Interactive Split-pane */}
        <div className="lg:col-span-3 bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-black">{activeQuestion.citation}</span>
              <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-xs font-bold">{activeQuestion.topic}</span>
            </div>
            <button 
              onClick={() => handleUpdateActiveQuestion({ status: activeQuestion.status === 'complete' ? 'review' : 'complete' })}
              className={`px-4 py-2 rounded-xl font-bold text-sm border-2 shadow-sm transition-all active:translate-y-0.5 active:shadow-none ${
                activeQuestion.status === 'complete' 
                  ? 'bg-slate-100 border-slate-300 text-slate-600'
                  : 'bg-emerald-100 border-emerald-400 text-emerald-800'
              }`}
            >
              {activeQuestion.status === 'complete' ? 'Mark as Needs Review ⚠️' : 'Mark as Complete ✅'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Inline Editor */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stem (KaTeX supported)</label>
                <textarea 
                  rows={3} 
                  className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400" 
                  value={activeQuestion.stem_markdown}
                  onChange={(e) => handleUpdateActiveQuestion({ stem_markdown: e.target.value })}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Options</label>
                <div className="space-y-2">
                  {activeQuestion.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${activeQuestion.correct_option_id === opt.id ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {['A','B','C','D'][i]}
                      </div>
                      <input 
                        type="text" 
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-2 py-1 text-sm font-medium outline-none focus:border-indigo-400" 
                        value={opt.text_markdown}
                        onChange={(e) => {
                          const newOptions = [...activeQuestion.options];
                          newOptions[i].text_markdown = e.target.value;
                          handleUpdateActiveQuestion({ options: newOptions });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Explanation</label>
                <textarea 
                  rows={2} 
                  className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400" 
                  value={activeQuestion.explanation_markdown}
                  onChange={(e) => handleUpdateActiveQuestion({ explanation_markdown: e.target.value })}
                />
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-300 shadow-inner flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest w-full text-center">Live Preview</div>
              <div className="w-full pointer-events-auto scale-90 origin-top">
                <QuestionCard 
                  question={activeQuestion}
                  questionNumber={selectedQuestionIdx + 1}
                  totalQuestions={totalCount}
                  status={activeQuestion.status === 'complete' ? 'answered' : 'unanswered'}
                  timeLeft={0}
                  isTimed={false}
                  selectedOptionId={activeQuestion.correct_option_id}
                  firstWrongOptionId={null}
                  isEndless={false}
                  onFinish={() => {}}
                  onAnswer={() => {}}
                  onNext={() => {}}
                  totalXP={0}
                  currentStreak={0}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky flex flex-col sm:flex-row justify-end items-center gap-4">
        <button className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-700 font-bold text-lg rounded-2xl border-2 border-b-4 border-slate-800 shadow-sm hover:bg-slate-200 active:translate-y-[2px] active:border-b-2 transition-all">
          Export Staging JSON 💾
        </button>
        <button className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-[0_4px_0_rgb(67,56,202)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(67,56,202)] active:translate-y-[4px] active:shadow-none transition-all">
          Approve & Publish to Supabase Live 🚀
        </button>
      </div>
    </div>
  );
}
