'use client';

import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  FileText,
  Upload, 
  Eye,
  Edit3,
  Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CAMBRIDGE_QUESTIONS } from '@/lib/questions';
import QuestionQuickPreviewDrawer from './QuestionQuickPreviewDrawer';

export interface QuestionBankViewProps {
  onOpenEditor: (questionId: string) => void;
  onNavigateToCompiler: () => void;
  onNavigateToImporter: () => void;
}

export default function QuestionBankView({
  onOpenEditor,
  onNavigateToCompiler,
  onNavigateToImporter
}: QuestionBankViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [paperFilter, setPaperFilter] = useState<string>('All');
  const [sessionFilter, setSessionFilter] = useState<string>('All');
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('All');
  const [diagramFilter, setDiagramFilter] = useState<string>('All');

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewQuestionId, setPreviewQuestionId] = useState<string | null>(null);

  const questionBankItems = useMemo(() => {
    return CAMBRIDGE_QUESTIONS.map((q, idx) => {
      const qNum = idx + 1;
      let st = 'Live';
      let stCls = 'bg-brand-green text-emerald-950 border-emerald-700';

      if (qNum === 20 || qNum === 27) {
        st = 'Agent draft';
        stCls = 'bg-amber-100 text-amber-900 border-amber-300';
      } else if (qNum === 10 || qNum === 14) {
        st = 'Needs review';
        stCls = 'bg-slate-200 text-slate-800 border-slate-300';
      } else if (qNum === 3 || qNum === 6) {
        st = 'Flagged';
        stCls = 'bg-brand-coral text-rose-950 border-rose-700';
      }

      const difficulties = ['Easy', 'Easy', 'Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Hard', 'Medium', 'Medium', 'Easy', 'Hard', 'Easy', 'Medium', 'Easy', 'Medium', 'Hard', 'Medium', 'Hard', 'Medium', 'Easy', 'Medium', 'Easy', 'Hard', 'Medium', 'Easy', 'Hard', 'Hard', 'Medium', 'Hard'];
      const accuracies = ['86%', '74%', '58%', '81%', '69%', '44%', '62%', '49%', '57%', '51%', '83%', '46%', '79%', '53%', '77%', '65%', '48%', '61%', '43%', '—', '82%', '67%', '76%', '55%', '63%', '88%', '—', '47%', '59%', '52%'];
      const updateDates = ['2 Oct', '2 Oct', '7 Oct', '28 Sep', '28 Sep', 'Today', 'Today', '19 Sep', '2 Oct', '7 Oct', '28 Sep', '19 Sep', '2 Oct', '28 Sep', 'Today', '2 Oct', '19 Sep', '28 Sep', 'Today', 'Today', '2 Oct', '28 Sep', '2 Oct', '19 Sep', '28 Sep', '2 Oct', 'Today', '19 Sep', '28 Sep', '2 Oct'];

      const diff = difficulties[idx] || 'Medium';
      const acc = accuracies[idx] || '65%';
      const upd = updateDates[idx] || '2 Oct';

      const cite = q.citation
        ? q.citation.replace('Cambridge IGCSE Economics ', '').replace('May/June ', 'M/J/').replace('October/November ', 'O/N/').replace('Feb/March ', 'F/M/')
        : `0455/12 M/J/24 Q${qNum}`;
        
      const hasDiagram = q.has_diagram !== false && (q.image_url || q.diagram?.image_url);

      return {
        ...q,
        cite,
        topic: q.topic || 'Economics',
        diff,
        acc,
        st,
        stCls,
        upd,
        hasDiagram
      };
    });
  }, []);

  const filteredItems = useMemo(() => {
    return questionBankItems.filter((q) => {
      const matchSearch = search === '' || q.stem_markdown.toLowerCase().includes(search.toLowerCase()) || q.id.toLowerCase().includes(search.toLowerCase()) || q.cite.toLowerCase().includes(search.toLowerCase()) || q.topic.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || q.st === statusFilter;
      const matchDiff = difficultyFilter === 'All' || q.diff === difficultyFilter;
      const matchTopic = topicFilter === 'All' || q.topic === topicFilter;
      const matchDiag = diagramFilter === 'All' || (diagramFilter === 'With Diagram 🖼️' ? q.hasDiagram : !q.hasDiagram);
      return matchSearch && matchStatus && matchDiff && matchTopic && matchDiag;
    });
  }, [questionBankItems, search, statusFilter, difficultyFilter, topicFilter, diagramFilter]);

  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const newSelected = new Set(selectedIds);
      paginatedItems.forEach(q => newSelected.add(q.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      paginatedItems.forEach(q => newSelected.delete(q.id));
      setSelectedIds(newSelected);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };
  
  const activeFiltersCount = [paperFilter, sessionFilter, topicFilter, difficultyFilter, diagramFilter].filter(f => f !== 'All').length + (search ? 1 : 0);

  const clearAllFilters = () => {
    setSearch('');
    setPaperFilter('All');
    setSessionFilter('All');
    setTopicFilter('All');
    setDifficultyFilter('All');
    setDiagramFilter('All');
  };
  
  const previewQuestion = questionBankItems.find(q => q.id === previewQuestionId);
  const previewIndex = previewQuestion ? filteredItems.findIndex(q => q.id === previewQuestionId) : -1;

  const handleCompileDraft = () => {
    localStorage.setItem('revizz_test_draft_1', JSON.stringify(Array.from(selectedIds)));
    onNavigateToCompiler();
  };

  return (
    <div className="flex flex-col gap-6 text-slate-800 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question bank</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5">
            {questionBankItems.length} questions
          </h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onNavigateToCompiler}
            className="px-3.5 py-2 rounded-xl bg-[#f0fae1] border-2 border-b-4 border-slate-800 text-slate-800 text-sm font-bold shadow-chunky hover:bg-[#e1eecc] active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1.5 transition-all"
          >
            <FileText className="w-4 h-4" /> Compile Test Paper
          </button>
          <button
            onClick={onNavigateToImporter}
            className="px-3.5 py-2 rounded-xl bg-white border-2 border-b-4 border-slate-800 text-slate-800 text-sm font-bold shadow-chunky hover:bg-slate-50 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1.5 transition-all"
          >
            <Upload className="w-4 h-4" /> Import paper (PDF)
          </button>
          <button
            onClick={() => onOpenEditor('new')}
            className="px-4 py-2 rounded-xl bg-brand-indigo border-2 border-b-4 border-slate-800 text-white text-sm font-bold shadow-chunky hover:bg-indigo-400 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" /> New question
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search stems, IDs, citations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border-2 border-slate-800 text-sm font-bold text-slate-900 outline-none focus:border-brand-indigo shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-white border-2 border-slate-800 text-sm font-bold shadow-sm outline-none cursor-pointer">
          <option value="All">Difficulty: All</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        
        <select value={diagramFilter} onChange={e => setDiagramFilter(e.target.value)} className="px-3 py-2 rounded-xl bg-white border-2 border-slate-800 text-sm font-bold shadow-sm outline-none cursor-pointer">
          <option value="All">Diagram: All</option>
          <option value="With Diagram 🖼️">With Diagram 🖼️</option>
          <option value="Text Only">Text Only</option>
        </select>

        {activeFiltersCount > 0 && (
          <button onClick={clearAllFilters} className="text-sm font-bold text-brand-coral hover:underline ml-2">
            Clear all filters
          </button>
        )}
      </div>
      
      <div className="text-sm font-bold text-slate-600">
        Showing {filteredItems.length} of {questionBankItems.length} questions
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 text-sm font-bold border-b-2 border-slate-200">
        {['All', 'Live', 'Agent draft', 'Needs review', 'Flagged'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-t-xl border-2 border-b-0 transition-all ${
              statusFilter === status 
                ? 'bg-amber-50 border-slate-800 text-slate-900 border-b-amber-50 -mb-[2px] z-10' 
                : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
            }`}
          >
            {status} <span className="ml-1 px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs">{status === 'All' ? questionBankItems.length : questionBankItems.filter(q => q.st === status).length}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white border-2 border-slate-800 shadow-chunky-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className="grid grid-cols-[40px_110px_2.5fr_1fr_1fr_0.6fr_0.6fr_0.8fr_80px] gap-3 p-3 bg-slate-100 border-b-2 border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-600 items-center">
              <div className="flex justify-center">
                <input 
                  type="checkbox" 
                  checked={paginatedItems.length > 0 && paginatedItems.every(q => selectedIds.has(q.id))}
                  onChange={handleSelectAll}
                  className="w-4 h-4 cursor-pointer accent-brand-indigo"
                />
              </div>
              <span>ID</span>
              <span>Stem</span>
              <span>Citation</span>
              <span>Topic</span>
              <span>Difficulty</span>
              <span>1st Try</span>
              <span>Status</span>
              <span className="text-center">Actions</span>
            </div>

            <div className="divide-y-2 divide-slate-100">
              {paginatedItems.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setPreviewQuestionId(item.id)}
                  className="grid grid-cols-[40px_110px_2.5fr_1fr_1fr_0.6fr_0.6fr_0.8fr_80px] gap-3 p-3 items-center text-sm hover:bg-amber-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-center" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => toggleSelect(item.id, e as any)}
                      className="w-4 h-4 cursor-pointer accent-brand-indigo"
                    />
                  </div>
                  <span className="font-mono font-bold text-slate-700 truncate" title={item.id}>{item.id}</span>
                  <div className="font-semibold text-slate-900 line-clamp-2 leading-snug">
                    {item.hasDiagram && <span className="mr-1">🖼️</span>}
                    <ReactMarkdown 
                      remarkPlugins={[remarkMath]} 
                      rehypePlugins={[rehypeKatex]} 
                      components={{ p: ({ children }) => <>{children}</> }}
                    >
                      {item.stem_markdown}
                    </ReactMarkdown>
                  </div>
                  <span className="text-slate-600 truncate font-medium" title={item.cite}>{item.cite}</span>
                  <span className="text-slate-600 truncate" title={item.topic}>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-xs font-bold">{item.topic}</span>
                  </span>
                  <span className={`font-bold ${item.diff === 'Easy' ? 'text-brand-green' : item.diff === 'Hard' ? 'text-brand-coral' : 'text-brand-amber'}`}>{item.diff}</span>
                  <span className="font-black text-slate-800">{item.acc}</span>
                  <span>
                    <span className={`px-2 py-0.5 rounded-lg border-2 text-xs font-bold whitespace-nowrap ${item.stCls}`}>
                      {item.st}
                    </span>
                  </span>
                  <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setPreviewQuestionId(item.id)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors" title="Preview">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => onOpenEditor(item.id)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors" title="Edit">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {paginatedItems.length === 0 && (
                <div className="p-8 text-center text-slate-500 font-bold">No questions found matching your filters.</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-3 bg-slate-50 border-t-2 border-slate-800 flex items-center justify-between text-sm font-bold">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Show:</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 rounded-lg border-2 border-slate-800 bg-white cursor-pointer outline-none">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <div className="text-slate-600">
            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredItems.length)}–{Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-lg border-2 border-slate-800 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:translate-y-0.5"
            >
              Prev
            </button>
            <span className="px-2 text-slate-600">Page {currentPage} of {Math.max(1, totalPages)}</span>
            <button 
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-lg border-2 border-slate-800 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:translate-y-0.5"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 border-2 border-slate-800 p-2 pl-4 pr-2 rounded-2xl shadow-[0_8px_0_0_rgba(30,41,59,1)] flex items-center gap-4 text-white font-bold animate-in slide-in-from-bottom-10 fade-in">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-brand-indigo flex items-center justify-center text-xs">{selectedIds.size}</span>
            <span className="text-sm">selected</span>
          </div>
          <div className="h-6 w-0.5 bg-slate-700" />
          <button onClick={handleCompileDraft} className="px-3 py-1.5 rounded-xl bg-[#f0fae1] text-slate-900 hover:bg-[#e1eecc] active:translate-y-0.5 transition-transform flex items-center gap-1 text-sm">
            <FileText className="w-4 h-4" /> Compile into Test Paper
          </button>
          <button className="px-3 py-1.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 active:translate-y-0.5 transition-transform flex items-center gap-1 text-sm">
            <Download className="w-4 h-4" /> Export (JSON)
          </button>
          <div className="h-6 w-0.5 bg-slate-700" />
          <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors" title="Clear selection">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <QuestionQuickPreviewDrawer
        question={previewQuestion}
        isOpen={!!previewQuestionId}
        onClose={() => setPreviewQuestionId(null)}
        onOpenEditor={(id) => {
          setPreviewQuestionId(null);
          onOpenEditor(id);
        }}
        onPrevious={() => {
          if (previewIndex > 0) setPreviewQuestionId(filteredItems[previewIndex - 1].id);
        }}
        onNext={() => {
          if (previewIndex < filteredItems.length - 1) setPreviewQuestionId(filteredItems[previewIndex + 1].id);
        }}
        hasPrevious={previewIndex > 0}
        hasNext={previewIndex < filteredItems.length - 1 && previewIndex >= 0}
      />
    </div>
  );
}
