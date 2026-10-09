'use client';

import React, { useState } from 'react';
import QuestionCard from '@/components/QuestionCard';

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
          <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm space-y-6">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>✨</span> Visual Question Editor
            </h2>
            
            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subject</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400">
                    <option>Economics (0455)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Paper</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400">
                    <option>Paper 12 (M/J 2025)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Topic</label>
                  <select className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400">
                    <option>1. Basic Economic Problem</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Q Number</label>
                  <input type="number" className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400" placeholder="e.g. 11" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cambridge Source Ref</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 outline-none focus:border-indigo-400" 
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
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:border-indigo-400 font-mono text-sm" 
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
                        className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none focus:border-indigo-400" 
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
                <textarea rows={2} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-700 outline-none focus:border-indigo-400 font-mono text-sm" placeholder="Explain why the answer is correct..." />
              </div>

              <button type="button" className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-[0_4px_0_rgb(67,56,202)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(67,56,202)] active:translate-y-[4px] active:shadow-none transition-all">
                Publish Question 🚀
              </button>
            </form>
          </div>

          {/* Right Column (50% - Live Student Preview Card) */}
          <div className="sticky top-6">
             <div className="bg-slate-100 p-6 rounded-3xl border-2 border-slate-200 shadow-inner flex flex-col justify-center items-center h-full">
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

      {/* Bulk Past-Paper Importer Workspace */}
      <section>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <span>📦</span> Bulk Past-Paper Importer
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-slate-700">JSON/CSV Payload</label>
                <button className="py-1.5 px-3 bg-slate-100 text-slate-700 font-bold rounded-lg border-2 border-slate-200 hover:bg-slate-200 transition-colors text-xs">
                  Load Template
                </button>
              </div>
              <textarea 
                rows={12} 
                className="w-full bg-slate-800 text-green-400 border-2 border-slate-700 rounded-xl px-4 py-3 font-mono text-sm outline-none focus:border-indigo-500 leading-relaxed" 
                defaultValue={'[\n  {\n    "question_number": 1,\n    "stem": "What is the basic economic problem?",\n    "options": [\n      "Scarcity",\n      "Inflation",\n      "Unemployment",\n      "Taxation"\n    ],\n    "correct": 0\n  }\n]'} 
              />
            </div>
            
            <div className="space-y-6 flex flex-col justify-center">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                <div className="text-lg font-black text-blue-800 mb-2">Schema Validation</div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-blue-700">Status</span>
                  <span className="text-xs font-black text-green-600 bg-green-100 px-3 py-1.5 rounded-lg">✅ 30 Valid Questions Detected</span>
                </div>
                <ul className="text-sm text-blue-700 font-medium space-y-2 list-disc list-inside">
                  <li>All questions have 4 options.</li>
                  <li>Correct answer indices are within bounds.</li>
                  <li>No missing question stems.</li>
                </ul>
              </div>
              
              <button className="w-full py-4 bg-slate-800 text-white font-black text-lg rounded-2xl shadow-[0_4px_0_rgb(30,41,59)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(30,41,59)] active:translate-y-[4px] active:shadow-none transition-all flex items-center justify-center gap-2">
                <span>⬇️</span> Import All to Supabase
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* High-Density Question Browser & Manager */}
      <section>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>🗄️</span> Question Browser & Manager
            </h2>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Search questions..." className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-400 w-64" />
              <select className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-400">
                <option>All Papers</option>
                <option>0455/12 M/J 25</option>
              </select>
              <select className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-indigo-400">
                <option>All Topics</option>
                <option>Basic Economic Problem</option>
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Ref</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Topic</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Stem Snippet</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { ref: '0455/12 M/J 25 Q11', topic: 'Basic Economic Problem', stem: 'What is the main economic...', active: true },
                  { ref: '0455/12 M/J 25 Q12', topic: 'Allocation of Resources', stem: 'Which of the following is...', active: true },
                  { ref: '0455/12 M/J 25 Q13', topic: 'Microeconomic Decision Makers', stem: 'The diagram shows a shift...', active: false }
                ].map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-sm font-bold text-indigo-600 whitespace-nowrap">{row.ref}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-600 whitespace-nowrap">{row.topic}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-800 truncate max-w-xs">{row.stem}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${row.active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                        {row.active ? 'Active' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 bg-white border-2 border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="Edit">✏️</button>
                        <button className="p-2 bg-white border-2 border-slate-200 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Delete">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
