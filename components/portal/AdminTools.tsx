'use client';
import { authFetch } from '../../lib/authFetch';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  Check, 
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Calendar, 
  Clock, 
  SlidersHorizontal, 
  BookOpen, 
  Upload, 
  Edit3, 
  Trash2,
  FileText,
  Filter,
  Download,
  AlertTriangle,
  RotateCw,
  Tag,
  Flag,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';
import { CompilerDiagramPreview } from './compiler/CompilerDiagramPreview';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { formatTableOptionText } from '@/lib/compilerFilters';
import { 
  useQuestions, 
  useTopics, 
  deleteQuestionsFromDb, 
  updateQuestionsInDb,
  Question
} from '@/lib/questions';
import { fetchSubjectsFromDb } from '@/lib/subjects';
import { attachAnswerKeys } from '@/lib/quizApi';
import {
  BankItemStatus,
  BankDifficulty,
  BankContentFeature,
  EnrichedBankQuestion,
  BankFilterState,
  FilterOptionWithCount,
  ActiveFilterChip,
  DEFAULT_BANK_FILTER_STATE,
  parseCambridgePaperMetadata,
  deriveQuestionStatus,
  deriveQuestionDifficulty,
  detectQuestionFeatures,
  filterBankQuestions,
  computeBankFacetCounts,
  getActiveFilterChips,
  removeActiveFilterChip,
  countActiveBankFilters,
  serializeBankFiltersToQuery,
  parseBankFiltersFromQuery,
} from '@/lib/portal/bankFilters';
import {
  applyMassStatusUpdate,
  applyMassTopicUpdate,
} from '@/lib/portal/massActions';

export type { BankItemStatus };
export const applyMassTopicReassign = applyMassTopicUpdate;

export interface BankQuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  distractorReasoning?: string;
}

export interface QuestionBankItem {
  id: string;
  stem: string;
  cite: string;
  topic: string;
  paper: string;
  session: string;
  diff: 'Easy' | 'Medium' | 'Hard';
  acc: string;
  st: BankItemStatus;
  stCls: string;
  upd: string;
  dbId?: string;
  subjectCode?: string;
  subjectName?: string;
  year?: string;
  season?: string;
  seriesCode?: string;
  variant?: string;
  hasDiagram?: boolean;
  hasTable?: boolean;
  hasMath?: boolean;
  optionsText?: string;
  options?: BankQuestionOption[];
  imageUrl?: string;
  explanationMarkdown?: string;
}

export function getStatusBadgeClass(st: BankItemStatus): string {
  switch (st) {
    case 'Live':
      return 'bg-[#ccdbb2] text-[#272e1b]';
    case 'Agent draft':
      return 'bg-[#f0fae1] text-[#728157]';
    case 'Needs review':
      return 'bg-[#ffe1d0] text-[#c67139]';
    case 'Flagged':
      return 'bg-[#fde8e8] text-[#e0533c]';
    default:
      return 'bg-stone-100 text-stone-700';
  }
}

export function createInitialBankItems(questions: Question[]): QuestionBankItem[] {
  return questions.map((q, idx): QuestionBankItem => {
    const qNum = idx + 1;
    const cite = q.citation || `Q${qNum}`;

    const features = detectQuestionFeatures({
      stem_markdown: q.stem_markdown,
      image_url: q.image_url,
      diagram_metadata: (q as any).diagram_metadata || q.diagram,
      diagram: q.diagram,
      options: q.options?.map((o: any) => ({
        content_markdown: o.content_markdown || o.text_markdown || o.text || '',
      })),
    });

    const meta = parseCambridgePaperMetadata({
      id: q.id,
      cite,
      citation: q.citation,
    });

    const st = deriveQuestionStatus({
      status: (q as any).status,
      active: (q as any).active,
      diagram_metadata: (q as any).diagram_metadata || q.diagram,
      diagram: q.diagram,
    });
    const stCls = getStatusBadgeClass(st);

    const diff = deriveQuestionDifficulty({
      difficulty: (q as any).difficulty || (q as any).diff,
      diagram_metadata: (q as any).diagram_metadata || q.diagram,
      diagram: q.diagram,
      hasDiagram: features.hasDiagram,
      hasTable: features.hasTable,
      hasMath: features.hasMath,
      stem: q.stem_markdown,
    });

    const acc =
      idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';
    const upd = st === 'Live' ? 'Live' : '2d ago';

    const optionsText = q.options
      ?.map((o: any) => o.content_markdown || o.text_markdown || o.text || '')
      .join(' ');

    const parsedOptions: BankQuestionOption[] = (q.options || []).map((o: any, oIdx: number) => {
      const label = o.label || ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
      const text = o.content_markdown || o.text_markdown || o.text || '';
      const isCorrect = typeof o.is_correct === 'boolean'
        ? o.is_correct
        : (q as any).correct_option_id === o.id;
      return {
        id: o.id || `${q.id}-opt-${label.toLowerCase()}`,
        label,
        text,
        isCorrect,
        distractorReasoning: o.distractor_rationale || o.distractor_reasoning || o.explanation,
      };
    });

    return {
      id: q.id,
      stem: q.stem_markdown,
      cite,
      topic: q.topic || 'General',
      paper: meta.paperLabel,
      session: meta.sessionLabel,
      diff,
      acc,
      st,
      stCls,
      upd,
      dbId: q.id,
      subjectCode: meta.subjectCode,
      subjectName: meta.subjectName,
      year: meta.year,
      season: meta.season,
      seriesCode: meta.seriesCode,
      variant: meta.variant,
      hasDiagram: features.hasDiagram,
      hasTable: features.hasTable,
      hasMath: features.hasMath,
      optionsText,
      options: parsedOptions,
      imageUrl: resolveDiagramUrl(q.image_url || (q.diagram as any)?.image_url || (q as any).diagram_metadata?.image_url || (q as any).diagram_metadata?.storage_path) || q.image_url || (q.diagram as any)?.image_url || (q as any).diagram_metadata?.image_url,
      explanationMarkdown: (q as any).explanation_markdown || (q as any).explanation,
    };
  });
}

export interface TeacherQuestionAnnotation {
  classroomTags: string[];
  teacherNote: string;
  flaggedForAdmin?: boolean;
  flagReason?: string;
}

export const TEACHER_ANNOTATION_STORAGE_KEY = 'revizz_teacher_question_annotations';

export interface AdminToolsProps {
  initialView?: 'assign' | 'bank' | 'importer';
  onOpenEditor?: (questionId: string) => void;
  portalMode?: 'teacher' | 'admin';
}

export interface BankFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface BankFilterDropdownProps {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  options: BankFilterOption[];
  minWidth?: string;
  multiSelect?: boolean;
  selectedValues?: string[];
  onMultiChange?: (values: string[]) => void;
}

