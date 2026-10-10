import React, { useState } from 'react';
import QuestionCard from '@/components/QuestionCard';
import stagingData from '@/staging/0455_s24_12.json';

interface StagedQuestion {
  id: string;
  stem_markdown: string;
  options: { id: string; text_markdown: string }[];
  correct_option_id: string;
  explanation_markdown: string;
  citation: string;
  topic_id: string;
  topic: string;
  has_diagram: boolean;
  image_url?: string;
  status: 'complete' | 'review';
}

const initialStagedQuestions: StagedQuestion[] = stagingData.questions.map((q) => {
  const options = q.options.map((opt) => ({
    id: `opt-${opt.label.toLowerCase()}`,
    text_markdown: opt.content_markdown,
  }));
  const correctOpt = q.options.find((opt) => opt.is_correct);
  const correct_option_id = correctOpt
    ? `opt-${correctOpt.label.toLowerCase()}`
    : options[0]?.id || 'opt-a';

  return {
    id: `0455-s24-12-q${String(q.question_number).padStart(2, '0')}`,
    stem_markdown: q.stem_markdown,
    options,
    correct_option_id,
    explanation_markdown: q.explanation_markdown || '',
    citation: q.cambridge_source_ref,
    topic_id: q.topic_name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    topic: q.topic_name,
    has_diagram: Boolean(q.diagram?.has_diagram),
    image_url: q.diagram && 'image_url' in q.diagram ? (q.diagram.image_url as string) : undefined,
    status: (q.diagram?.has_diagram ? 'review' : 'complete') as 'complete' | 'review',
  };
});

