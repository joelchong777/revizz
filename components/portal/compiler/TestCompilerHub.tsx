'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  X,
  Settings2,
  Download,
  Save,
  Trash2,
  GripVertical,
  FileText,
  Check,
  Zap,
  Filter,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS } from '@/lib/questions';
import { saveTestDraft, listTestDrafts, autoSelectQuestions } from '@/lib/testCompiler';
import { TestPaperConfig } from '@/types/testCompiler';

export default function TestCompilerHub() {
  // --- Left Column State ---
  const [search, setSearch] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [withDiagramsOnly, setWithDiagramsOnly] = useState(false);

  // --- Right Column (Test Config) State ---
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [testTitle, setTestTitle] = useState('Term 1 Mock Assessment - Economics');
  const [schoolName, setSchoolName] = useState('Frontier International Academy');
  const [dateString, setDateString] = useState('October 2026');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [testCode, setTestCode] = useState('REV-0455-M26-001');

  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includeCandidateHeader, setIncludeCandidateHeader] = useState(true);
  const [includeBubbleSheet, setIncludeBubbleSheet] = useState(true);
  const [includeMarkScheme, setIncludeMarkScheme] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Modals State ---
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoCount, setAutoCount] = useState<number>(10);
  const [autoTopicId, setAutoTopicId] = useState<string>('all');

  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<TestPaperConfig[]>([]);

  // --- Derived State ---
  const filteredQuestions = useMemo(() => {
    return CAMBRIDGE_QUESTIONS.filter((q) => {
      const matchSearch =
        q.stem_markdown?.toLowerCase().includes(search.toLowerCase()) ||
        q.id.toLowerCase().includes(search.toLowerCase()) ||
        q.citation?.toLowerCase().includes(search.toLowerCase());
      const matchTopic = selectedTopicId === 'all' || q.topic_id === selectedTopicId;
      const matchDiagram = withDiagramsOnly ? !!q.image_url : true;
      return matchSearch && matchTopic && matchDiagram;
    });
  }, [search, selectedTopicId, withDiagramsOnly]);

  const allFilteredSelected = useMemo(() => {
    if (filteredQuestions.length === 0) return false;
    return filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));
  }, [filteredQuestions, selectedQuestionIds]);

  const selectedQuestions = useMemo(() => {
    return selectedQuestionIds
      .map((id) => CAMBRIDGE_QUESTIONS.find((q) => q.id === id))
      .filter(Boolean) as typeof CAMBRIDGE_QUESTIONS;
  }, [selectedQuestionIds]);

  const estimatedTime = selectedQuestionIds.length * 1.5;

  // --- Handlers ---
  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      return [...prev, id];
    });
  };

  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !filteredQuestions.find((q) => q.id === id)));
    } else {
      const newIds = [...selectedQuestionIds];
      filteredQuestions.forEach((q) => {
        if (!newIds.includes(q.id)) newIds.push(q.id);
      });
      setSelectedQuestionIds(newIds);
    }
  };

  const handleClearSelection = () => setSelectedQuestionIds([]);

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newIds = [...selectedQuestionIds];
      [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
      setSelectedQuestionIds(newIds);
    } else if (direction === 'down' && index < selectedQuestionIds.length - 1) {
      const newIds = [...selectedQuestionIds];
      [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
      setSelectedQuestionIds(newIds);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    const newIds = [...selectedQuestionIds];
    newIds.splice(index, 1);
    setSelectedQuestionIds(newIds);
  };

  const generateConfig = (): TestPaperConfig => {
    return {
      id: Math.random().toString(36).substring(7),
      title: testTitle,
      subjectCode: '0455', // Example
      subjectName: 'Economics',
      schoolName: schoolName,
      durationMinutes: durationMinutes,
      totalMarks: selectedQuestionIds.length,
      testCode: testCode,
      dateString: dateString,
      includeCoverPage: includeCoverPage,
      includeCandidateHeader: includeCandidateHeader,
      includeBubbleSheet: includeBubbleSheet,
      includeMarkScheme: includeMarkScheme,
      questionIds: selectedQuestionIds,
      createdAt: new Date().toISOString(),
    };
  };

  const handleSaveDraft = () => {
    const config = generateConfig();
    saveTestDraft(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleGeneratePDF = () => {
    const config = generateConfig();
    saveTestDraft(config);
    window.open(`/portal/compiler/print?testId=${config.id}`, '_blank');
  };

  const handleAutoCompile = () => {
    const ids = autoSelectQuestions({
      count: autoCount,
      topicIds: autoTopicId === 'all' ? undefined : [autoTopicId],
    });
    setSelectedQuestionIds((prev) => {
      const newIds = [...prev];
      ids.forEach((id) => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      return newIds;
    });
    setIsAutoModalOpen(false);
  };

  const handleOpenDrafts = () => {
    setDrafts(listTestDrafts());
    setIsDraftsModalOpen(true);
  };

  const handleLoadDraft = (draft: TestPaperConfig) => {
    setTestTitle(draft.title);
    setSchoolName(draft.schoolName);
    setDateString(draft.dateString);
    setDurationMinutes(draft.durationMinutes);
    setTestCode(draft.testCode);
    setIncludeCoverPage(draft.includeCoverPage);
    setIncludeCandidateHeader(draft.includeCandidateHeader);
    setIncludeBubbleSheet(draft.includeBubbleSheet);
    setIncludeMarkScheme(draft.includeMarkScheme);
    setSelectedQuestionIds(draft.questionIds);
    setIsDraftsModalOpen(false);
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(`revizz_test_draft_${id}`);
    setDrafts(listTestDrafts());
  };

  return (
    <div className="flex flex-col gap-6 text-[#201e1d] font-body pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
            Question Compiler & Exam Generator 📝
          </h1>
          <p className="text-sm font-medium text-[#645c50] mt-1 max-w-3xl">
            Assemble custom Cambridge IGCSE assessments from our past year question bank, customize exam layout &
            candidate fields, and generate printable A4 exam papers.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAutoModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs font-bold text-[#3d472b] hover:bg-[#e1eecc] active:translate-y-0.5 flex items-center gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" /> Auto-Generate Preset
          </button>
          <button
            onClick={handleOpenDrafts}
            className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Saved Drafts
          </button>
          <button
            onClick={handleClearSelection}
            className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Clear Selection
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-start">
        {/* LEFT COLUMN: Browser */}
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="p-4 rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] shadow-sm flex flex-col gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a]" />
              <input
                type="text"
                placeholder="Search stems, question IDs, citations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm text-[#201e1d] outline-none focus:border-[#c67139]"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap text-sm font-bold">
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="px-3 py-1.5 rounded-full bg-white border-[1.5px] border-[#dcd3c4] outline-none focus:border-[#c67139]"
              >
                <option value="all">All Topics</option>
                {CAMBRIDGE_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setWithDiagramsOnly(!withDiagramsOnly)}
                className={`px-3 py-1.5 rounded-full border-[1.5px] flex items-center gap-1.5 transition-colors ${
                  withDiagramsOnly
                    ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139]'
                    : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                }`}
              >
                <ImageIcon className="w-4 h-4" /> With Diagrams only
              </button>
            </div>
          </div>

          {/* List Header */}
          <div className="flex items-center justify-between px-2">
            <span className="font-bold text-[#645c50] text-sm">{filteredQuestions.length} questions found</span>
            <button
              onClick={handleSelectAllFiltered}
              className="text-xs font-bold text-[#c67139] hover:underline"
            >
              {allFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
            </button>
          </div>

          {/* List Cards */}
          <div className="flex flex-col gap-4">
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#728157] bg-[#f0fae1] shadow-[4px_4px_0_0_#728157] translate-y-[-2px]'
                      : 'border-[#dcd3c4] bg-[#f9f4ed] shadow-sm hover:border-[#a19786]'
                  }`}
                  onClick={() => handleToggleQuestion(q.id)}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md bg-[#201e1d] text-white font-mono text-[10px] font-bold tracking-wider uppercase">
                        {q.citation || q.id}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-[#eee7db] text-[#474238] text-[10px] font-bold">
                        {q.topic}
                      </span>
                      {q.image_url && (
                        <span className="px-2.5 py-1 rounded-md bg-[#ffe1d0] text-[#c67139] text-[10px] font-bold flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" /> Diagram
                        </span>
                      )}
                    </div>
                    <button
                      className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#728157] bg-[#728157] text-white'
                          : 'border-[#c0b6a5] bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="prose prose-sm max-w-none text-[#201e1d] font-medium leading-relaxed mb-4">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {q.stem_markdown || ''}
                    </ReactMarkdown>
                  </div>

                  {q.image_url && (
                    <div className="mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.image_url}
                        alt="Question diagram"
                        className="max-h-32 rounded-lg border-[1.5px] border-[#dcd3c4] object-contain bg-white p-1"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, i) => (
                      <div
                        key={opt.id}
                        className={`px-3 py-2 rounded-xl text-xs flex gap-2 ${
                          opt.id === q.correct_option_id
                            ? 'bg-[#ccdbb2] border border-[#8fa073] font-bold text-[#272e1b]'
                            : 'bg-white border border-[#dcd3c4] text-[#474238]'
                        }`}
                      >
                        <span className="font-bold opacity-70 w-4">{String.fromCharCode(65 + i)}.</span>
                        <div className="flex-1">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {opt.text_markdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredQuestions.length === 0 && (
              <div className="text-center py-12 text-[#645c50] font-bold text-sm">No questions match your filters.</div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Assembly Drawer (Sticky) */}
        <div className="lg:sticky lg:top-6 flex flex-col gap-4">
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] flex flex-col gap-4">
            {/* Summary Header */}
            <div className="flex items-center justify-between border-b-[1.5px] border-[#dcd3c4] pb-4">
              <div>
                <h2 className="font-heading text-xl font-black text-[#201e1d]">Test Assembly</h2>
                <div className="flex gap-3 text-xs font-bold text-[#645c50] mt-1">
                  <span>{selectedQuestionIds.length} Questions</span>
                  <span>•</span>
                  <span>{selectedQuestionIds.length} Marks</span>
                  <span>•</span>
                  <span>~{estimatedTime} mins</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center font-black text-[#201e1d] shadow-offset-2">
                {selectedQuestionIds.length}
              </div>
            </div>

            {/* Collapsible Settings */}
            <div className="flex flex-col gap-3 border-b-[1.5px] border-[#dcd3c4] pb-4">
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="flex items-center justify-between font-bold text-sm text-[#201e1d] w-full"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Layout & Settings
                </div>
                <span>{isSettingsOpen ? '▼' : '▶'}</span>
              </button>

              {isSettingsOpen && (
                <div className="flex flex-col gap-3 mt-1">
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="Test Title"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
                  />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="School Name"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={dateString}
                      onChange={(e) => setDateString(e.target.value)}
                      placeholder="Exam Date"
                      className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
                    />
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                      placeholder="Duration (m)"
                      className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
                    />
                  </div>
                  <input
                    type="text"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="Test Code"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
                  />

                  {/* Layout Toggles */}
                  <div className="flex flex-col gap-2 mt-2">
                    {[
                      { label: 'Cambridge Cover Page', state: includeCoverPage, set: setIncludeCoverPage },
                      { label: 'Candidate Details Header', state: includeCandidateHeader, set: setIncludeCandidateHeader },
                      { label: 'Candidate MCQ Bubble Sheet', state: includeBubbleSheet, set: setIncludeBubbleSheet },
                      { label: 'Teacher Mark Scheme', state: includeMarkScheme, set: setIncludeMarkScheme },
                    ].map((toggle, i) => (
                      <label key={i} className="flex items-center gap-2.5 text-xs text-[#201e1d] cursor-pointer">
                        <button
                          type="button"
                          onClick={() => toggle.set(!toggle.state)}
                          className={`w-8 h-4 shrink-0 rounded-full relative transition-colors ${
                            toggle.state ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                              toggle.state ? 'right-0.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                        <span className="font-bold">{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Questions List */}
            <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-2 no-scrollbar">
              {selectedQuestions.length === 0 ? (
                <div className="text-center py-6 text-[#645c50] text-xs font-medium">
                  No questions selected yet. Add some from the bank.
                </div>
              ) : (
                selectedQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-2 p-2 rounded-xl hover:bg-[#eee7db] transition-colors group"
                  >
                    <span className="w-5 text-center text-xs font-black text-[#645c50] mt-0.5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#201e1d] line-clamp-1">{q.stem_markdown}</div>
                      <div className="text-[10px] text-[#645c50] font-mono mt-0.5">{q.citation || q.id}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 hover:bg-[#dcd3c4] rounded disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        disabled={idx === selectedQuestions.length - 1}
                        className="p-1 hover:bg-[#dcd3c4] rounded disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveQuestion(idx)}
                        className="p-1 hover:bg-[#ffc6a5] text-[#c67139] rounded ml-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t-[1.5px] border-[#dcd3c4]">
              {saveSuccess && (
                <div className="text-[11px] font-bold text-[#56633f] flex items-center justify-center gap-1 mb-1">
                  <Check className="w-3 h-3" /> Draft saved
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDraft}
                  className="flex-1 py-2.5 rounded-full bg-white border-2 border-[#201e1d] font-bold text-xs shadow-[2px_2px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none transition-all"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleGeneratePDF}
                  disabled={selectedQuestions.length === 0}
                  className="flex-[2] py-2.5 rounded-full bg-[#c67139] border-2 border-[#201e1d] text-[#f9f4ed] font-black text-sm shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> PDF / Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Generate Modal */}
      {isAutoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-sm flex flex-col gap-5">
            <h3 className="font-heading text-xl font-black text-[#201e1d]">Auto-Generate Config</h3>
            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-[#645c50]">Number of Questions</label>
              <select
                value={autoCount}
                onChange={(e) => setAutoCount(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm font-bold text-[#201e1d] outline-none"
              >
                {[5, 10, 15, 20, 30].map((c) => (
                  <option key={c} value={c}>
                    {c} Questions
                  </option>
                ))}
              </select>
              <label className="text-xs font-bold text-[#645c50] mt-2">Topic Focus</label>
              <select
                value={autoTopicId}
                onChange={(e) => setAutoTopicId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm font-bold text-[#201e1d] outline-none"
              >
                <option value="all">All Topics (Mixed)</option>
                {CAMBRIDGE_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setIsAutoModalOpen(false)}
                className="flex-1 py-2 rounded-full border-2 border-[#201e1d] font-bold text-xs hover:bg-[#eee7db]"
              >
                Cancel
              </button>
              <button
                onClick={handleAutoCompile}
                className="flex-[2] py-2 rounded-full bg-[#201e1d] text-white font-black text-xs hover:bg-[#3d3a36]"
              >
                Auto-Compile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Modal */}
      {isDraftsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-lg flex flex-col gap-4 max-h-[80vh]">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-xl font-black text-[#201e1d]">Saved Drafts</h3>
              <button onClick={() => setIsDraftsModalOpen(false)} className="p-1 hover:bg-[#dcd3c4] rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar">
              {drafts.length === 0 ? (
                <div className="text-center py-6 text-[#645c50] text-sm font-bold">No saved drafts found.</div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => handleLoadDraft(d)}
                    className="p-3 rounded-2xl border-2 border-[#dcd3c4] bg-white hover:border-[#201e1d] cursor-pointer flex items-center justify-between transition-colors"
                  >
                    <div>
                      <div className="font-bold text-[#201e1d]">{d.title}</div>
                      <div className="text-xs text-[#645c50] mt-0.5">
                        {d.questionIds.length} Questions • {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteDraft(d.id, e)}
                      className="p-2 text-[#c67139] hover:bg-[#ffe1d0] rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