export function BankFilterDropdown({
  label,
  value,
  onChange,
  options,
  minWidth = 'min-w-[180px]',
  multiSelect = false,
  selectedValues = [],
  onMultiChange,
}: BankFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMultiActive = multiSelect && selectedValues.length > 0;
  const isSingleActive = !multiSelect && value !== undefined && value !== 'All' && value !== '';
  const isActive = isMultiActive || isSingleActive;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  let displayLabel = label;
  if (multiSelect) {
    if (selectedValues.length === 1) {
      displayLabel = `${label}: ${selectedValues[0]}`;
    } else if (selectedValues.length > 1) {
      displayLabel = `${label} (${selectedValues.length})`;
    }
  } else if (isSingleActive) {
    displayLabel = `${label}: ${value}`;
  }

  const handleSelectOption = (optValue: string) => {
    if (multiSelect) {
      if (optValue === 'All') {
        onMultiChange?.([]);
      } else {
        const next = selectedValues.includes(optValue)
          ? selectedValues.filter((v) => v !== optValue)
          : [...selectedValues, optValue];
        onMultiChange?.(next);
      }
    } else {
      onChange?.(optValue);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
          isActive
            ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold shadow-sm'
            : 'bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
        }`}
        aria-expanded={isOpen}
      >
        <span className="truncate max-w-[180px]">{displayLabel}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          } ${isActive ? 'text-[#c67139]' : 'text-[#645c50]'}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full mt-1.5 left-0 z-50 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-2xl p-1.5 ${minWidth} max-h-60 overflow-y-auto`}
          >
            {multiSelect && (
              <div className="px-2 py-1 mb-1 border-b border-[#e8decb] flex items-center justify-between text-[11px] font-bold text-[#645c50]">
                <span>Select multiple</span>
                {selectedValues.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onMultiChange?.([])}
                    className="text-[#c67139] hover:underline cursor-pointer"
                  >
                    Reset to All
                  </button>
                )}
              </div>
            )}
            {options.every((opt) => opt.value === 'All') && (
              <div className="px-3 py-2 text-xs font-semibold text-[#645c50]">No options yet</div>
            )}
            {options.filter((opt) => opt.value !== 'All' || options.length > 1).map((opt) => {
              const isSelected = multiSelect
                ? opt.value === 'All'
                  ? selectedValues.length === 0
                  : selectedValues.includes(opt.value)
                : value === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelectOption(opt.value)}
                  className={`w-full text-left rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-[#ffe1d0]/70' : ''
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    {opt.count !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-[#c67139] text-[#f9f4ed]' : 'bg-[#e8decb] text-[#645c50]'
                        }`}
                      >
                        {opt.count}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#c67139] shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AdminTools({ 
  initialView = 'assign',
  onOpenEditor,
  portalMode = 'admin',
}: AdminToolsProps) {
  const isTeacherMode = portalMode === 'teacher';
  const { questions: dbQuestions, loading: questionsLoading, refetch: refetchQuestions } = useQuestions();
  const { topics: dbTopics } = useTopics();
  const [activeSubTab, setActiveSubTab] = useState<'assign' | 'bank' | 'importer'>(initialView);

  useEffect(() => {
    if (initialView) {
      setActiveSubTab(initialView);
    }
  }, [initialView]);

  // Homework Assigner State (2c)
  const [aiPrompt, setAiPrompt] = useState('Build a homework round on weakest subtopics');
  const [selectedClass, setSelectedClass] = useState('No cohorts registered');
  const [subject, setSubject] = useState('No subjects registered');

  useEffect(() => {
    let mounted = true;
    fetchSubjectsFromDb().then((subjects) => {
      if (!mounted) return;
      if (subjects && subjects.length > 0) {
        setSubject(`${subjects[0].name} ${subjects[0].code}`);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  const [topics, setTopics] = useState<string[]>([]);
  const [roundLength, setRoundLength] = useState<number | 'Custom'>(8);
  const [timerMode, setTimerMode] = useState<'Chill' | 'Exam'>('Exam');
  const [opensDate, setOpensDate] = useState('Mon 12 Oct · 08:00');
  const [dueDate, setDueDate] = useState('Fri 16 Oct · 18:00');
  const [retryCredited, setRetryCredited] = useState(true);
  const [addToReviewPile, setAddToReviewPile] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [scheduledSuccess, setScheduledSuccess] = useState(false);

  // Question Bank Stateful Data (2f) & Live Supabase Questions
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [liveQuestions, setLiveQuestions] = useState<any[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingJson, setIsUploadingJson] = useState(false);

  // Assigned Questions Dataset
  const assignQs = useMemo(() => {
    if (liveQuestions && liveQuestions.length > 0) {
      const filtered = isTeacherMode
        ? liveQuestions.filter((q) => !q.status || q.status === 'active' || q.status === 'Live')
        : liveQuestions;
      return filtered.map((q) => {
        const topicObj = Array.isArray(q.topic) ? q.topic[0] : q.topic;
        return {
          id: q.cambridge_source_ref || q.id,
          stem: q.stem_markdown,
          topic: topicObj?.name || 'General',
          acc: '—',
          agent: false,
        };
      });
    }
    const source = (dbQuestions || []).map((q) => ({
      id: q.id,
      stem: q.stem_markdown,
      topic: q.topic || 'General',
      acc: '—',
      agent: false,
      status: (q as any).status,
    }));
    const filteredSource = isTeacherMode
      ? source.filter((q: any) => !q.status || q.status === 'active' || q.status === 'Live')
      : source;
    return filteredSource;
  }, [liveQuestions, dbQuestions, isTeacherMode]);

  const fetchLiveQuestions = async () => {
    setIsLoadingLive(true);
    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          question_number,
          stem_markdown,
          image_url,
          cambridge_source_ref,
          active,
          status,
          difficulty,
          created_at,
          diagram_metadata,
          paper:papers (
            series,
            paper_code,
            year
          ),
          subject:subjects (
            code,
            name
          ),
          topic:topics (
            id,
            name
          ),
          options:question_options (
            id,
            label,
            content_markdown
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Answer keys are hidden from direct selects: merge them in from the staff-only endpoint.
        let merged: any[] = data;
        try {
          const keyed = await attachAnswerKeys(
            data.map((row: any) => ({
              id: row.id,
              stem_markdown: row.stem_markdown || '',
              options: (row.options || []).map((o: any) => ({ id: o.id, label: o.label, text_markdown: o.content_markdown || '' })),
            }))
          );
          const byId = new Map(keyed.map((k) => [k.id, k]));
          merged = data.map((row: any) => {
            const k = byId.get(row.id);
            if (!k || !k.correct_option_id) return row;
            return {
              ...row,
              explanation_markdown: k.explanation_markdown ?? row.explanation_markdown,
              options: (row.options || []).map((o: any) => {
                const ko = k.options.find((x) => x.id === o.id);
                return {
                  ...o,
                  is_correct: o.id === k.correct_option_id,
                  distractor_reasoning: ko?.distractor_reasoning ?? o.distractor_reasoning,
                };
              }),
            };
          });
        } catch {
          // Keep the rows without keys.
        }
        setLiveQuestions(merged);
      } else {
        // Fallback to empty or null
        setLiveQuestions([]);
      }
    } catch (err) {
      console.warn('Error fetching live questions from Supabase, using fallback:', err);
      setLiveQuestions([]);
    } finally {
      setIsLoadingLive(false);
    }
  };

  useEffect(() => {
    fetchLiveQuestions();
  }, []);

  useEffect(() => {
    if (liveQuestions && liveQuestions.length > 0) {
      const items: QuestionBankItem[] = liveQuestions.map((q, idx) => {
        const paperObj = Array.isArray(q.paper) ? q.paper[0] : q.paper;
        const subjectObj = Array.isArray(q.subject) ? q.subject[0] : q.subject;
        const topicObj = Array.isArray(q.topic) ? q.topic[0] : q.topic;

        const cite =
          q.cambridge_source_ref ||
          (paperObj
            ? `${subjectObj?.code || '0455'}/${paperObj.paper_code} ${paperObj.series} ${paperObj.year} Q${q.question_number}`
            : 'Cambridge Question');

        const features = detectQuestionFeatures({
          stem_markdown: q.stem_markdown,
          image_url: q.image_url,
          diagram_metadata: q.diagram_metadata,
          options: q.options,
        });

        const meta = parseCambridgePaperMetadata({
          id: q.id,
          cite,
          subjectCode: subjectObj?.code,
          subjectName: subjectObj?.name,
          paperCode: paperObj?.paper_code,
          series: paperObj?.series,
          year: paperObj?.year,
        });

        const st = deriveQuestionStatus({
          status: q.status,
          active: q.active,
          diagram_metadata: q.diagram_metadata,
        });
        const stCls = getStatusBadgeClass(st);

        const diff = deriveQuestionDifficulty({
          difficulty: q.difficulty,
          diagram_metadata: q.diagram_metadata,
          hasDiagram: features.hasDiagram,
          hasTable: features.hasTable,
          hasMath: features.hasMath,
          stem: q.stem_markdown,
        });

        const optionsText = Array.isArray(q.options)
          ? q.options
              .map((o: any) => o.content_markdown || o.text_markdown || o.text || '')
              .join(' ')
          : undefined;

        const parsedOptions: BankQuestionOption[] = (Array.isArray(q.options) ? q.options : []).map((o: any, oIdx: number) => {
          const label = o.label || ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
          const text = o.content_markdown || o.text_markdown || o.text || '';
          const isCorrect = typeof o.is_correct === 'boolean'
            ? o.is_correct
            : (q as any).correct_option_id === o.id;
          return {
            id: o.id || `${q.id}-opt-${label.toLowerCase()}`,
            label,
            text,
            isCorrect,
            distractorReasoning: o.distractor_rationale || o.distractor_reasoning || o.explanation,
          };
        });

        const paper = meta.paperLabel;
        const session = meta.sessionLabel;
        const upd = st === 'Live' ? 'Live' : '2d ago';
        const acc =
          idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';

        return {
          id: q.cambridge_source_ref || q.id,
          stem: q.stem_markdown,
          cite,
          topic: topicObj?.name || 'Economics',
          paper,
          session,
          diff,
          acc,
          st,
          stCls,
          upd,
          dbId: q.id,
          subjectCode: meta.subjectCode,
          subjectName: meta.subjectName,
          year: meta.year,
          season: meta.season,
          seriesCode: meta.seriesCode,
          variant: meta.variant,
          hasDiagram: features.hasDiagram,
          hasTable: features.hasTable,
          hasMath: features.hasMath,
          optionsText,
          options: parsedOptions,
          imageUrl: resolveDiagramUrl(q.image_url || q.diagram_metadata?.image_url || q.diagram_metadata?.storage_path) || q.image_url || q.diagram_metadata?.image_url,
          explanationMarkdown: q.explanation_markdown,
        };
      });
      setBankQuestions(items);
    } else if (!isLoadingLive) {
      if (!questionsLoading) {
        setBankQuestions(createInitialBankItems(dbQuestions || []));
      }
    }
  }, [liveQuestions, isLoadingLive, dbQuestions, questionsLoading]);

  const questionBankItems = bankQuestions;

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingJson(true);
    try {
      const text = await file.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        alert('Invalid JSON file format. Please upload a valid Cambridge JSON paper.');
        return;
      }

      const payload = json && typeof json === 'object' && json.paper ? json : { paper: json };
      const res = await authFetch('/api/ingest/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Publish failed: ${data.error || 'Unknown error occurred while publishing paper.'}`);
      } else {
        alert(`Successfully published paper! ${data.questions_count ?? 0} questions imported.`);
        showNotification(`Successfully imported ${data.questions_count ?? ''} questions!`);
        await fetchLiveQuestions();
        refetchQuestions();
      }
    } catch (err: any) {
      console.error('Error uploading JSON:', err);
      alert(`Failed to upload JSON: ${err?.message || err}`);
    } finally {
      setIsUploadingJson(false);
      if (e.target) e.target.value = '';
    }
  };

  // Mass Selection & Action States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const topicDropdownRef = useRef<HTMLDivElement>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [topicDropdownOpen, setTopicDropdownOpen] = useState(false);

  interface ConfirmationModalState {
    isOpen: boolean;
    type: 'delete' | 'status' | 'topic';
    payload?: string;
    singleId?: string;
  }

  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    type: 'delete',
  });

  const [notification, setNotification] = useState<string | null>(null);
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (msg: string) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setNotification(msg);
    notificationTimerRef.current = setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Teacher Classroom Annotations State & Inline Inputs
  const [teacherAnnotations, setTeacherAnnotations] = useState<Record<string, TeacherQuestionAnnotation>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(TEACHER_ANNOTATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      console.error('Failed to parse teacher question annotations:', err);
      return {};
    }
  });

  const [tagInput, setTagInput] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [flagReasonInput, setFlagReasonInput] = useState<string>('');
  const [showFlagForm, setShowFlagForm] = useState<boolean>(false);

  useEffect(() => {
    if (expandedQuestionId) {
      const existing = teacherAnnotations[expandedQuestionId];
      setNoteDraft(existing?.teacherNote || '');
      setTagInput('');
      setFlagReasonInput(existing?.flagReason || '');
      setShowFlagForm(false);
    } else {
      setNoteDraft('');
      setTagInput('');
      setFlagReasonInput('');
      setShowFlagForm(false);
    }
  }, [expandedQuestionId]);

  const saveTeacherAnnotations = (newAnnotations: Record<string, TeacherQuestionAnnotation>) => {
    setTeacherAnnotations(newAnnotations);
    try {
      localStorage.setItem(TEACHER_ANNOTATION_STORAGE_KEY, JSON.stringify(newAnnotations));
    } catch (err) {
      console.error('Failed to save teacher question annotations:', err);
    }
  };

  const handleAddClassroomTag = (questionId: string, tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    const current = teacherAnnotations[questionId] || { classroomTags: [], teacherNote: '' };
    if (current.classroomTags.includes(trimmed)) {
      showNotification(`Tag "${trimmed}" already added`);
      setTagInput('');
      return;
    }
    const updated = {
      ...teacherAnnotations,
      [questionId]: {
        ...current,
        classroomTags: [...current.classroomTags, trimmed],
      },
    };
    saveTeacherAnnotations(updated);
    setTagInput('');
    showNotification(`Added classroom tag: #${trimmed}`);
  };

  const handleRemoveClassroomTag = (questionId: string, tag: string) => {
    const current = teacherAnnotations[questionId];
    if (!current) return;
    const updated = {
      ...teacherAnnotations,
      [questionId]: {
        ...current,
        classroomTags: current.classroomTags.filter((t) => t !== tag),
      },
    };
    saveTeacherAnnotations(updated);
    showNotification(`Removed classroom tag: #${tag}`);
  };

  const handleSaveTeacherNote = (questionId: string, note: string) => {
    const current = teacherAnnotations[questionId] || { classroomTags: [], teacherNote: '' };
    const updated = {
      ...teacherAnnotations,
      [questionId]: {
        ...current,
        teacherNote: note,
      },
    };
    saveTeacherAnnotations(updated);
    showNotification('Saved classroom note');
  };

  const handleFlagForAdmin = (questionId: string, reason: string) => {
    const current = teacherAnnotations[questionId] || { classroomTags: [], teacherNote: '' };
    const updated = {
      ...teacherAnnotations,
      [questionId]: {
        ...current,
        flaggedForAdmin: true,
        flagReason: reason.trim() || 'Flagged by educator for review',
      },
    };
    saveTeacherAnnotations(updated);
    setShowFlagForm(false);
    showNotification('Flagged question for App Admin review');
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
      if (
        topicDropdownRef.current &&
        !topicDropdownRef.current.contains(e.target as Node)
      ) {
        setTopicDropdownOpen(false);
      }
    };
    if (statusDropdownOpen || topicDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen, topicDropdownOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmationModal.isOpen) {
          setConfirmationModal({ isOpen: false, type: 'delete' });
        }
        if (statusDropdownOpen) setStatusDropdownOpen(false);
        if (topicDropdownOpen) setTopicDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmationModal.isOpen, statusDropdownOpen, topicDropdownOpen]);

  // Question Bank Filter State & URL Synchronization
  const [bankFilters, setBankFilters] = useState<BankFilterState>(DEFAULT_BANK_FILTER_STATE);
  const [knownSubjects, setKnownSubjects] = useState<Array<{ code: string; name: string }>>([]);

  // Compatibility getters and aliases for test suites and external integrations
  const bankSearch = bankFilters.search;
  const setBankSearch = (q: string) => setBankFilters((prev) => ({ ...prev, search: q, page: 1 }));
  const bankStatusFilter = bankFilters.status;
  const setBankStatusFilter = (st: string) => setBankFilters((prev) => ({ ...prev, status: st, page: 1 }));
  const bankPaperFilter = bankFilters.paper;
  const setBankPaperFilter = (p: string) => setBankFilters((prev) => ({ ...prev, paper: p, papers: p !== 'All' ? [p] : [], page: 1 }));
  const bankSessionFilter = bankFilters.session;
  const setBankSessionFilter = (s: string) => setBankFilters((prev) => ({ ...prev, session: s, page: 1 }));
  const bankTopicFilter = bankFilters.topic;
  const setBankTopicFilter = (t: string) => setBankFilters((prev) => ({ ...prev, topic: t, page: 1 }));
  const bankDifficultyFilter = bankFilters.difficulty;
  const setBankDifficultyFilter = (d: string) => setBankFilters((prev) => ({ ...prev, difficulty: d, page: 1 }));

  useEffect(() => {
    let mounted = true;
    fetchSubjectsFromDb().then((subjectsList) => {
      if (!mounted) return;
      if (subjectsList && subjectsList.length > 0) {
        setKnownSubjects(subjectsList.map((s) => ({ code: s.code, name: s.name })));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize filter state from URL search params on client mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search) {
      const fromUrl = parseBankFiltersFromQuery(window.location.search);
      if (
        fromUrl.search ||
        fromUrl.subject !== 'All' ||
        fromUrl.year !== 'All' ||
        fromUrl.season !== 'All' ||
        fromUrl.variant !== 'All' ||
        fromUrl.paper !== 'All' ||
        (fromUrl.papers && fromUrl.papers.length > 0) ||
        fromUrl.session !== 'All' ||
        fromUrl.topic !== 'All' ||
        (fromUrl.topics && fromUrl.topics.length > 0) ||
        fromUrl.difficulty !== 'All' ||
        (fromUrl.difficulties && fromUrl.difficulties.length > 0) ||
        fromUrl.status !== 'All' ||
        (fromUrl.features && fromUrl.features.length > 0) ||
        fromUrl.page > 1
      ) {
        setBankFilters(fromUrl);
      }
    }
  }, []);

  // Synchronize bankFilters to URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentParams = new URLSearchParams(window.location.search);
    const tab = currentParams.get('tab') || 'bank';
    const serialized = serializeBankFiltersToQuery(bankFilters);
    const nextParams = new URLSearchParams(serialized);
    if (tab) {
      nextParams.set('tab', tab);
    }
    const newQueryString = nextParams.toString();
    const newUrl = `${window.location.pathname}${newQueryString ? `?${newQueryString}` : ''}`;
    window.history.replaceState(null, '', newUrl);
  }, [bankFilters]);

  const topicOptions = useMemo(() => {
    if (!dbTopics || dbTopics.length === 0) {
      return [{ value: 'None', label: 'None' }];
    }
    return dbTopics.map((t) => ({ value: t.name, label: t.name }));
  }, [dbTopics]);

  const knownTopicNames = useMemo(() => {
    return (dbTopics || []).map((t) => t.name);
  }, [dbTopics]);

  const baseBankQuestions = useMemo(
    () => (isTeacherMode ? bankQuestions.filter((q) => q.st === 'Live') : bankQuestions),
    [bankQuestions, isTeacherMode]
  );

  const facetCounts = useMemo(() => {
    return computeBankFacetCounts(
      baseBankQuestions as EnrichedBankQuestion[],
      knownTopicNames,
      knownSubjects
    );
  }, [baseBankQuestions, knownTopicNames, knownSubjects]);

  const featureCounts = useMemo(() => {
    const map: Record<string, number> = { diagram: 0, table: 0, math: 0 };
    if (facetCounts.features) {
      facetCounts.features.forEach((f) => {
        map[f.value] = f.count;
      });
    }
    return map;
  }, [facetCounts.features]);

  const filteredBankItems: QuestionBankItem[] = useMemo(() => {
    return filterBankQuestions(
      baseBankQuestions as unknown as EnrichedBankQuestion[],
      bankFilters
    ) as unknown as QuestionBankItem[];
  }, [baseBankQuestions, bankFilters]);

  const activeFilterChips = useMemo(() => {
    return getActiveFilterChips(bankFilters);
  }, [bankFilters]);

  const handleRemoveChip = (chip: ActiveFilterChip) => {
    setBankFilters((prev) => removeActiveFilterChip(prev, chip));
  };

  const handleClearAllFilters = () => {
    setBankFilters(DEFAULT_BANK_FILTER_STATE);
  };

  const toggleFeature = (feat: BankContentFeature) => {
    setBankFilters((prev) => {
      const current = prev.features || [];
      const nextFeatures = current.includes(feat)
        ? current.filter((f) => f !== feat)
        : [...current, feat];
      return { ...prev, features: nextFeatures, page: 1 };
    });
  };

  const reassignTopicOptions = useMemo(() => {
    const fromBank = Array.from(new Set(bankQuestions.map((q) => q.topic).filter(Boolean)));
    if (!dbTopics || dbTopics.length === 0) {
      if (fromBank.length === 0) {
        return [];
      }
      return fromBank;
    }
    const list = dbTopics.map((t) => t.name);
    return Array.from(new Set([...list, ...fromBank]));
  }, [dbTopics, bankQuestions]);

  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(filteredBankItems.length / pageSize));
  const bankPage = Math.min(Math.max(1, bankFilters.page || 1), totalPages);

  const setBankPage = (newPageOrFn: number | ((prev: number) => number)) => {
    setBankFilters((prev) => {
      const curr = prev.page || 1;
      const target = typeof newPageOrFn === 'function' ? newPageOrFn(curr) : newPageOrFn;
      return { ...prev, page: Math.max(1, Math.min(totalPages, target)) };
    });
  };

  const paginatedBankItems = filteredBankItems.slice(
    (bankPage - 1) * pageSize,
    bankPage * pageSize
  );

  useEffect(() => {
    if ((bankFilters.page || 1) > totalPages) {
      setBankFilters((prev) => ({ ...prev, page: totalPages }));
    }
  }, [totalPages, bankFilters.page]);

  // Master Checkbox State
  const allCurrentPageSelected =
    paginatedBankItems.length > 0 &&
    paginatedBankItems.every((q) => selectedIds.has(q.id));
  const someCurrentPageSelected =
    paginatedBankItems.some((q) => selectedIds.has(q.id));
  const isIndeterminate = someCurrentPageSelected && !allCurrentPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allCurrentPageSelected) {
        paginatedBankItems.forEach((q) => next.delete(q.id));
      } else {
        paginatedBankItems.forEach((q) => next.add(q.id));
      }
      return next;
    });
  };

  const handleSelectAllMatching = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredBankItems.forEach((q) => next.add(q.id));
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Confirmation Modal and Mass Execution
  const selectedItemsPreview = useMemo(() => {
    return bankQuestions.filter((q) => selectedIds.has(q.id));
  }, [bankQuestions, selectedIds]);

  const modalCount =
    confirmationModal.type === 'delete' && confirmationModal.singleId
      ? 1
      : selectedIds.size;

  const modalPreviewItems = useMemo(() => {
    if (confirmationModal.type === 'delete' && confirmationModal.singleId) {
      return bankQuestions.filter((q) => q.id === confirmationModal.singleId);
    }
    return selectedItemsPreview;
  }, [confirmationModal, bankQuestions, selectedItemsPreview]);

  const handleOpenConfirmModal = (type: 'delete' | 'status' | 'topic', payload?: string, singleId?: string) => {
    setConfirmationModal({
      isOpen: true,
      type,
      payload,
      singleId,
    });
  };

  const handleOpenDeleteSingle = (id: string) => {
    setConfirmationModal({
      isOpen: true,
      type: 'delete',
      singleId: id,
      payload: id,
    });
  };

  const handleConfirmMassAction = () => {
    const idsToDelete =
      confirmationModal.type === 'delete' && confirmationModal.singleId
        ? [confirmationModal.singleId]
        : Array.from(selectedIds);

    const count = confirmationModal.type === 'delete' ? idsToDelete.length : selectedIds.size;
    if (count === 0) {
      setConfirmationModal({ isOpen: false, type: 'delete' });
      return;
    }

    if (confirmationModal.type === 'delete') {
      const idsSet = new Set(idsToDelete);

      // Optimistically update bankQuestions (filtering out deleted IDs) and clamp bankPage
      setBankQuestions((prev) => {
        const updated = confirmationModal.singleId
          ? prev.filter((q) => !idsSet.has(q.id))
          : prev.filter((q) => !selectedIds.has(q.id));
        const newMaxPage = Math.max(1, Math.ceil(updated.length / pageSize));
        setBankPage((p) => Math.min(p, newMaxPage));
        return updated;
      });

      // Clear selectedIds and close confirmation modal
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });
      setConfirmationModal({ isOpen: false, type: 'delete' });

      // Feedback notification
      showNotification(`Deleted ${count} question${count === 1 ? '' : 's'} from Question Bank & Supabase`);

      // Asynchronously delete from Supabase and sync
      (async () => {
        try {
          const idsToDeleteInDb = idsToDelete.map((id) => {
            const found = bankQuestions.find((q) => q.id === id);
            return found?.dbId || id;
          });
          const res = await deleteQuestionsFromDb(idsToDeleteInDb);
          if (!res.success) {
            showNotification(`Failed to delete question(s) from Supabase: ${res.error || 'Unknown error'}`);
            await fetchLiveQuestions();
          } else {
            // On successful deletion, sync live questions
            await fetchLiveQuestions();
            refetchQuestions();
          }
        } catch (err: any) {
          showNotification(`Failed to delete question(s) from Supabase: ${err?.message || 'Unknown error'}`);
          await fetchLiveQuestions();
        }
      })();
    } else if (confirmationModal.type === 'status') {
      const newStatus = confirmationModal.payload as BankItemStatus;
      const targetIds = Array.from(selectedIds);
      const dbIdsToUpdate = targetIds.map((id) => {
        const found = bankQuestions.find((q) => q.id === id);
        return found?.dbId || id;
      });

      const { updatedItems } = applyMassStatusUpdate(
        bankQuestions,
        selectedIds,
        newStatus,
        getStatusBadgeClass(newStatus)
      );
      setBankQuestions(updatedItems as QuestionBankItem[]);
      setSelectedIds(new Set());
      setConfirmationModal({ isOpen: false, type: 'delete' });
      showNotification(`Updated status to "${newStatus}" for ${count} question${count === 1 ? '' : 's'}`);

      (async () => {
        try {
          const res = await updateQuestionsInDb(dbIdsToUpdate, { status: newStatus });
          if (!res.success) {
            showNotification(`Failed to persist status to Supabase: ${res.error || 'Unknown error'}`);
            await fetchLiveQuestions();
          } else {
            await fetchLiveQuestions();
            refetchQuestions();
          }
        } catch (err: any) {
          showNotification(`Failed to persist status to Supabase: ${err?.message || 'Unknown error'}`);
          await fetchLiveQuestions();
        }
      })();
    } else if (confirmationModal.type === 'topic') {
      const newTopic = confirmationModal.payload as string;
      const targetIds = Array.from(selectedIds);
      const dbIdsToUpdate = targetIds.map((id) => {
        const found = bankQuestions.find((q) => q.id === id);
        return found?.dbId || id;
      });

      const { updatedItems } = applyMassTopicUpdate(
        bankQuestions,
        selectedIds,
        newTopic
      );
      setBankQuestions(updatedItems as QuestionBankItem[]);
      setSelectedIds(new Set());
      setConfirmationModal({ isOpen: false, type: 'delete' });
      showNotification(`Reassigned topic to "${newTopic}" for ${count} question${count === 1 ? '' : 's'}`);

      (async () => {
        try {
          const res = await updateQuestionsInDb(dbIdsToUpdate, { topicName: newTopic });
          if (!res.success) {
            showNotification(`Failed to persist topic to Supabase: ${res.error || 'Unknown error'}`);
            await fetchLiveQuestions();
          } else {
            await fetchLiveQuestions();
            refetchQuestions();
          }
        } catch (err: any) {
          showNotification(`Failed to persist topic to Supabase: ${err?.message || 'Unknown error'}`);
          await fetchLiveQuestions();
        }
      })();
    }
  };

  const executeConfirmedMassAction = handleConfirmMassAction;

  const handleExportSelected = () => {
    const selected = bankQuestions.filter((q) => selectedIds.has(q.id));
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(selected, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `revizz-questions-export-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification(`Exported ${selected.length} questions as JSON`);
  };

  const removeTopic = (topicName: string) => {
    setTopics(topics.filter((t) => t !== topicName));
  };

  const addTopic = () => {
    const newT = prompt('Enter subtopic name (e.g. Government and the macroeconomy):');
    if (newT && !topics.includes(newT)) {
      setTopics([...topics, newT]);
    }
  };

  const handleScheduleRound = () => {
    setScheduledSuccess(true);
    setTimeout(() => setScheduledSuccess(false), 4000);
  };

  return (
    <div className="flex flex-col gap-3 pt-0 px-2 pb-2 sm:px-3 sm:pb-3 text-[#201e1d] font-body">
      {/* ========================================================
          SUB-TAB 1: ASSIGN ROUNDS & HOMEWORK (Mockup 2c)
          ======================================================== */}
      {activeSubTab === 'assign' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* Left: Assigner Form */}
          <div className="flex flex-col gap-4">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Assign rounds / New</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                New homework round
              </h2>
            </div>

            {/* Natural language AI Assignment Bar */}
            <div className="flex items-center gap-2.5 p-2.5 pl-4 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs shadow-sm">
              <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="flex-1 bg-transparent font-medium text-[#201e1d] outline-none text-xs sm:text-sm"
              />
              <span className="px-3 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] font-bold text-xs shrink-0 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Agent filled this
              </span>
            </div>

            {/* Form Container */}
            <div className="p-5 sm:p-6 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] grid grid-cols-1 sm:grid-cols-2 gap-4 shadow-sm">
              {/* Assign To */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Assign to</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-xs font-bold">
                    {selectedClass}
                  </span>
                  <button
                    onClick={() => {
                      const next = prompt('Enter class name or student email:');
                      if (next) setSelectedClass(next);
                    }}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-dashed border-[#a19786] text-xs font-semibold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    + class or student
                  </button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Subject</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d]">
                  {subject}
                </div>
              </div>

              {/* Topics */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Topics</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {topics.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-full bg-[#ffe1d0] text-[#643312] text-xs font-bold flex items-center gap-1.5"
                    >
                      {t}
                      <button
                        onClick={() => removeTopic(t)}
                        className="hover:text-red-600 transition-colors"
                        title="Remove topic"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={addTopic}
                    className="px-3 py-1.5 rounded-full border-[1.5px] border-dashed border-[#a19786] text-xs font-semibold text-[#645c50] hover:bg-[#eee7db]"
                  >
                    + topic
                  </button>
                </div>
              </div>

              {/* Round Length */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Round length</label>
                <div className="flex items-center gap-1.5">
                  {[5, 8, 10, 'Custom'].map((len) => (
                    <button
                      key={len}
                      onClick={() => setRoundLength(len as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        roundLength === len
                          ? 'bg-[#201e1d] text-[#f9f4ed]'
                          : 'border-[1.5px] border-[#c0b6a5] bg-white text-[#474238] hover:bg-[#eee7db]'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer Mode */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Timer</label>
                <div className="flex items-center gap-1.5">
                  {(['Chill', 'Exam'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTimerMode(mode)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        timerMode === mode
                          ? 'bg-[#201e1d] text-[#f9f4ed]'
                          : 'border-[1.5px] border-[#c0b6a5] bg-white text-[#474238] hover:bg-[#eee7db]'
                      }`}
                    >
                      {mode === 'Chill' ? 'Chill (Untimed)' : 'Exam · 90 s / Q'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opens Date */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Opens</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] flex items-center justify-between">
                  <span>{opensDate}</span>
                  <Calendar className="w-3.5 h-3.5 text-[#82796a]" />
                </div>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-bold text-[#645c50] mb-1.5">Due</label>
                <div className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-medium text-[#201e1d] flex items-center justify-between">
                  <span>{dueDate}</span>
                  <Clock className="w-3.5 h-3.5 text-[#82796a]" />
                </div>
              </div>

              {/* Settings Toggles */}
              <div className="sm:col-span-2 flex flex-col gap-2.5 pt-2 border-t border-[#dcd3c4]">
                {/* 1 retry at 50% XP */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setRetryCredited(!retryCredited)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      retryCredited ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        retryCredited ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">1 retry at 50% XP</span>
                  <span className="text-[#645c50] text-[11px]">School default</span>
                </div>

                {/* Add misses to Review Pile */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setAddToReviewPile(!addToReviewPile)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      addToReviewPile ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        addToReviewPile ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">Add misses to each student&apos;s Review Pile</span>
                </div>

                {/* Shuffle option order */}
                <div className="flex items-center gap-2.5 text-xs text-[#201e1d]">
                  <button
                    type="button"
                    onClick={() => setShuffleOptions(!shuffleOptions)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${
                      shuffleOptions ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                        shuffleOptions ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <span className="flex-1 font-bold">Shuffle option order per student</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2.5">
              {scheduledSuccess && (
                <span className="text-xs font-bold text-[#56633f] flex items-center gap-1">
                  <Check className="w-4 h-4" /> Homework round scheduled!
                </span>
              )}
              <button
                onClick={() => alert('Draft saved successfully!')}
                className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5"
              >
                Save draft
              </button>
              <button
                onClick={handleScheduleRound}
                className="px-5 py-2.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-sm font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none"
              >
                Schedule for 26 students
              </button>
            </div>
          </div>

          {/* Right: Selected Questions Preview */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-heading text-lg font-black text-[#201e1d]">
                Questions · {roundLength === 'Custom' ? assignQs.length : roundLength}
              </span>
              <button
                onClick={() => setActiveSubTab('bank')}
                className="text-xs font-bold text-[#c67139] hover:underline"
              >
                Swap with bank
              </button>
            </div>
            <p className="text-xs text-[#645c50] leading-snug">
              Questions selected from question bank for this assignment.
            </p>

            {assignQs.length === 0 ? (
              <div className="py-8 px-4 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-2xl">📋</span>
                <span className="font-heading font-black text-sm text-[#201e1d]">No Questions Available to Assign</span>
                <span className="text-xs text-[#645c50] max-w-xs">
                  No questions available to assign. Ingest and publish papers in App Admin.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2 divide-y divide-[#eee7db]">
                  {assignQs.map((q, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (isTeacherMode) {
                          setActiveSubTab('bank');
                          setExpandedQuestionId(q.id);
                        } else {
                          onOpenEditor?.(q.id);
                        }
                      }}
                      className="pt-2 flex items-start gap-2 text-xs hover:bg-[#eee7db]/50 p-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-[#645c50] block">
                          {isTeacherMode ? q.topic : `${q.id} · ${q.topic}`}
                        </span>
                        <span className="font-semibold text-[#201e1d] line-clamp-2 leading-tight">
                          {q.stem}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {!isTeacherMode && q.agent && (
                          <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#272e1b] text-[10px] font-bold">
                            Agent · new
                          </span>
                        )}
                        <span className="font-black text-[#201e1d]">{q.acc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-xs text-[#645c50] font-medium border-t border-[#dcd3c4]">
                  {assignQs.length} questions available
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          SUB-TAB 2: QUESTION BANK BROWSER (Mockup 2f)
          ======================================================== */}
      {activeSubTab === 'bank' && (
        <div className="flex flex-col gap-2.5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Question bank</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                {(isLoadingLive || questionsLoading) && bankQuestions.length === 0
                  ? '0 questions'
                  : filteredBankItems.length === baseBankQuestions.length
                  ? `${baseBankQuestions.length} questions`
                  : `${filteredBankItems.length} of ${baseBankQuestions.length} questions`}
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  window.location.href = '/portal?tab=compiler';
                }}
                className="px-3.5 py-2 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs font-semibold text-[#3d472b] hover:bg-[#e1eecc] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> Compile Test Paper (PDF)
              </button>
              {!isTeacherMode && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleJsonUpload}
                    accept=".json"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingJson}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" /> {isUploadingJson ? 'Uploading...' : 'Upload JSON 🚀'}
                  </button>
                  <button
                    onClick={() => onOpenEditor?.('new')}
                    className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading text-xs font-black hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> New question
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 1: Primary Search & Structured Exam Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a]" />
              <input
                type="text"
                placeholder={isTeacherMode ? "Search question stems, citations, topics, options..." : "Search stems, IDs, citations, options..."}
                value={bankFilters.search}
                onChange={(e) => setBankFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                className="w-full pl-9 pr-8 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139]"
              />
              {bankFilters.search && (
                <button
                  type="button"
                  onClick={() => setBankFilters((prev) => ({ ...prev, search: '', page: 1 }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d] p-0.5 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <BankFilterDropdown
              label="Subject"
              value={bankFilters.subject}
              onChange={(val) => setBankFilters((prev) => ({ ...prev, subject: val, page: 1 }))}
              options={facetCounts.subjects}
            />
            <BankFilterDropdown
              label="Year"
              value={bankFilters.year}
              onChange={(val) => setBankFilters((prev) => ({ ...prev, year: val, page: 1 }))}
              options={facetCounts.years}
            />
            <BankFilterDropdown
              label="Season"
              value={bankFilters.season}
              onChange={(val) => setBankFilters((prev) => ({ ...prev, season: val, page: 1 }))}
              options={facetCounts.seasons}
            />
            <BankFilterDropdown
              label="Variant"
              value={bankFilters.variant}
              onChange={(val) => setBankFilters((prev) => ({ ...prev, variant: val, page: 1 }))}
              options={facetCounts.variants}
            />
            <BankFilterDropdown
              label="Paper"
              multiSelect
              selectedValues={bankFilters.papers || (bankFilters.paper && bankFilters.paper !== 'All' ? [bankFilters.paper] : [])}
              onMultiChange={(vals) => setBankFilters((prev) => ({ ...prev, papers: vals, paper: vals.length === 1 ? vals[0] : 'All', page: 1 }))}
              options={facetCounts.papers}
              minWidth="min-w-[240px]"
            />
            <BankFilterDropdown
              label="Topic"
              multiSelect
              selectedValues={bankFilters.topics || (bankFilters.topic && bankFilters.topic !== 'All' ? [bankFilters.topic] : [])}
              onMultiChange={(vals) => setBankFilters((prev) => ({ ...prev, topics: vals, topic: vals.length === 1 ? vals[0] : 'All', page: 1 }))}
              options={facetCounts.topics}
              minWidth="min-w-[260px]"
            />
            <BankFilterDropdown
              label="Difficulty"
              multiSelect
              selectedValues={bankFilters.difficulties || (bankFilters.difficulty && bankFilters.difficulty !== 'All' ? [bankFilters.difficulty] : [])}
              onMultiChange={(vals) => setBankFilters((prev) => ({ ...prev, difficulties: vals, difficulty: vals.length === 1 ? vals[0] : 'All', page: 1 }))}
              options={facetCounts.difficulties}
            />
            {!isTeacherMode && (
              <BankFilterDropdown
                label="Status"
                value={bankFilters.status}
                onChange={(val) => setBankFilters((prev) => ({ ...prev, status: val, page: 1 }))}
                options={facetCounts.statuses}
              />
            )}
            <button
              type="button"
              disabled={isLoadingLive}
              onClick={() => {
                fetchLiveQuestions();
                refetchQuestions();
                showNotification('Refreshed questions from Supabase');
              }}
              className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="Refresh questions from database"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin text-[#c67139]' : 'text-[#645c50]'}`} />
              <span>Refresh 🔄</span>
            </button>
          </div>

          {/* Row 2: Content Feature Toggle Pills & Results Summary */}
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50] mr-1">
                Features:
              </span>
              <button
                type="button"
                onClick={() => toggleFeature('diagram')}
                className={`px-3 py-1 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  bankFilters.features.includes('diagram')
                    ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold shadow-sm'
                    : 'bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                }`}
              >
                <span>Has Diagram</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    bankFilters.features.includes('diagram')
                      ? 'bg-[#c67139] text-[#f9f4ed]'
                      : 'bg-[#e8decb] text-[#645c50]'
                  }`}
                >
                  {featureCounts.diagram || 0}
                </span>
              </button>
              <button
                type="button"
                data-testid="filter-tables"
                onClick={() => toggleFeature('table')}
                className={`px-3 py-1 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  bankFilters.features.includes('table') || (bankFilters.features as any[]).includes('tables')
                    ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold shadow-sm'
                    : 'bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                }`}
              >
                <span>Has Table</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    bankFilters.features.includes('table') || (bankFilters.features as any[]).includes('tables')
                      ? 'bg-[#c67139] text-[#f9f4ed]'
                      : 'bg-[#e8decb] text-[#645c50]'
                  }`}
                >
                  {featureCounts.table || 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleFeature('math')}
                className={`px-3 py-1 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  bankFilters.features.includes('math')
                    ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold shadow-sm'
                    : 'bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                }`}
              >
                <span>Has Math/LaTeX</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    bankFilters.features.includes('math')
                      ? 'bg-[#c67139] text-[#f9f4ed]'
                      : 'bg-[#e8decb] text-[#645c50]'
                  }`}
                >
                  {featureCounts.math || 0}
                </span>
              </button>
            </div>

            <div className="text-xs font-semibold text-[#645c50] ml-auto">
              Showing <span className="font-bold text-[#201e1d]">{filteredBankItems.length}</span> of{' '}
              <span className="font-bold text-[#201e1d]">{bankQuestions.length}</span> questions
            </div>
          </div>

          {/* Row 3: Active Filter Chips Bar */}
          {activeFilterChips.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                Active Filters:
              </span>
              {activeFilterChips.map((chip, idx) => (
                <button
                  key={`${chip.key}-${chip.value}-${idx}`}
                  type="button"
                  onClick={() => handleRemoveChip(chip)}
                  className="px-2.5 py-1 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] hover:border-[#c67139] cursor-pointer flex items-center gap-1 transition-all active:translate-y-0.5 active:shadow-none"
                  title={`Remove ${chip.label}: ${chip.value}`}
                >
                  <span>
                    <span className="text-[#645c50] font-medium">{chip.label}:</span> {chip.value}
                  </span>
                  <X className="w-3 h-3 text-[#645c50] hover:text-[#c67139] shrink-0" />
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-2.5 py-1 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-bold transition-colors cursor-pointer ml-1"
              >
                Clear all ({activeFilterChips.length})
              </button>
            </div>
          )}

          {/* Status Counter Tabs (hidden in teacher mode) */}
          {isTeacherMode ? null : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setBankFilters((prev) => ({ ...prev, status: 'All', page: 1 }))}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  bankFilters.status === 'All' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
                }`}
              >
                All {filteredBankItems.length}
              </button>
              <button
                type="button"
                onClick={() => setBankFilters((prev) => ({ ...prev, status: 'Live', page: 1 }))}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  bankFilters.status === 'Live' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
                }`}
              >
                Live {filteredBankItems.filter((q) => q.st === 'Live').length}
              </button>
              <button
                type="button"
                onClick={() => setBankFilters((prev) => ({ ...prev, status: 'Agent draft', page: 1 }))}
                className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  bankFilters.status === 'Agent draft' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
                }`}
              >
                <span>Agent drafts</span>
                <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-[#f9f4ed] text-[10px]">
                  {filteredBankItems.filter((q) => q.st === 'Agent draft').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBankFilters((prev) => ({ ...prev, status: 'Needs review', page: 1 }))}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  bankFilters.status === 'Needs review' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
                }`}
              >
                Needs review {filteredBankItems.filter((q) => q.st === 'Needs review').length}
              </button>
              <button
                type="button"
                onClick={() => setBankFilters((prev) => ({ ...prev, status: 'Flagged', page: 1 }))}
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                  bankFilters.status === 'Flagged' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
                }`}
              >
                Flagged {filteredBankItems.filter((q) => q.st === 'Flagged').length}
              </button>
            </div>
          )}

          {/* Bank Table */}
          <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[680px]">
                {/* Table Header */}
                {isTeacherMode ? (
                  <div className="sticky top-0 z-10 bg-[#f9f4ed] grid grid-cols-[1fr_260px_130px] gap-2 items-center pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4] px-1">
                    <span>Question & Classroom Tags</span>
                    <span>Topic</span>
                    <span className="text-right pr-2">Classroom</span>
                  </div>
                ) : (
                  <div className="sticky top-0 z-10 bg-[#f9f4ed] grid grid-cols-[38px_1fr_240px_90px_44px] gap-2 items-center pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        ref={headerCheckboxRef}
                        checked={allCurrentPageSelected}
                        onChange={handleToggleSelectPage}
                        aria-label="Select all questions on this page"
                        className="w-4 h-4 rounded cursor-pointer accent-[#c67139]"
                      />
                    </div>
                    <span>Stem</span>
                    <span>Topic</span>
                    <span>Status</span>
                    <span className="text-center">Action</span>
                  </div>
                )}

                {/* Selection helper banner */}
                {!isTeacherMode && selectedIds.size > 0 && (
                  <div className="bg-[#ffe1d0]/70 border-b border-[#dcd3c4] px-4 py-2 text-xs font-semibold text-[#201e1d] flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#c67139]" />
                      <span>
                        {selectedIds.size === filteredBankItems.length ? (
                          <>All <b>{filteredBankItems.length}</b> matching questions selected.</>
                        ) : (
                          <>
                            <b>{selectedIds.size}</b> question{selectedIds.size === 1 ? '' : 's'} selected across pages.
                            {selectedIds.size < filteredBankItems.length && (
                              <button
                                type="button"
                                onClick={handleSelectAllMatching}
                                className="ml-2 font-bold text-[#c67139] underline hover:text-[#b2622d] cursor-pointer"
                              >
                                Select all {filteredBankItems.length} matching questions
                              </button>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-xs font-bold text-[#645c50] hover:text-[#201e1d] underline cursor-pointer"
                    >
                      Clear selection
                    </button>
                  </div>
                )}

                <div className="max-h-[720px] xl:max-h-[760px] overflow-y-auto divide-y divide-[#eee7db] pr-1">
                  {(isLoadingLive || questionsLoading) && bankQuestions.length === 0 ? (
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-6 h-6 animate-spin text-[#c67139]" />
                      <span className="font-heading font-black text-base text-[#201e1d]">Loading questions from database...</span>
                      <span className="text-xs text-[#645c50]">Connecting to live repository</span>
                    </div>
                  ) : bankQuestions.length === 0 ? (
                    <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
                      <span className="text-3xl">🗄️</span>
                      <span className="font-heading font-black text-base text-[#201e1d]">Question Bank is Empty</span>
                      <span className="text-xs text-[#645c50] max-w-sm">
                        There are no questions in the repository yet. Ingest and publish exam papers in Ingestion Studio to build your question bank.
                      </span>
                    </div>
                  ) : paginatedBankItems.length === 0 ? (
                    <div className="py-8 text-center text-xs font-bold text-[#645c50]">
                      No questions match the selected filters.
                    </div>
                  ) : (
                    paginatedBankItems.map((item) => {
                      const isSelected = selectedIds.has(item.id);
                      const isExpanded = expandedQuestionId === item.id;
                      const annotation = teacherAnnotations[item.id];
                      return (
                        <div key={item.id} className="transition-all">
                          {isTeacherMode ? (
                            <div
                              onClick={() =>
                                setExpandedQuestionId((prev) => (prev === item.id ? null : item.id))
                              }
                              className={`grid grid-cols-[1fr_260px_130px] gap-2 items-center py-2.5 text-xs cursor-pointer rounded-xl transition-all px-1.5 ${
                                isExpanded
                                  ? 'bg-[#fbf8f2] border-l-4 border-[#201e1d] shadow-xs'
                                  : 'hover:bg-[#eee7db]/60 border-l-4 border-transparent'
                              }`}
                            >
                              <div className="flex items-start gap-1.5 min-w-0">
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="text-[#8c8275] shrink-0 mt-0.5"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="font-bold text-[#201e1d] truncate" title={item.stem}>
                                    {item.stem}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {annotation?.classroomTags && annotation.classroomTags.length > 0 && (
                                      annotation.classroomTags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="px-2 py-0.5 rounded-full bg-[#ffe1d0] text-[#8c491a] font-bold text-[10px]"
                                        >
                                          #{tag}
                                        </span>
                                      ))
                                    )}
                                    {annotation?.teacherNote && (
                                      <span
                                        className="px-2 py-0.5 rounded-full bg-[#eee7db] text-[#474238] font-bold text-[10px] inline-flex items-center gap-1"
                                        title={annotation.teacherNote}
                                      >
                                        📝 Note
                                      </span>
                                    )}
                                    {annotation?.flaggedForAdmin && (
                                      <span
                                        className="px-2 py-0.5 rounded-full bg-[#fde8e8] text-[#e0533c] font-bold text-[10px] inline-flex items-center gap-1"
                                        title={annotation.flagReason || 'Flagged by educator for review'}
                                      >
                                        🚩 Flagged
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[#474238] truncate" title={item.topic}>
                                {item.topic}
                              </span>
                              <div
                                className="flex items-center justify-end"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedQuestionId((prev) => (prev === item.id ? null : item.id))
                                  }
                                  className="px-2.5 py-1 rounded-lg border border-[#c0b6a5] bg-[#f9f4ed] hover:bg-[#eee7db] text-[11px] font-bold text-[#201e1d] transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5"
                                >
                                  Preview & Notes
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() =>
                                setExpandedQuestionId((prev) => (prev === item.id ? null : item.id))
                              }
                              className={`grid grid-cols-[38px_1fr_240px_90px_44px] gap-2 items-center py-2.5 text-xs cursor-pointer rounded-xl transition-all px-1 ${
                                isSelected
                                  ? 'bg-[#ffe1d0]/50 border-l-4 border-[#c67139]'
                                  : isExpanded
                                  ? 'bg-[#fbf8f2] border-l-4 border-[#201e1d] shadow-xs'
                                  : 'hover:bg-[#eee7db]/60 border-l-4 border-transparent'
                              }`}
                            >
                              <div
                                className="flex items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    toggleSelect(item.id);
                                  }}
                                  aria-label={`Select question ${item.id}`}
                                  className="w-4 h-4 rounded cursor-pointer accent-[#c67139]"
                                />
                              </div>
                              <div className="flex items-center gap-1.5 min-w-0">
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="text-[#8c8275] shrink-0"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </motion.div>
                                <span className="font-bold text-[#201e1d] truncate" title={item.stem}>
                                  {item.stem}
                                </span>
                              </div>
                              <span className="text-[#474238] truncate" title={item.topic}>
                                {item.topic}
                              </span>
                              <span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${item.stCls}`}
                                >
                                  {item.st}
                                </span>
                              </span>
                              <div
                                className="flex items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDeleteSingle(item.id);
                                  }}
                                  aria-label={`Delete question ${item.id}`}
                                  title={`Delete question ${item.id}`}
                                  className="p-1.5 rounded-lg border border-transparent hover:border-[#e0533c]/40 hover:bg-[#fde8e8] text-[#8c8275] hover:text-[#e0533c] transition-all cursor-pointer active:translate-y-0.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="bg-[#faf6ee] border-y border-[#dcd3c4] p-4 text-xs sm:text-sm my-1 rounded-xl shadow-inner space-y-3">
                                  {/* Top Bar inside dropdown */}
                                  {isTeacherMode ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#dcd3c4]">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238] font-bold text-[11px]">
                                          {item.paper}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#645c50] text-[11px] font-mono">
                                          {item.cite}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238] font-medium text-[11px]">
                                          {item.topic}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#fdfbf7] border border-[#dcd3c4] text-[#474238] font-medium text-[11px]">
                                          {item.diff}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full bg-[#f0fae1] border border-[#8fa073] text-[11px] font-bold text-[#3d472b] whitespace-nowrap">
                                          🔒 Official Cambridge Content (Read-Only)
                                        </span>
                                        <span className="text-[11px] font-bold text-[#645c50] ml-1">
                                          Accuracy: <span className="text-[#201e1d] font-black">{item.acc}</span>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowFlagForm((prev) => !prev);
                                          }}
                                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold text-xs transition-all cursor-pointer active:translate-y-0.5 ${
                                            annotation?.flaggedForAdmin
                                              ? 'bg-[#fde8e8] border-[#e0533c] text-[#e0533c]'
                                              : 'bg-[#f9f4ed] border-[#c0b6a5] text-[#201e1d] hover:bg-[#eee7db]'
                                          }`}
                                        >
                                          <span>🚩 Flag for Admin</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedQuestionId(null);
                                          }}
                                          className="p-1.5 rounded-lg border border-[#dcd3c4] hover:bg-[#eee7db] text-[#645c50] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
                                          title="Collapse details"
                                        >
                                          <span>Collapse</span>
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#dcd3c4]">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238] font-bold text-[11px]">
                                          {item.paper}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#645c50] text-[11px] font-mono">
                                          {item.cite}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#eee7db] text-[#474238] font-medium text-[11px]">
                                          {item.topic}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-md bg-[#fdfbf7] border border-[#dcd3c4] text-[#474238] font-medium text-[11px]">
                                          {item.diff}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${item.stCls}`}>
                                          {item.st}
                                        </span>
                                        <span className="text-[11px] font-bold text-[#645c50] ml-1">
                                          Accuracy: <span className="text-[#201e1d] font-black">{item.acc}</span>
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onOpenEditor?.(item.id);
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#201e1d] hover:bg-[#34302c] text-[#fdfbf7] font-bold text-xs shadow-[0_2px_0_0_#000] hover:shadow-[0_1px_0_0_#000] active:translate-y-0.5 transition-all cursor-pointer"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                          <span>Open Full Editor</span>
                                          <span className="text-[10px] opacity-75">↗</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedQuestionId(null);
                                          }}
                                          className="p-1.5 rounded-lg border border-[#dcd3c4] hover:bg-[#eee7db] text-[#645c50] transition-colors cursor-pointer"
                                          title="Collapse details"
                                        >
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Question Stem */}
                                  <div className="bg-white rounded-xl border border-[#dcd3c4] p-3">
                                    <div className="text-[11px] font-bold text-[#8c8275] uppercase tracking-wider mb-1">
                                      Question Stem
                                    </div>
                                    <div className="text-[#201e1d] font-medium leading-relaxed">
                                      <MarkdownErrorBoundary fallbackText={item.stem}>
                                        <span>{item.stem}</span>
                                      </MarkdownErrorBoundary>
                                    </div>
                                  </div>

                                  {/* Diagram Image Preview */}
                                  {item.imageUrl && (
                                    <div className="bg-white rounded-xl border border-[#dcd3c4] p-3">
                                      <div className="text-[11px] font-bold text-[#8c8275] uppercase tracking-wider mb-2">
                                        Diagram / Figure
                                      </div>
                                      <CompilerDiagramPreview
                                        imageUrl={item.imageUrl}
                                        citation={item.id}
                                        maxThumbnailHeight="max-h-48"
                                      />
                                    </div>
                                  )}

                                  {/* Options Grid */}
                                  {item.options && item.options.length > 0 && (
                                    <div className="space-y-1.5">
                                      <div className="text-[11px] font-bold text-[#8c8275] uppercase tracking-wider">
                                        Answer Options
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {item.options.map((opt) => (
                                          <div
                                            key={opt.id}
                                            className={`p-3 rounded-xl transition-all ${
                                              opt.isCorrect
                                                ? 'bg-[#ecf5e4] border-2 border-[#728157] text-[#222c15]'
                                                : 'bg-white border border-[#dcd3c4] text-[#201e1d]'
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                              <span
                                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full font-bold text-xs shrink-0 ${
                                                  opt.isCorrect
                                                    ? 'bg-[#728157] text-white'
                                                    : 'bg-[#eee7db] text-[#474238]'
                                                }`}
                                              >
                                                {opt.label}
                                              </span>
                                              {opt.isCorrect && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#4c5c2d] bg-[#dbe8cb] px-2 py-0.5 rounded-full">
                                                  <Check className="w-3 h-3" /> Correct Answer
                                                </span>
                                              )}
                                            </div>
                                            <div className="font-medium text-xs leading-relaxed">
                                              <MarkdownErrorBoundary fallbackText={formatTableOptionText(opt.text)}>
                                                <span>{formatTableOptionText(opt.text)}</span>
                                              </MarkdownErrorBoundary>
                                            </div>
                                            {opt.distractorReasoning && (
                                              <div className="mt-2 pt-2 border-t border-[#dcd3c4]/60 text-[11px] text-[#645c50]">
                                                <span className="font-semibold text-[#8c8275]">Reasoning: </span>
                                                {opt.distractorReasoning}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Explanation Card */}
                                  {item.explanationMarkdown && (
                                    <div className="bg-[#f0fae1]/60 rounded-xl border border-[#c4dc9e] p-3 text-xs">
                                      <div className="text-[11px] font-bold text-[#4c5c2d] uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-[#728157]" />
                                        Explanation & Key Takeaway
                                      </div>
                                      <div className="text-[#272e1b] font-medium leading-relaxed">
                                        <MarkdownErrorBoundary fallbackText={item.explanationMarkdown}>
                                          <span>{item.explanationMarkdown}</span>
                                        </MarkdownErrorBoundary>
                                      </div>
                                    </div>
                                  )}

                                  {/* Classroom Tags & Teacher Notes Panel (Editable by Educator) */}
                                  {isTeacherMode && (
                                    <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl p-3.5 space-y-3 mt-2">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-heading font-black text-xs sm:text-sm text-[#201e1d] flex items-center gap-1.5">
                                          <span>🏷️</span> Classroom Tags & Teacher Notes (Editable by Educator)
                                        </h4>
                                      </div>

                                      {/* Classroom Tags Section */}
                                      <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-[#645c50] uppercase tracking-wider">
                                          Classroom Tags
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          {annotation?.classroomTags && annotation.classroomTags.length > 0 ? (
                                            annotation.classroomTags.map((tag) => (
                                              <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffe1d0] text-[#8c491a] text-xs font-bold"
                                              >
                                                #{tag}
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveClassroomTag(item.id, tag)}
                                                  className="hover:text-[#201e1d] ml-0.5 rounded-full p-0.5 cursor-pointer"
                                                  title={`Remove ${tag}`}
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-xs text-[#8c8275] italic">No classroom tags added yet.</span>
                                          )}
                                        </div>

                                        {/* Quick Preset Tags */}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                          <span className="text-[10px] font-bold text-[#8c8275]">Quick Presets:</span>
                                          {['Exam Focus', 'Homework', 'Common Misconception', 'Review in Class'].map((preset) => {
                                            const hasTag = annotation?.classroomTags?.includes(preset);
                                            return (
                                              <button
                                                key={preset}
                                                type="button"
                                                disabled={hasTag}
                                                onClick={() => handleAddClassroomTag(item.id, preset)}
                                                className="px-2 py-0.5 rounded-full border border-[#c0b6a5] bg-white hover:bg-[#eee7db] text-[11px] font-semibold text-[#474238] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                              >
                                                + {preset}
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Add Custom Tag Input */}
                                        <div className="flex items-center gap-2 pt-1 max-w-sm">
                                          <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (tagInput.trim()) {
                                                  handleAddClassroomTag(item.id, tagInput);
                                                }
                                              }
                                            }}
                                            placeholder="New tag (e.g. Set 1, Revision)..."
                                            className="flex-1 px-3 py-1 rounded-lg bg-white border border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139]"
                                          />
                                          <button
                                            type="button"
                                            disabled={!tagInput.trim()}
                                            onClick={() => {
                                              if (tagInput.trim()) {
                                                handleAddClassroomTag(item.id, tagInput);
                                              }
                                            }}
                                            className="px-3 py-1 rounded-lg bg-[#201e1d] text-[#fdfbf7] text-xs font-bold hover:bg-[#34302c] disabled:opacity-40 cursor-pointer"
                                          >
                                            Add Tag
                                          </button>
                                        </div>
                                      </div>

                                      {/* Teacher Classroom Note Section */}
                                      <div className="space-y-1.5 pt-1 border-t border-[#dcd3c4]">
                                        <div className="text-[11px] font-bold text-[#645c50] uppercase tracking-wider">
                                          Teacher Classroom Note
                                        </div>
                                        <textarea
                                          value={noteDraft}
                                          onChange={(e) => setNoteDraft(e.target.value)}
                                          rows={3}
                                          placeholder="Add private teaching notes, class reminders, or worked hints for this question..."
                                          className="w-full p-2.5 rounded-lg bg-white border border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139] leading-relaxed resize-y"
                                        />
                                        <div className="flex justify-end">
                                          <button
                                            type="button"
                                            onClick={() => handleSaveTeacherNote(item.id, noteDraft)}
                                            className="px-3.5 py-1.5 rounded-xl bg-[#c67139] text-[#f9f4ed] font-heading font-black text-xs hover:bg-[#b2622d] shadow-sm active:translate-y-0.5 cursor-pointer"
                                          >
                                            Save Note
                                          </button>
                                        </div>
                                      </div>

                                      {/* Flag for Admin Section */}
                                      {(showFlagForm || annotation?.flaggedForAdmin) && (
                                        <div className="p-3 rounded-lg bg-[#fde8e8]/70 border border-[#e0533c]/40 space-y-2 mt-2">
                                          <div className="flex items-center justify-between">
                                            <span className="font-heading font-bold text-xs text-[#c0392b] flex items-center gap-1.5">
                                              🚩 {annotation?.flaggedForAdmin ? 'Flagged for App Admin Review' : 'Flag Question for App Admin'}
                                            </span>
                                            {showFlagForm && (
                                              <button
                                                type="button"
                                                onClick={() => setShowFlagForm(false)}
                                                className="text-xs text-[#645c50] hover:text-[#201e1d] cursor-pointer"
                                              >
                                                Cancel
                                              </button>
                                            )}
                                          </div>
                                          {annotation?.flaggedForAdmin && (
                                            <p className="text-xs text-[#7f1d1d] font-medium">
                                              Reason: {annotation.flagReason || 'Flagged by educator for review'}
                                            </p>
                                          )}
                                          {showFlagForm && (
                                            <div className="space-y-2 pt-1">
                                              <input
                                                type="text"
                                                value={flagReasonInput}
                                                onChange={(e) => setFlagReasonInput(e.target.value)}
                                                placeholder="Reason for flagging (e.g., diagram missing, typo in option B, syllabus mismatch)..."
                                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#e0533c]/50 text-xs text-[#201e1d] outline-none focus:border-[#e0533c]"
                                              />
                                              <div className="flex justify-end gap-2">
                                                <button
                                                  type="button"
                                                  onClick={() => handleFlagForAdmin(item.id, flagReasonInput)}
                                                  className="px-3 py-1 rounded-lg bg-[#e0533c] text-white font-bold text-xs hover:bg-[#c0392b] cursor-pointer"
                                                >
                                                  Submit Flag to Admin
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer Pagination Controls */}
            <div className="pt-3.5 mt-3 border-t border-[#dcd3c4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-[#645c50] font-medium">
                Showing {Math.min((bankPage - 1) * pageSize + 1, filteredBankItems.length)}–{Math.min(bankPage * pageSize, filteredBankItems.length)} of {filteredBankItems.length} questions
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBankPage((p) => Math.max(1, p - 1))}
                  disabled={bankPage === 1}
                  className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-40 disabled:cursor-not-allowed text-[#201e1d] font-bold text-xs transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <span className="text-[#645c50] font-medium px-1">
                  Page {bankPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setBankPage((p) => Math.min(totalPages, p + 1))}
                  disabled={bankPage === totalPages}
                  className="px-3 py-1 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-40 disabled:cursor-not-allowed text-[#201e1d] font-bold text-xs transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Agent Actions Card */}
          {!isTeacherMode && (
            <div className="mt-1.5 flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs shadow-xs">
              <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
              <span className="flex-1 leading-snug text-[#201e1d]">
                <b>Bulk agent actions:</b> write explanations for items that have none · check
                citations against source papers · find near-duplicates
              </span>
              <button
                onClick={() => alert(`Agent scanning ${filteredBankItems.length} filtered questions in background...`)}
                className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#728157] font-bold text-xs text-[#3d472b] hover:bg-[#ccdbb2] active:translate-y-0.5 whitespace-nowrap"
              >
                Run on filtered ({filteredBankItems.length})
              </button>
            </div>
          )}

          {/* Floating Mass Actions Deck */}
          {!isTeacherMode && (
            <AnimatePresence>
              {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.18 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[6px_6px_0_#201e1d] rounded-2xl px-4 py-2.5 flex items-center gap-2.5 sm:gap-3 flex-wrap max-w-[94vw]"
              >
                {/* Selection count */}
                <div className="flex items-center gap-2 pr-2.5 border-r border-[#dcd3c4]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#c67139] animate-pulse shrink-0" />
                  <span className="font-heading font-black text-xs sm:text-sm text-[#201e1d] whitespace-nowrap">
                    {selectedIds.size} selected
                  </span>
                </div>

                {/* Delete Selected Button */}
                <button
                  type="button"
                  onClick={() => handleOpenConfirmModal('delete')}
                  className="px-3 py-1.5 rounded-full bg-[#fde8e8] text-[#e0533c] hover:bg-[#fad2d2] border-[1.5px] border-[#e0533c] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Delete Selected</span>
                </button>

                {/* Change Status Dropdown */}
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDropdownOpen(!statusDropdownOpen);
                      setTopicDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-[#201e1d] hover:bg-[#eee7db] font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5 whitespace-nowrap"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#645c50] shrink-0" />
                    <span>Change Status</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {statusDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full mb-2 left-0 w-44 rounded-2xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[4px_4px_0_#201e1d] p-1.5 z-50 flex flex-col gap-1"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#645c50] px-2 py-1">
                          Select Status
                        </span>
                        {(['Live', 'Needs review', 'Agent draft', 'Flagged'] as BankItemStatus[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setStatusDropdownOpen(false);
                              handleOpenConfirmModal('status', status);
                            }}
                            className="w-full text-left rounded-xl px-2 py-1.5 text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(status)}`}>
                              {status}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Reassign Topic Dropdown */}
                <div className="relative" ref={topicDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setTopicDropdownOpen(!topicDropdownOpen);
                      setStatusDropdownOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-[#201e1d] hover:bg-[#eee7db] font-bold text-xs flex items-center gap-1 cursor-pointer transition-all active:translate-y-0.5 whitespace-nowrap"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[#645c50] shrink-0" />
                    <span>Reassign Topic</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${topicDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {topicDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute bottom-full mb-2 left-0 w-72 max-h-60 overflow-y-auto rounded-2xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[4px_4px_0_#201e1d] p-1.5 z-50 flex flex-col gap-1"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#645c50] px-2 py-1">
                          Select Cambridge Topic
                        </span>
                        {reassignTopicOptions.length === 0 ? (
                          <span className="text-xs text-[#645c50] px-2 py-2 text-center">No topics available</span>
                        ) : (
                          reassignTopicOptions.map((topicName) => (
                            <button
                              key={topicName}
                              type="button"
                              onClick={() => {
                                setTopicDropdownOpen(false);
                                handleOpenConfirmModal('topic', topicName);
                              }}
                              className="w-full text-left rounded-xl px-2 py-1.5 text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer truncate transition-colors"
                              title={topicName}
                            >
                              {topicName}
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Export Selected Button */}
                <button
                  type="button"
                  onClick={handleExportSelected}
                  className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-[#201e1d] hover:bg-[#eee7db] font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Export Selected</span>
                </button>

                {/* Deselect All Button */}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs font-bold text-[#645c50] hover:text-[#201e1d] px-2 py-1 rounded-full hover:bg-[#eee7db] transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
                >
                  <X className="w-3 h-3" />
                  <span>Deselect All</span>
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          )}

          {/* Confirmation Pop-up Modal */}
          <AnimatePresence>
            {confirmationModal.isOpen && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                aria-describedby="confirm-modal-desc"
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setConfirmationModal({ isOpen: false, type: 'delete' })}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 10 }}
                  transition={{ duration: 0.16 }}
                  className="w-full max-w-2xl lg:max-w-3xl rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[6px_6px_0_#201e1d] p-6 sm:p-7 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-3 rounded-2xl border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] shrink-0 ${
                        confirmationModal.type === 'delete'
                          ? 'bg-[#fde8e8] text-[#e0533c]'
                          : 'bg-[#ffe1d0] text-[#c67139]'
                      }`}
                    >
                      {confirmationModal.type === 'delete' ? (
                        <Trash2 className="w-6 h-6" />
                      ) : confirmationModal.type === 'status' ? (
                        <SlidersHorizontal className="w-6 h-6" />
                      ) : (
                        <BookOpen className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 id="confirm-modal-title" className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
                        {confirmationModal.type === 'delete' &&
                          `Delete ${modalCount} Question${modalCount === 1 ? '' : 's'}?`}
                        {confirmationModal.type === 'status' &&
                          `Change Status for ${selectedIds.size} Question${selectedIds.size === 1 ? '' : 's'}?`}
                        {confirmationModal.type === 'topic' &&
                          `Reassign Topic for ${selectedIds.size} Question${selectedIds.size === 1 ? '' : 's'}?`}
                      </h3>
                      <p id="confirm-modal-desc" className="text-xs sm:text-sm text-[#645c50] mt-1 font-medium leading-snug">
                        {confirmationModal.type === 'delete' &&
                          `This will permanently remove ${modalCount} selected question${modalCount === 1 ? '' : 's'} from the active question bank and Supabase. This action cannot be undone.`}
                        {confirmationModal.type === 'status' &&
                          `This will update the status of ${selectedIds.size} selected question${selectedIds.size === 1 ? '' : 's'} to "${confirmationModal.payload}".`}
                        {confirmationModal.type === 'topic' &&
                          `This will reassign ${selectedIds.size} selected question${selectedIds.size === 1 ? '' : 's'} to topic "${confirmationModal.payload}".`}
                      </p>
                    </div>
                  </div>

                  {/* Selected Items Preview */}
                  <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50]">
                      Affected Questions ({modalCount})
                    </span>
                    <div className="max-h-48 overflow-y-auto overflow-x-hidden rounded-2xl border border-[#dcd3c4] bg-[#eee7db]/50 p-2.5 divide-y divide-[#dcd3c4]">
                      {modalPreviewItems.map((item) => (
                        <div
                          key={item.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 text-xs min-w-0"
                        >
                          <span className="font-mono font-bold text-[#201e1d] shrink-0">{item.id}</span>
                          <span className="text-[#474238] truncate flex-1 min-w-0 font-medium">{item.stem}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f9f4ed] border border-[#dcd3c4] shrink-0 max-w-[200px] truncate text-[#645c50]">
                            {item.topic}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#dcd3c4]">
                    <button
                      type="button"
                      onClick={() => setConfirmationModal({ isOpen: false, type: 'delete' })}
                      className="px-4 py-2 rounded-full border-[1.5px] border-[#201e1d] bg-[#f9f4ed] hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmMassAction}
                      className={`px-5 py-2 rounded-full border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] font-heading text-xs font-black text-[#f9f4ed] transition-all cursor-pointer active:translate-y-0.5 active:shadow-none ${
                        confirmationModal.type === 'delete'
                          ? 'bg-[#e0533c] hover:bg-[#cb422c]'
                          : 'bg-[#c67139] hover:bg-[#b2622d]'
                      }`}
                    >
                      {confirmationModal.type === 'delete'
                        ? `Confirm Delete (${modalCount})`
                        : `Confirm Update (${selectedIds.size})`}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Global Notification Toast */}
          <AnimatePresence>
            {notification && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#201e1d] text-[#f9f4ed] border-2 border-[#dcd3c4] shadow-[4px_4px_0_#201e1d] px-4 py-2.5 rounded-full flex items-center gap-2 text-xs font-bold"
              >
                <Check className="w-4 h-4 text-[#ccdbb2] shrink-0" />
                <span>{notification}</span>
                <button
                  onClick={() => setNotification(null)}
                  className="ml-2 text-[#a89f91] hover:text-white cursor-pointer"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
