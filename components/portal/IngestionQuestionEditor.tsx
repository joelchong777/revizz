import React, { useState, useEffect } from 'react';
import { StagingQuestion, StagingOption } from '@/types/ingestion';
import { QuestionCard } from '@/components/QuestionCard';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { Question, QuestionStatus } from '@/hooks/useQuizGame';

export interface IngestionQuestionEditorProps {
  question: StagingQuestion;
  questionIndex?: number;
  totalQuestions?: number;
  syllabusTopics?: { name: string; order_index: number }[];
  onUpdateQuestion?: (updated: StagingQuestion) => void;
  onChange?: (updated: StagingQuestion) => void;
  onNextQuestion?: () => void;
  onPrevQuestion?: () => void;
}

export function IngestionQuestionEditor({
  question,
  questionIndex = 0,
  totalQuestions = 1,
  syllabusTopics = [],
  onUpdateQuestion,
  onChange,
  onNextQuestion,
  onPrevQuestion,
}: IngestionQuestionEditorProps) {
  const handleUpdate = (updated: StagingQuestion) => {
    if (onUpdateQuestion) onUpdateQuestion(updated);
    if (onChange) onChange(updated);
  };

  // Mobile toggle state
  const [showSimulator, setShowSimulator] = useState(false);
  const [zoomDiagram, setZoomDiagram] = useState(false);

  // Simulator state
  const [simulatorStatus, setSimulatorStatus] = useState<QuestionStatus>('unanswered');
  const [simSelectedOption, setSimSelectedOption] = useState<string | null>(null);
  const [simFirstWrong, setSimFirstWrong] = useState<string | null>(null);

  // Convert to Question format
  const previewQuestion: Question = {
    id: `preview-${question.question_number}`,
    stem_markdown: question.stem_markdown,
    options: question.options.map((opt) => ({
      id: opt.label,
      text_markdown: opt.content_markdown,
    })),
    correct_option_id: question.options.find((o) => o.is_correct)?.label || 'A',
    citation: question.cambridge_source_ref,
    topic: question.topic_name,
  };

  const handleSimAnswer = (optId: string) => {
    if (simulatorStatus === 'answered' || simulatorStatus === 'timeout') return;
    const isCorrect = optId === previewQuestion.correct_option_id;

    if (simulatorStatus === 'unanswered') {
      if (isCorrect) {
        setSimulatorStatus('answered');
        setSimSelectedOption(optId);
      } else {
        setSimulatorStatus('first-wrong');
        setSimFirstWrong(optId);
      }
    } else if (simulatorStatus === 'first-wrong') {
      if (optId === simFirstWrong) return;
      setSimulatorStatus('answered');
      setSimSelectedOption(optId);
    }
  };

  const resetSimulator = () => {
    setSimulatorStatus('unanswered');
    setSimSelectedOption(null);
    setSimFirstWrong(null);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' && onNextQuestion) {
        onNextQuestion();
      } else if (e.key === 'ArrowLeft' && onPrevQuestion) {
        onPrevQuestion();
      } else {
        const key = e.key.toUpperCase();
        if (['1', 'A'].includes(key)) setCorrectOption('A');
        else if (['2', 'B'].includes(key)) setCorrectOption('B');
        else if (['3', 'C'].includes(key)) setCorrectOption('C');
        else if (['4', 'D'].includes(key)) setCorrectOption('D');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextQuestion, onPrevQuestion]);

  const updateField = (field: keyof StagingQuestion, value: any) => {
    handleUpdate({ ...question, [field]: value });
  };

  const updateOption = (idx: number, optField: keyof StagingOption, value: any) => {
    const newOpts = [...question.options];
    newOpts[idx] = { ...newOpts[idx], [optField]: value };
    handleUpdate({ ...question, options: newOpts });
  };

  const setCorrectOption = (label: 'A'|'B'|'C'|'D') => {
    const newOpts = question.options.map(opt => ({
      ...opt,
      is_correct: opt.label === label
    }));
    handleUpdate({ ...question, options: newOpts });
  };

  return (
    <div className="w-full flex flex-col lg:grid lg:grid-cols-2 gap-6 min-h-screen bg-[#f9f4ed] text-[#201e1d] p-4 lg:p-8">
      {/* Mobile Toggle */}
      <div className="lg:hidden flex justify-between items-center mb-4">
        <h2 className="font-heading text-xl">Q{question.question_number}</h2>
        <button
          onClick={() => setShowSimulator(!showSimulator)}
          className="px-4 py-2 bg-accent text-neutral-100 rounded-full font-bold shadow-offset-2 border-2 border-text active:translate-y-0.5 active:shadow-none"
        >
          {showSimulator ? 'Edit Question' : 'Test Simulator'}
        </button>
      </div>

      {/* LEFT: Editor */}
      <div className={cn("flex flex-col gap-6", showSimulator && "hidden lg:flex")}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white border-2 border-text shadow-offset-2 rounded-2xl">
          <div className="flex flex-col">
            <span className="font-bold text-lg">{question.cambridge_source_ref}</span>
            <span className="text-sm text-neutral-600">Question {question.question_number} of {totalQuestions}</span>
          </div>
          <button
            onClick={() => updateField('status', question.status === 'active' ? 'withdrawn' : 'active')}
            className={cn(
              "px-4 py-1.5 rounded-full border-2 border-text font-bold shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-colors",
              question.status === 'active' ? 'bg-accent-2-100 text-accent-2-700' : 'bg-neutral-300'
            )}
          >
            {question.status === 'active' ? 'Complete (Active)' : 'Review (Withdrawn)'}
          </button>
        </div>

        {/* Topic Selector */}
        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase text-sm tracking-wider">Syllabus Topic</label>
          <select
            value={question.topic_name}
            onChange={(e) => updateField('topic_name', e.target.value)}
            className="w-full p-3 rounded-2xl border-2 border-text bg-white shadow-offset-2 outline-none focus:border-accent"
          >
            {syllabusTopics.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stem Editor */}
        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase text-sm tracking-wider">Stem (Markdown + KaTeX)</label>
          <textarea
            value={question.stem_markdown}
            onChange={(e) => updateField('stem_markdown', e.target.value)}
            className="w-full min-h-[120px] p-4 rounded-2xl border-2 border-text bg-white shadow-offset-2 outline-none focus:border-accent resize-y font-mono text-sm"
          />
          <div className="p-4 rounded-2xl border-2 border-text bg-neutral-200 mt-2 min-h-[48px]">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {question.stem_markdown || '*Preview will appear here*'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Diagram Inspector */}
        <div className="flex flex-col gap-2 p-4 rounded-2xl border-2 border-text bg-white shadow-offset-2">
          <div className="flex items-center justify-between">
            <label className="font-bold uppercase text-sm tracking-wider">Diagram</label>
            <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
              <input
                type="checkbox"
                checked={!!question.diagram?.has_diagram}
                onChange={(e) => {
                  updateField('diagram', { ...question.diagram, has_diagram: e.target.checked });
                }}
                className="w-5 h-5 accent-accent"
              />
              Has Diagram
            </label>
          </div>
          {question.diagram?.has_diagram && (
            <div className="flex flex-col gap-3 mt-3">
              <input
                type="text"
                placeholder="Image URL (e.g., /questions/0455_...)"
                value={question.diagram?.image_url || ''}
                onChange={(e) => updateField('diagram', { ...question.diagram, image_url: e.target.value })}
                className="w-full p-2.5 rounded-xl border-2 border-text bg-neutral-100 outline-none"
              />
              {question.diagram?.image_url && (
                <button 
                  type="button"
                  className="relative h-40 w-full rounded-xl border-2 border-text bg-neutral-100 overflow-hidden cursor-zoom-in block"
                  onClick={() => setZoomDiagram(true)}
                >
                  <img 
                    src={question.diagram.image_url} 
                    alt="Diagram Preview" 
                    className="w-full h-full object-contain"
                  />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Options Editor */}
        <div className="flex flex-col gap-4">
          <label className="font-bold uppercase text-sm tracking-wider">Options</label>
          {question.options.map((opt, idx) => (
            <div 
              key={opt.label}
              className={cn(
                "flex flex-col gap-3 p-4 rounded-2xl border-2 shadow-offset-2 transition-colors",
                opt.is_correct ? "bg-[#f0fae1] border-[#8fa073]" : "bg-white border-text"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <button
                  tabIndex={0}
                  onClick={() => setCorrectOption(opt.label as any)}
                  className={cn(
                    "flex-shrink-0 w-10 h-10 rounded-full border-2 border-text flex items-center justify-center font-heading text-lg transition-transform active:scale-95",
                    opt.is_correct ? "bg-accent-2-500 text-neutral-100" : "bg-neutral-200 text-text hover:bg-neutral-300"
                  )}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setCorrectOption(opt.label as any);
                    }
                  }}
                >
                  {opt.label}
                </button>
                <input
                  type="text"
                  value={opt.content_markdown}
                  onChange={(e) => updateOption(idx, 'content_markdown', e.target.value)}
                  className="flex-1 p-2.5 rounded-xl border-2 border-text bg-neutral-100 outline-none font-mono text-sm focus:border-accent"
                  placeholder={`Option ${opt.label} markdown...`}
                />
              </div>
              <div className="pl-14 text-sm break-words min-h-[24px]">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {opt.content_markdown}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <div className="flex flex-col gap-2">
          <label className="font-bold uppercase text-sm tracking-wider">
            Explanation (Concept, Derivation, Distractor Analysis)
          </label>
          <textarea
            value={question.explanation_markdown || ''}
            onChange={(e) => updateField('explanation_markdown', e.target.value)}
            className="w-full min-h-[120px] p-4 rounded-2xl border-2 border-text bg-white shadow-offset-2 outline-none focus:border-accent resize-y font-mono text-sm"
            placeholder={"1. Concept & Economic Principle\n2. Step-by-Step Derivation\n3. Diagnostic Distractor Analysis"}
          />
        </div>
      </div>

      {/* RIGHT: Simulator */}
      <div className={cn("flex flex-col", !showSimulator && "hidden lg:flex")}>
        <div className="sticky top-8 w-full max-w-xl mx-auto flex flex-col gap-4">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border-2 border-text shadow-offset-2">
            <span className="font-bold text-sm">Live Student Simulator</span>
            <button 
              onClick={resetSimulator}
              className="text-xs font-bold px-3 py-1.5 rounded-full border-2 border-text bg-accent-200 hover:bg-accent-300 active:translate-y-0.5 active:shadow-none"
            >
              Reset State
            </button>
          </div>
          
          <div className="bg-[#f9f4ed] rounded-3xl border-4 border-[#201e1d] shadow-[0_16px_0_0_rgba(32,30,29,0.15)] overflow-hidden min-h-[600px] flex flex-col">
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto">
              <QuestionCard
                question={previewQuestion}
                questionNumber={question.question_number}
                totalQuestions={totalQuestions}
                status={simulatorStatus}
                timeLeft={90}
                isTimed={true}
                onAnswer={handleSimAnswer}
                onNext={resetSimulator}
                selectedOptionId={simSelectedOption}
                firstWrongOptionId={simFirstWrong}
                currentStreak={3} // Mock streak for preview
                isEndless={false}
                onFinish={() => {}}
                totalXP={120}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Diagram Modal */}
      {zoomDiagram && question.diagram?.image_url && (
        <div 
          className="fixed inset-0 z-50 bg-text/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setZoomDiagram(false)}
        >
          <div className="max-w-4xl max-h-[90vh] w-full bg-white rounded-3xl border-4 border-text overflow-hidden shadow-[0_16px_0_0_rgba(32,30,29,1)] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b-4 border-text bg-[#f9f4ed]">
              <span className="font-bold text-lg">Diagram Inspector</span>
              <button 
                onClick={() => setZoomDiagram(false)}
                className="w-8 h-8 rounded-full border-2 border-text bg-accent flex items-center justify-center text-neutral-100 hover:bg-accent-600 active:translate-y-0.5"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-neutral-200 flex items-center justify-center">
              <img 
                src={question.diagram.image_url} 
                alt="Diagram Zoom" 
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestionQuestionEditor;
