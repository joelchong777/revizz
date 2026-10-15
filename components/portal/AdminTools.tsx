'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Search, 
  Plus, 
  X, 
  Check, 
  ChevronDown,
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
  RotateCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabaseClient';
import { 
  useQuestions, 
  useTopics, 
  deleteQuestionsFromDb, 
  Question,
  CAMBRIDGE_QUESTIONS,
  CAMBRIDGE_TOPICS
} from '@/lib/questions';
import { fetchSubjectsFromDb } from '@/lib/subjects';

export type BankItemStatus = 'Live' | 'Agent draft' | 'Needs review' | 'Flagged';

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
  }
}

export function createInitialBankItems(questions: Question[]): QuestionBankItem[] {
  return questions.map((q, idx): QuestionBankItem => {
    const qNum = idx + 1;
    let st: BankItemStatus = 'Live';
    const statusVal = (q as any).status;
    if (statusVal === 'draft' || statusVal === 'Agent draft') {
      st = 'Agent draft';
    } else if (statusVal === 'in_review' || statusVal === 'Needs review') {
      st = 'Needs review';
    } else if (statusVal === 'withdrawn' || statusVal === 'Flagged' || (q as any).active === false) {
      st = 'Flagged';
    } else {
      st = 'Live';
    }
    const stCls = getStatusBadgeClass(st);

    const diff: 'Easy' | 'Medium' | 'Hard' =
      idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
    const acc =
      idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';
    const upd = st === 'Live' ? 'Live' : '2d ago';

    const cite = q.citation || `Q${qNum}`;
    const match = q.citation?.match(/\b(\d{4}\/\d{2})\b/);
    const paper = match ? `${match[1]} M/J/24` : (q.citation?.split(' ')[0] || '0455/12 M/J/24');
    const session = 'May/June 2024';

    return {
      id: q.id,
      stem: q.stem_markdown,
      cite,
      topic: q.topic || 'General',
      paper,
      session,
      diff,
      acc,
      st,
      stCls,
      upd,
      dbId: q.id,
    };
  });
}

export interface AdminToolsProps {
  initialView?: 'assign' | 'bank' | 'importer';
  onOpenEditor?: (questionId: string) => void;
}

interface BankFilterDropdownProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  minWidth?: string;
}

