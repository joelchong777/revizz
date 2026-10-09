import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Select } from '@/components/ui/select';

export default function AdminTools() {
  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      {/* Bulk Past-Paper Importer Workspace */}
      <section>
        <div className="bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky">
          <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
            <span>📦</span> Bulk Past-Paper Importer
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-slate-700">JSON/CSV Payload</label>
                <button className="py-1.5 px-3 bg-slate-100 text-slate-700 font-bold rounded-lg border-2 border-b-4 border-slate-800 hover:bg-slate-200 transition-all active:translate-y-0.5 active:border-b-2 text-xs">
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
              
              <button className="w-full py-4 bg-slate-800 text-white font-black text-lg rounded-2xl border-2 border-b-4 border-slate-900 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-sm transition-all flex items-center justify-center gap-2">
                <span>⬇️</span> Import All to Supabase
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* High-Density Question Browser & Manager */}
      <section>
        <div className="bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span>🗄️</span> Question Browser & Manager
            </h2>
            <div className="flex items-center gap-3">
              <input type="text" placeholder="Search questions..." className="bg-slate-50 border-2 border-slate-800 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:border-indigo-400 w-64" />
              <Select
                value="All Papers"
                onChange={() => {}}
                options={[
                  { value: 'All Papers', label: 'All Papers' },
                  { value: '0455/12 M/J 25', label: '0455/12 M/J 25' }
                ]}
                className="w-48"
              />
              <Select
                value="All Topics"
                onChange={() => {}}
                options={[
                  { value: 'All Topics', label: 'All Topics' },
                  { value: 'Basic Economic Problem', label: 'Basic Economic Problem' }
                ]}
                className="w-48"
              />
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
                        <button className="p-2 bg-white border-2 border-b-4 border-slate-800 shadow-sm text-slate-500 hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 hover:bg-slate-100 hover:text-indigo-600 transition-colors" title="Edit">✏️</button>
                        <button className="p-2 bg-white border-2 border-b-4 border-slate-800 shadow-sm text-slate-500 hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2 hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Delete">🗑️</button>
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
