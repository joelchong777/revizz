'use client';

import React, { useState } from 'react';
import QuestionCard from '@/components/QuestionCard';
import { ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/select';

export default function AdminCMS() {
  const [mockQuestion, setMockQuestion] = useState<any>({
    id: 'mock-1',
    stem_markdown: 'What is the main economic problem?',
    options: [
      { id: 'opt-a', text_markdown: 'Scarcity' },
      { id: 'opt-b', text_markdown: 'Inflation' },
      { id: 'opt-c', text_markdown: 'Unemployment' },
      { id: 'opt-d', text_markdown: 'Taxation' }
    ],
    correct_option_id: 'opt-a',
    citation: '0455/12/M/J/25 Q11',
    topic_id: 'mock-topic',
    topic: '1. Basic Economic Problem'
  });

  const handleOptionChange = (id: string, text: string) => {
    setMockQuestion((prev: any) => ({
      ...prev,
      options: prev.options.map((opt: any) => opt.id === id ? { ...opt, text_markdown: text } : opt)
    }));
  };

  const handleStemChange = (text: string) => {
    setMockQuestion((prev: any) => ({ ...prev, stem_markdown: text }));
  };

  const handleCitationChange = (text: string) => {
    setMockQuestion((prev: any) => ({ ...prev, citation: text }));
  };

  const setCorrectOption = (id: string) => {
    setMockQuestion((prev: any) => ({ ...prev, correct_option_id: id }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Split-Pane Visual Question Editor */}
      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Left Column (50% - Form Controls) */}
          <div className="bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky space-y-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>✨</span> Visual Question Editor
            </h2>
            
            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                  <Select
                    value="Economics (0455)"
                    onChange={() => {}}
                    options={[{ value: 'Economics (0455)', label: 'Economics (0455)' }]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Paper</label>
                  <Select
                    value="Paper 12 (M/J 2025)"
                    onChange={() => {}}
                    options={[{ value: 'Paper 12 (M/J 2025)', label: 'Paper 12 (M/J 2025)' }]}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic</label>
                  <Select
                    value="1. Basic Economic Problem"
                    onChange={() => {}}
                    options={[{ value: '1. Basic Economic Problem', label: '1. Basic Economic Problem' }]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Q Number</label>
                  <input type="number" className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400" placeholder="e.g. 11" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cambridge Source Ref</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400" 
                    placeholder="e.g. 0455/12/M/J/25 Q11" 
                    value={mockQuestion.citation}
                    onChange={(e) => handleCitationChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex justify-between">
                  <span>Stem (Markdown / KaTeX)</span>
                  <span className="text-indigo-500">Live Preview Enabled 👀</span>
                </label>
                <textarea 
                  rows={4} 
                  className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:border-indigo-400 font-mono text-sm" 
                  placeholder="Enter question text here... You can use $math$ syntax."
                  value={mockQuestion.stem_markdown}
                  onChange={(e) => handleStemChange(e.target.value)}
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="text-3xl mb-2">🖼️</div>
                <div className="font-bold text-slate-700">Upload Image / Diagram</div>
                <div className="text-xs text-slate-500 font-medium mt-1">PNG, JPG up to 2MB (Uploads to Supabase)</div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase">Options (Select Correct)</label>
                {mockQuestion.options.map((opt: any, i: number) => {
                  const letters = ['A', 'B', 'C', 'D'];
                  return (
                    <div key={opt.id} className="flex items-center gap-3">
                      <input 
                        type="radio" 
                        name="correct_option" 
                        className="w-5 h-5 accent-indigo-600" 
                        checked={mockQuestion.correct_option_id === opt.id}
                        onChange={() => setCorrectOption(opt.id)}
                      />
                      <div className="w-8 h-8 rounded-lg bg-slate-100 border-2 border-slate-200 flex items-center justify-center font-black text-slate-500">
                        {letters[i]}
                      </div>
                      <input 
                        type="text" 
                        className="flex-1 bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-indigo-400" 
                        placeholder={`Option ${letters[i]} text`} 
                        value={opt.text_markdown}
                        onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Explanation (Markdown)</label>
                <textarea rows={2} className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:border-indigo-400 font-mono text-sm" placeholder="Explain why the answer is correct..." />
              </div>

              <button type="button" className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-[0_4px_0_rgb(67,56,202)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(67,56,202)] active:translate-y-[4px] active:shadow-none transition-all">
                Publish Question 🚀
              </button>
            </form>
          </div>

          {/* Right Column (50% - Live Student Preview Card) */}
          <div className="sticky top-6">
             <div className="bg-slate-100 p-6 rounded-3xl border-2 border-slate-800 shadow-inner flex flex-col justify-center items-center h-full">
                <div className="text-sm font-bold text-slate-400 mb-4 uppercase tracking-widest">Student Preview Mode</div>
                <div className="w-full max-w-lg pointer-events-auto">
                  <QuestionCard 
                    question={mockQuestion}
                    questionNumber={1}
                    totalQuestions={1}
                    status="unanswered"
                    timeLeft={90}
                    isTimed={false}
                    selectedOptionId={null}
                    firstWrongOptionId={null}
                    isEndless={false}
                    onFinish={() => {}}
                    onAnswer={(id) => console.log('Answered:', id)}
                    onNext={() => console.log('Next')}
                    totalXP={0}
                    currentStreak={0}
                  />
                </div>
             </div>
          </div>

        </div>
      </section>
    </div>
  );
}