function BankFilterDropdown({
  label,
  value,
  onChange,
  options,
  minWidth = 'min-w-[180px]',
}: BankFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = value !== 'All';

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

  const displayLabel = isActive ? `${label}: ${value}` : label;

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
          isActive
            ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold'
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
            {options.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left rounded-xl px-3 py-1.5 text-xs font-bold text-[#201e1d] hover:bg-[#ffe1d0] cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-[#ffe1d0]/70' : ''
                  }`}
                >
                  <span className="truncate pr-2">{opt.label}</span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-[#c67139] ml-2 shrink-0" />
                  )}
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
  onOpenEditor 
}: AdminToolsProps) {
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
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>(() =>
    createInitialBankItems(CAMBRIDGE_QUESTIONS)
  );
  const [liveQuestions, setLiveQuestions] = useState<any[]>([]);
  const [isLoadingLive, setIsLoadingLive] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingJson, setIsUploadingJson] = useState(false);

  // Assigned Questions Dataset
  const assignQs = useMemo(() => {
    if (liveQuestions && liveQuestions.length > 0) {
      return liveQuestions.map((q) => {
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
    const source = dbQuestions.length > 0 ? dbQuestions : CAMBRIDGE_QUESTIONS;
    return source.map((q) => ({
      id: q.id,
      stem: q.stem_markdown,
      topic: q.topic || 'General',
      acc: '—',
      agent: false,
    }));
  }, [liveQuestions, dbQuestions]);

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
          explanation_markdown,
          cambridge_source_ref,
          active,
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
            content_markdown,
            is_correct,
            distractor_reasoning
          )
        `)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        setLiveQuestions(data);
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

        const paper = paperObj
          ? `${subjectObj?.code || '0455'}/${paperObj.paper_code} ${paperObj.series} ${paperObj.year}`
          : '0455/12 M/J/24';

        const session = paperObj?.series
          ? `${paperObj.series} ${paperObj.year}`
          : 'May/June 2024';

        const st: BankItemStatus = q.active ? 'Live' : 'Needs review';
        const stCls = q.active
          ? 'bg-[#ccdbb2] text-[#272e1b]'
          : 'bg-[#eee7db] text-[#474238]';

        const diff: 'Easy' | 'Medium' | 'Hard' =
          idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
        const acc =
          idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';
        const upd = q.active ? 'Live' : '2d ago';

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
        };
      });
      setBankQuestions(items);
    } else if (!isLoadingLive && !questionsLoading) {
      if (dbQuestions && dbQuestions.length > 0) {
        setBankQuestions(createInitialBankItems(dbQuestions));
      } else {
        setBankQuestions(createInitialBankItems(CAMBRIDGE_QUESTIONS));
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
      const res = await fetch('/api/ingest/publish', {
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

  // Question Bank Filter State
  const [bankSearch, setBankSearch] = useState('');
  const [bankStatusFilter, setBankStatusFilter] = useState<string>('All');
  const [bankPaperFilter, setBankPaperFilter] = useState<string>('All');
  const [bankSessionFilter, setBankSessionFilter] = useState<string>('All');
  const [bankTopicFilter, setBankTopicFilter] = useState<string>('All');
  const [bankDifficultyFilter, setBankDifficultyFilter] = useState<string>('All');
  const [bankPage, setBankPage] = useState(1);

  const paperOptions = useMemo(() => {
    const papers = Array.from(
      new Set(bankQuestions.map((q) => q.paper).filter((p) => Boolean(p) && p !== 'None'))
    );
    if (papers.length === 0) {
      return [{ value: 'None', label: 'None' }];
    }
    return [
      { value: 'All', label: 'All' },
      ...papers.map((p) => ({ value: p, label: p })),
    ];
  }, [bankQuestions]);

  const sessionOptions = useMemo(() => {
    const sessions = Array.from(
      new Set(bankQuestions.map((q) => q.session).filter((s) => Boolean(s) && s !== 'None'))
    );
    if (sessions.length === 0) {
      return [{ value: 'None', label: 'None' }];
    }
    return [
      { value: 'All', label: 'All' },
      ...sessions.map((s) => ({ value: s, label: s })),
    ];
  }, [bankQuestions]);

  const topicOptions = useMemo(() => {
    const topicsFromBank = Array.from(
      new Set(bankQuestions.map((q) => q.topic).filter(Boolean))
    );
    const knownTopics =
      dbTopics.length > 0
        ? dbTopics.map((t) => t.name)
        : CAMBRIDGE_TOPICS.map((t) => t.name);
    const allUniqueTopics = Array.from(new Set([...knownTopics, ...topicsFromBank]));

    if (allUniqueTopics.length === 0) {
      return [{ value: 'None', label: 'None' }];
    }
    return [
      { value: 'All', label: 'All' },
      ...allUniqueTopics.map((t, idx) => ({
        value: t,
        label: `${idx + 1}. ${t}`,
      })),
    ];
  }, [bankQuestions, dbTopics]);

  const reassignTopicOptions = useMemo(() => {
    const list = dbTopics.length > 0 ? dbTopics.map((t) => t.name) : CAMBRIDGE_TOPICS.map((t) => t.name);
    const fromBank = Array.from(new Set(bankQuestions.map((q) => q.topic).filter(Boolean)));
    return Array.from(new Set([...list, ...fromBank]));
  }, [dbTopics, bankQuestions]);

  const difficultyOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: 'Easy', label: 'Easy' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Hard', label: 'Hard' },
  ], []);

  const statusOptions = useMemo(() => [
    { value: 'All', label: 'All' },
    { value: 'Live', label: 'Live' },
    { value: 'Agent draft', label: 'Agent draft' },
    { value: 'Needs review', label: 'Needs review' },
    { value: 'Flagged', label: 'Flagged' },
  ], []);

  const filteredBankItems = useMemo(() => {
    return bankQuestions.filter((q) => {
      if (bankStatusFilter !== 'All' && q.st !== bankStatusFilter) {
        return false;
      }
      if (bankPaperFilter !== 'All' && q.paper !== bankPaperFilter) {
        return false;
      }
      if (bankSessionFilter !== 'All' && q.session !== bankSessionFilter) {
        return false;
      }
      if (bankTopicFilter !== 'All' && q.topic !== bankTopicFilter) {
        return false;
      }
      if (bankDifficultyFilter !== 'All' && q.diff !== bankDifficultyFilter) {
        return false;
      }
      if (bankSearch.trim()) {
        const query = bankSearch.toLowerCase();
        const matches =
          q.stem.toLowerCase().includes(query) ||
          q.id.toLowerCase().includes(query) ||
          q.cite.toLowerCase().includes(query) ||
          q.topic.toLowerCase().includes(query);
        if (!matches) return false;
      }
      return true;
    });
  }, [
    bankQuestions,
    bankStatusFilter,
    bankPaperFilter,
    bankSessionFilter,
    bankTopicFilter,
    bankDifficultyFilter,
    bankSearch,
  ]);

  useEffect(() => {
    setBankPage(1);
  }, [
    bankSearch,
    bankStatusFilter,
    bankPaperFilter,
    bankSessionFilter,
    bankTopicFilter,
    bankDifficultyFilter,
  ]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredBankItems.length / pageSize));
  const paginatedBankItems = filteredBankItems.slice(
    (bankPage - 1) * pageSize,
    bankPage * pageSize
  );

  useEffect(() => {
    if (bankPage > totalPages) {
      setBankPage(totalPages);
    }
  }, [totalPages, bankPage]);

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
        const updated = prev.filter((q) => !idsSet.has(q.id));
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
      setBankQuestions((prev) =>
        prev.map((q) => {
          if (selectedIds.has(q.id)) {
            return {
              ...q,
              st: newStatus,
              stCls: getStatusBadgeClass(newStatus),
              upd: 'Just now',
            };
          }
          return q;
        })
      );
      setSelectedIds(new Set());
      setConfirmationModal({ isOpen: false, type: 'delete' });
      showNotification(`Updated status to "${newStatus}" for ${count} question${count === 1 ? '' : 's'}`);
    } else if (confirmationModal.type === 'topic') {
      const newTopic = confirmationModal.payload as string;
      setBankQuestions((prev) =>
        prev.map((q) => {
          if (selectedIds.has(q.id)) {
            return {
              ...q,
              topic: newTopic,
              upd: 'Just now',
            };
          }
          return q;
        })
      );
      setSelectedIds(new Set());
      setConfirmationModal({ isOpen: false, type: 'delete' });
      showNotification(`Reassigned topic to "${newTopic}" for ${count} question${count === 1 ? '' : 's'}`);
    }
  };

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
    <div className="flex flex-col gap-6 p-2 sm:p-4 text-[#201e1d] font-body">
      {/* Top View Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-[#dcd3c4] pb-2 flex-wrap">
        <button
          onClick={() => setActiveSubTab('assign')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'assign'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          🚀 Assign Rounds / Homework
        </button>
        <button
          onClick={() => setActiveSubTab('bank')}
          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
            activeSubTab === 'bank'
              ? 'bg-[#201e1d] text-[#f9f4ed]'
              : 'bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
          }`}
        >
          📚 Question Bank & Verification
        </button>
      </div>

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
                      onClick={() => onOpenEditor?.(q.id)}
                      className="pt-2 flex items-start gap-2 text-xs hover:bg-[#eee7db]/50 p-1.5 rounded-xl transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-[#645c50] block">
                          {q.id} · {q.topic}
                        </span>
                        <span className="font-semibold text-[#201e1d] line-clamp-2 leading-tight">
                          {q.stem}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {q.agent && (
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
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-[#645c50]">Question bank</span>
              <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d] mt-0.5">
                {questionsLoading ? (
                  <span className="inline-flex items-center gap-2 text-xl text-[#645c50] animate-pulse">
                    <span className="w-4 h-4 border-2 border-[#c67139] border-t-transparent rounded-full animate-spin" />
                    Syncing live database...
                  </span>
                ) : (
                  `${bankQuestions.length} questions`
                )}
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
            </div>
          </div>

          {/* Search & Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a]" />
              <input
                type="text"
                placeholder="Search stems, IDs, citations..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs text-[#201e1d] outline-none focus:border-[#c67139]"
              />
            </div>
            <BankFilterDropdown
              label="Paper"
              value={bankPaperFilter}
              onChange={setBankPaperFilter}
              options={paperOptions}
            />
            <BankFilterDropdown
              label="Session"
              value={bankSessionFilter}
              onChange={setBankSessionFilter}
              options={sessionOptions}
            />
            <BankFilterDropdown
              label="Topic"
              value={bankTopicFilter}
              onChange={setBankTopicFilter}
              options={topicOptions}
              minWidth="min-w-[260px]"
            />
            <BankFilterDropdown
              label="Difficulty"
              value={bankDifficultyFilter}
              onChange={setBankDifficultyFilter}
              options={difficultyOptions}
            />
            <BankFilterDropdown
              label="Status"
              value={bankStatusFilter}
              onChange={setBankStatusFilter}
              options={statusOptions}
            />
            <button
              type="button"
              disabled={isLoadingLive}
              onClick={() => {
                fetchLiveQuestions();
                refetchQuestions();
                showNotification('Refreshed questions from Supabase');
              }}
              className="px-3 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Refresh questions from database"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoadingLive ? 'animate-spin text-[#c67139]' : 'text-[#645c50]'}`} />
              <span>Refresh 🔄</span>
            </button>
          </div>

          {/* Status Counter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            <button
              onClick={() => setBankStatusFilter('All')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'All' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              All {questionsLoading ? '...' : bankQuestions.length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Live')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Live' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Live {questionsLoading ? '...' : bankQuestions.filter((q) => q.st === 'Live').length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Agent draft')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
                bankStatusFilter === 'Agent draft' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              <span>Agent drafts</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-[#f9f4ed] text-[10px]">
                {questionsLoading ? '...' : bankQuestions.filter((q) => q.st === 'Agent draft').length}
              </span>
            </button>
            <button
              onClick={() => setBankStatusFilter('Needs review')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Needs review' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Needs review {questionsLoading ? '...' : bankQuestions.filter((q) => q.st === 'Needs review').length}
            </button>
            <button
              onClick={() => setBankStatusFilter('Flagged')}
              className={`px-3.5 py-1.5 rounded-full transition-all ${
                bankStatusFilter === 'Flagged' ? 'bg-[#ffe1d0] text-[#201e1d]' : 'text-[#645c50] hover:bg-[#eee7db]'
              }`}
            >
              Flagged {questionsLoading ? '...' : bankQuestions.filter((q) => q.st === 'Flagged').length}
            </button>
          </div>

          {/* Bank Table */}
          <div className="rounded-[24px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] p-4 sm:p-5 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[920px]">
                {/* Table Header with Master Checkbox */}
                <div className="sticky top-0 z-10 bg-[#f9f4ed] grid grid-cols-[38px_120px_2.3fr_1.1fr_1.1fr_0.7fr_0.6fr_0.8fr_0.6fr_44px] gap-2 items-center pb-2.5 text-[11px] font-bold uppercase tracking-wider text-[#645c50] border-b border-[#dcd3c4]">
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
                  <span>ID</span>
                  <span>Stem</span>
                  <span>Citation</span>
                  <span>Topic</span>
                  <span>Difficulty</span>
                  <span>1st try</span>
                  <span>Status</span>
                  <span>Updated</span>
                  <span className="text-center">Action</span>
                </div>

                {/* Selection helper banner */}
                {selectedIds.size > 0 && (
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

                <div className="max-h-[580px] overflow-y-auto divide-y divide-[#eee7db] pr-1">
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
                      return (
                        <div
                          key={item.id}
                          onClick={() => onOpenEditor?.(item.id)}
                          className={`grid grid-cols-[38px_120px_2.3fr_1.1fr_1.1fr_0.7fr_0.6fr_0.8fr_0.6fr_44px] gap-2 items-center py-2.5 text-xs cursor-pointer rounded-xl transition-colors px-1 ${
                            isSelected
                              ? 'bg-[#ffe1d0]/50 border-l-4 border-[#c67139]'
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
                          <span className="font-mono font-bold text-[#201e1d] truncate" title={item.id}>
                            {item.id}
                          </span>
                          <span className="font-bold text-[#201e1d] truncate" title={item.stem}>
                            {item.stem}
                          </span>
                          <span className="text-[#645c50] truncate" title={item.cite}>
                            {item.cite}
                          </span>
                          <span className="text-[#474238] truncate" title={item.topic}>
                            {item.topic}
                          </span>
                          <span className="font-medium">{item.diff}</span>
                          <span className="font-black text-[#201e1d]">{item.acc}</span>
                          <span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${item.stCls}`}
                            >
                              {item.st}
                            </span>
                          </span>
                          <span className="text-[#645c50]">{item.upd}</span>
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
          <div className="flex items-center gap-3 p-3.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs">
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

          {/* Floating Mass Actions Deck */}
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
                  className="w-full max-w-lg rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[6px_6px_0_#201e1d] p-6 sm:p-7 flex flex-col gap-4 max-h-[90vh] overflow-hidden"
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
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-[#dcd3c4] bg-[#eee7db]/50 p-2.5 divide-y divide-[#dcd3c4]">
                      {modalPreviewItems.map((item) => (
                        <div
                          key={item.id}
                          className="py-1.5 first:pt-0 last:pb-0 flex items-center justify-between gap-2.5 text-xs"
                        >
                          <span className="font-mono font-bold text-[#201e1d] shrink-0">{item.id}</span>
                          <span className="text-[#474238] truncate flex-1 font-medium">{item.stem}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f9f4ed] border border-[#dcd3c4] shrink-0 text-[#645c50]">
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
