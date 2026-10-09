import React, { useState } from 'react';

export default function TeacherAnalytics() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  const topics = [
    { name: '1. Basic Economic Problem', acc: 85, vol: '1.2k attempts', count: 1200 },
    { name: '2. Allocation of Resources', acc: 72, vol: '2.4k attempts', count: 2400 },
    { name: '3. Microeconomic Decision Makers', acc: 78, vol: '3.1k attempts', count: 3100 },
    { name: '4. Government & Macroeconomy', acc: 45, vol: '2.8k attempts', count: 2800 },
    { name: '5. Economic Development', acc: 60, vol: '1.5k attempts', count: 1500 },
    { name: '6. International Trade', acc: 48, vol: '1.4k attempts', count: 1400 }
  ];

  const students = [
    { name: 'Alex M.', email: 'alex@frontier.edu', type: 'Frontier Students 🎓', xp: '12.4k', streak: '5', review: 14, lastActive: '2 hrs ago' },
    { name: 'Sarah K.', email: 'sarah@frontier.edu', type: 'Frontier Students 🎓', xp: '8.2k', streak: '2', review: 32, lastActive: '5 hrs ago' },
    { name: 'Jordan T.', email: 'jordan@guest.edu', type: 'Guest', xp: '4.1k', streak: '0', review: 8, lastActive: '1 day ago' },
  ];

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || s.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* 4-Column KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase mb-1">Total Students Enrolled</div>
          <div className="text-4xl font-black text-slate-800">142</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase mb-1">Total Questions Attempted</div>
          <div className="text-4xl font-black text-slate-800">12,405</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase mb-1">Cohort Average Accuracy %</div>
          <div className="text-4xl font-black text-green-600">68%</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm">
          <div className="text-slate-500 text-sm font-bold uppercase mb-1">Lowest-Performing Syllabus Topic</div>
          <div className="text-xl font-black text-amber-600 leading-tight">Government & Macroeconomy <span className="text-2xl">⚠️</span></div>
        </div>
      </div>

      {/* Full-Width Class Topic Mastery Heatmap */}
      <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800 mb-6">Class Topic Mastery Heatmap</h2>
        <div className="space-y-6">
          {topics.map((topic, i) => {
            let status = '🔴 Needs Focus';
            let color = 'bg-red-500';
            if (topic.acc >= 75) { status = '🟢 Mastered'; color = 'bg-green-500'; }
            else if (topic.acc >= 50) { status = '🟡 Proficient'; color = 'bg-amber-500'; }
            return (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="w-full md:w-1/4 text-sm font-bold text-slate-700 truncate" title={topic.name}>{topic.name}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden flex relative">
                  <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${topic.acc}%` }} />
                </div>
                <div className="w-20 text-right text-lg font-black text-slate-700">{topic.acc}%</div>
                <div className="w-32 text-sm font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg text-center">{status}</div>
                <div className="w-40 text-right text-sm font-bold text-slate-400">
                  {topic.count} questions ({topic.vol})
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comprehensive Student Roster Table */}
      <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
          <h2 className="text-2xl font-black text-slate-800">Student Roster</h2>
          <div className="flex gap-4">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="All">All Students</option>
              <option value="Frontier Students 🎓">Frontier Students 🎓</option>
            </select>
            <input 
              type="text" 
              placeholder="Search by student name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 w-64 focus:w-80 transition-all outline-none focus:border-indigo-400" 
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-500 font-bold uppercase tracking-wider border-b-2 border-slate-100">
                <th className="pb-4 px-4">Student Name</th>
                <th className="pb-4 px-4">School Email</th>
                <th className="pb-4 px-4">Total XP</th>
                <th className="pb-4 px-4">Current Streak</th>
                <th className="pb-4 px-4">Review Pile</th>
                <th className="pb-4 px-4 text-right">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50 font-medium">
              {filteredStudents.map((s, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-800">{s.name}</td>
                  <td className="py-4 px-4 text-slate-500">{s.email}</td>
                  <td className="py-4 px-4">
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-200 font-bold">⚡ {s.xp}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="bg-orange-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-200 font-bold">🔥 {s.streak}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg border border-rose-200 font-bold">{s.review} unresolved</span>
                  </td>
                  <td className="py-4 px-4 text-right text-slate-400 font-bold">{s.lastActive}</td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most-Missed Questions Grid */}
      <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-sm">
        <h2 className="text-2xl font-black text-slate-800 mb-6">Most-Missed Questions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { text: "What is the primary function of a central bank?", ref: "0455/12 M/J 23 Q14", acc: "22%", wrong: "C: Collect taxes" },
            { text: "In a free market economy, how are prices determined?", ref: "0455/11 O/N 22 Q08", acc: "31%", wrong: "A: Government decree" },
            { text: "Which policy is most likely to reduce cyclical unemployment?", ref: "0455/12 F/M 24 Q21", acc: "35%", wrong: "D: Increasing interest rates" }
          ].map((q, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-50 border-2 border-slate-100 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{q.ref}</div>
                <div className="text-sm font-black text-red-500">{q.acc} Correct</div>
              </div>
              <div className="text-base font-bold text-slate-800 leading-snug flex-1">"{q.text}"</div>
              <div className="text-sm font-bold text-slate-600 bg-white p-4 rounded-xl border-2 border-slate-200">
                Most common mistake: <br/>
                <span className="text-rose-600 text-base">{q.wrong}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