export default function StagingReview() {
  const [selectedQuestionIdx, setSelectedQuestionIdx] = useState(0);
  const [stagedQuestions, setStagedQuestions] = useState<StagedQuestion[]>(initialStagedQuestions);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);

  const activeQuestion = stagedQuestions[selectedQuestionIdx] || stagedQuestions[0];

  const handleUpdateActiveQuestion = (updatedFields: Partial<StagedQuestion>) => {
    setStagedQuestions((prev) =>
      prev.map((q, i) => (i === selectedQuestionIdx ? { ...q, ...updatedFields } : q))
    );
  };

  const validatedCount = stagedQuestions.filter((q) => q.status === 'complete').length;
  const diagramCount = stagedQuestions.filter((q) => q.has_diagram).length;
  const totalCount = stagedQuestions.length;

  const handleExportJSON = () => {
    const exportData = {
      subject: stagingData.subject,
      paper: stagingData.paper,
      syllabus_topics: stagingData.syllabus_topics,
      questions: stagedQuestions.map((q, idx) => ({
        question_number: idx + 1,
        cambridge_source_ref: q.citation,
        topic_name: q.topic,
        stem_markdown: q.stem_markdown,
        diagram: {
          has_diagram: q.has_diagram,
          image_url: q.image_url,
        },
        options: q.options.map((opt, optIdx) => ({
          label: ['A', 'B', 'C', 'D'][optIdx] || 'A',
          content_markdown: opt.text_markdown,
          is_correct: q.correct_option_id === opt.id,
        })),
        explanation_markdown: q.explanation_markdown,
        status: q.status === 'complete' ? 'active' : 'draft',
      })),
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', '0455_s24_12_staged_reviewed.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePublish = () => {
    const batchId = `BATCH-${stagingData.subject.code}-${stagingData.paper.series.toUpperCase()}${stagingData.paper.year}-${stagingData.paper.paper_code}`;
    setPublishMessage(`Batch ${batchId} approved! All ${totalCount} questions staged to Supabase Live Bank.`);
    setTimeout(() => setPublishMessage(null), 5000);
  };

  if (!activeQuestion) {
    return null;
  }

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {stagingData.subject.name} {stagingData.subject.code}/{stagingData.paper.paper_code}{' '}
              {stagingData.paper.series.toUpperCase()}/{stagingData.paper.year} (Staged)
            </h2>
            <div className="text-sm font-bold text-slate-500 uppercase">
              Batch ID: BATCH-{stagingData.subject.code}-{stagingData.paper.series.toUpperCase()}
              {stagingData.paper.year}-{stagingData.paper.paper_code}
            </div>
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

      {publishMessage && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-900 p-4 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-between">
          <span>🚀 {publishMessage}</span>
          <button
            onClick={() => setPublishMessage(null)}
            className="text-emerald-700 font-bold ml-4 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Navigator List */}
        <div className="lg:col-span-1 bg-white p-4 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky max-h-[800px] overflow-y-auto">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b-2 border-slate-100 pb-2">
            Questions ({totalCount})
          </h3>
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
              <span className="bg-slate-800 text-white px-3 py-1 rounded-lg text-xs font-black">
                {activeQuestion.citation}
              </span>
              <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-lg text-xs font-bold">
                {activeQuestion.topic}
              </span>
            </div>
            <button
              onClick={() =>
                handleUpdateActiveQuestion({
                  status: activeQuestion.status === 'complete' ? 'review' : 'complete',
                })
              }
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Stem (KaTeX supported)
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400"
                  value={activeQuestion.stem_markdown}
                  onChange={(e) => handleUpdateActiveQuestion({ stem_markdown: e.target.value })}
                />
              </div>

              {activeQuestion.has_diagram && activeQuestion.image_url && (
                <div className="p-3 bg-white rounded-xl border-2 border-slate-300 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Extracted Diagram
                  </span>
                  <img
                    src={activeQuestion.image_url}
                    alt="Question Diagram"
                    className="max-h-48 object-contain rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Options</label>
                <div className="space-y-2">
                  {activeQuestion.options.map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                          activeQuestion.correct_option_id === opt.id
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {['A', 'B', 'C', 'D'][i]}
                      </div>
                      <input
                        type="text"
                        className="flex-1 bg-slate-50 border-2 border-slate-300 rounded-lg px-2 py-1 text-sm font-medium outline-none focus:border-indigo-400"
                        value={opt.text_markdown}
                        onChange={(e) => {
                          const newOptions = [...activeQuestion.options];
                          newOptions[i] = { ...newOptions[i], text_markdown: e.target.value };
                          handleUpdateActiveQuestion({ options: newOptions });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Explanation
                </label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border-2 border-slate-800 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 outline-none focus:border-indigo-400"
                  value={activeQuestion.explanation_markdown}
                  onChange={(e) =>
                    handleUpdateActiveQuestion({ explanation_markdown: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Live Preview */}
            <div className="bg-slate-100 p-4 rounded-2xl border-2 border-slate-300 shadow-inner flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest w-full text-center">
                Live Preview
              </div>
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
      <div className="bg-white p-6 rounded-3xl border-2 border-b-4 border-slate-800 shadow-chunky flex flex-col sm:flex-row justify-between items-center gap-4">
        <a
          href="/portal?nav=ingestion"
          className="w-full sm:w-auto px-5 py-3 bg-white text-slate-700 font-bold text-sm rounded-2xl border-2 border-slate-300 hover:bg-slate-50 transition-all text-center"
        >
          Open Ingestion Studio 🛠️
        </a>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            onClick={handleExportJSON}
            className="w-full sm:w-auto px-6 py-3 bg-slate-100 text-slate-700 font-bold text-lg rounded-2xl border-2 border-b-4 border-slate-800 shadow-sm hover:bg-slate-200 active:translate-y-[2px] active:border-b-2 transition-all"
          >
            Export Staging JSON 💾
          </button>
          <button
            onClick={handlePublish}
            className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-[0_4px_0_rgb(67,56,202)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(67,56,202)] active:translate-y-[4px] active:shadow-none transition-all"
          >
            Approve & Publish to Supabase Live 🚀
          </button>
        </div>
      </div>
    </div>
  );
}
