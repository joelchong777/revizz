'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Settings2,
  Download,
  Save,
  Trash2,
  Check,
  Zap,
  Image as ImageIcon,
  Table,
  Calculator,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Filter,
  Shuffle,
  Send,
  Sparkles,
  LayoutGrid,
  Users,
  Calendar,
  Clock,
  KeyRound,
  RefreshCw,
  Copy,
  Plus,
  FileText,
  Upload,
  Edit3,
  FolderOpen,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
// RichMarkdown provides internal MarkdownErrorBoundary defensive wrapper
import { RichMarkdown } from '@/components/ui/RichMarkdown';
import Select, { SelectOption } from '@/components/ui/select';
import { useQuestions, useTopics, Question, resolveDiagramUrl } from '@/lib/questions';
import { useAuth } from '@/lib/auth';
import { CompilerDiagramPreview } from './CompilerDiagramPreview';
import {
  saveTestDraft,
  savePrintSnapshot,
  loadTestDraft,
  listTestDrafts,
  deleteTestDraft,
  duplicateTestDraft,
  renameTestDraft,
  exportTestDraftJson,
  importTestDraftJson,
  formatDefaultDraftTitle,
  DRAFT_CHANGE_EVENT,
  autoSelectQuestions,
  buildCompiledQuestions,
  SUBJECT_CATALOG,
  shuffleQuestionIds,
  computeTopicDistribution,
  saveOnlineAssignment,
  listOnlineAssignments
} from '@/lib/testCompiler';
import {
  SelectionFilter,
  SortOption,
  hasDataTable,
  isMathOrCalculation,
  getAvailableSeries,
  filterAndSortQuestions,
  countActiveFilters,
  parseCitationTagPills,
  stripCambridgeIgcse
} from '@/lib/compilerFilters';
import { TestPaperConfig, OnlineQuizAssignment, TopicDistributionItem } from '@/types/testCompiler';

const TARGET_COHORTS = [
  '10 Economics (0455)',
  '10 Biology (0610)',
  '10 Chemistry (0620)',
  '11 Physics (0625)'
];

export default function TestCompilerHub() {
  const { userProfile } = useAuth();
  const currentAccountId = useMemo(
    () => userProfile?.id || userProfile?.email || 'guest-educator-local',
    [userProfile?.id, userProfile?.email]
  );
  const currentAccountLabel = useMemo(
    () => userProfile?.display_name || userProfile?.email || 'Guest Educator',
    [userProfile?.display_name, userProfile?.email]
  );

  const { questions, loading: loadingQuestions } = useQuestions();
  const { topics, loading: loadingTopics } = useTopics();

  // --- Left Column / Filter State ---
  const [search, setSearch] = useState('');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(['all']);
  const selectedTopicId =
    selectedTopicIds.includes('all') || selectedTopicIds.length === 0
      ? 'all'
      : selectedTopicIds.join(',');
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const topicDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>('all');
  const [withDiagramsOnly, setWithDiagramsOnly] = useState(false);
  const [withTablesOnly, setWithTablesOnly] = useState(false);
  const [withMathOnly, setWithMathOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('paper');
  const [cardDensity, setCardDensity] = useState<'expanded' | 'compact'>('expanded');
  const [expandedCardIds, setExpandedCardIds] = useState<string[]>([]);

  // Close topic dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (topicDropdownRef.current && !topicDropdownRef.current.contains(event.target as Node)) {
        setIsTopicDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsTopicDropdownOpen(false);
      }
    }
    if (isTopicDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTopicDropdownOpen]);

  // --- Right Column (Test Config) State ---
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [subjectCode, setSubjectCode] = useState('0455');
  const subjectName = useMemo(() => {
    const found = SUBJECT_CATALOG.find((s) => s.code === subjectCode);
    return found ? found.name : 'Economics';
  }, [subjectCode]);
  const [testTitle, setTestTitle] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [dateString, setDateString] = useState('October 2026');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [testCode, setTestCode] = useState('');

  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includeCandidateHeader, setIncludeCandidateHeader] = useState(true);
  const [includeBubbleSheet, setIncludeBubbleSheet] = useState(true);
  const [includeMarkScheme, setIncludeMarkScheme] = useState(true);
  const [includeExplanations, setIncludeExplanations] = useState(true);

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Modals State ---
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoCount, setAutoCount] = useState<number>(10);
  const [autoTopicIds, setAutoTopicIds] = useState<string[]>(['all']);
  const autoTopicId =
    autoTopicIds.includes('all') || autoTopicIds.length === 0 ? 'all' : autoTopicIds[0];
  const setAutoTopicId = (id: string) => {
    setAutoTopicIds(id === 'all' ? ['all'] : [id]);
  };

  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<TestPaperConfig[]>([]);

  // --- Active Draft & Persistence Tracking ---
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<string | null>(null);
  const [lastSavedDraftBanner, setLastSavedDraftBanner] = useState<{
    id: string;
    title: string;
    questionCount: number;
    updated: boolean;
  } | null>(null);

  // --- Save Draft Modal State ---
  const [isSaveDraftModalOpen, setIsSaveDraftModalOpen] = useState(false);
  const [saveModalTitle, setSaveModalTitle] = useState('');
  const [saveModalNotes, setSaveModalNotes] = useState('');
  const [saveModalMode, setSaveModalMode] = useState<'update' | 'new'>('new');

  // --- Saved Drafts Manager Modal State ---
  const [draftSearch, setDraftSearch] = useState('');
  const [draftSubjectFilter, setDraftSubjectFilter] = useState('all');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editingDraftTitle, setEditingDraftTitle] = useState('');
  const [editingDraftNotes, setEditingDraftNotes] = useState('');
  const [draftModalFeedback, setDraftModalFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignCohort, setAssignCohort] = useState('10 Economics (0455)');
  const [cohortList, setCohortList] = useState<string[]>(TARGET_COHORTS);
  const [isCohortDropdownOpen, setIsCohortDropdownOpen] = useState(false);
  const [isCustomCohortInputOpen, setIsCustomCohortInputOpen] = useState(false);
  const [customCohortInput, setCustomCohortInput] = useState('');
  const cohortDropdownRef = useRef<HTMLDivElement>(null);

  const [assignDueDate, setAssignDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [assignDuration, setAssignDuration] = useState(45);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedRecentId, setCopiedRecentId] = useState<string | null>(null);
  const [publishedBanner, setPublishedBanner] = useState<{ testCode: string; cohortName: string } | null>(null);
  const [onlineAssignments, setOnlineAssignments] = useState<OnlineQuizAssignment[]>([]);

  const generateTestCode = (code: string = subjectCode) => {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REV-${code}-${rand}`;
  };

  useEffect(() => {
    if (isAssignModalOpen && !testCode) {
      setTestCode(generateTestCode(subjectCode));
    }
  }, [isAssignModalOpen, subjectCode, testCode]);

  const handleSetDueDateDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setAssignDueDate(d.toISOString().split('T')[0]);
  };

  const handleCopyCode = async () => {
    if (testCode) {
      try {
        await navigator.clipboard.writeText(testCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } catch {
        // Fallback
      }
    }
  };

  // Close cohort dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (cohortDropdownRef.current && !cohortDropdownRef.current.contains(event.target as Node)) {
        setIsCohortDropdownOpen(false);
        setIsCustomCohortInputOpen(false);
      }
    }
    if (isCohortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCohortDropdownOpen]);

  useEffect(() => {
    setOnlineAssignments(listOnlineAssignments());
  }, []);

  useEffect(() => {
    const accountDrafts = listTestDrafts(currentAccountId);
    setDrafts(accountDrafts);

    // Clean account switching guardrail: detach active draft if it doesn't belong to current account
    if (activeDraftId && !accountDrafts.some((d) => d.id === activeDraftId)) {
      setActiveDraftId(null);
      setLastSavedSnapshot(null);
      setLastSavedDraftBanner(null);
    }

    const handleDraftsChanged = () => {
      const updated = listTestDrafts(currentAccountId);
      setDrafts(updated);
      if (activeDraftId && !updated.some((d) => d.id === activeDraftId)) {
        setActiveDraftId(null);
        setLastSavedSnapshot(null);
        setLastSavedDraftBanner(null);
      }
    };
    window.addEventListener(DRAFT_CHANGE_EVENT, handleDraftsChanged);
    return () => {
      window.removeEventListener(DRAFT_CHANGE_EVENT, handleDraftsChanged);
    };
  }, [currentAccountId, activeDraftId]);

  const currentConfigSignature = useMemo(() => {
    return JSON.stringify({
      title: testTitle.trim(),
      notes: draftNotes.trim(),
      subjectCode,
      schoolName: schoolName.trim(),
      durationMinutes,
      testCode: testCode.trim(),
      dateString: dateString.trim(),
      includeCoverPage,
      includeCandidateHeader,
      includeBubbleSheet,
      includeMarkScheme,
      includeExplanations,
      questionIds: selectedQuestionIds,
    });
  }, [
    testTitle,
    draftNotes,
    subjectCode,
    schoolName,
    durationMinutes,
    testCode,
    dateString,
    includeCoverPage,
    includeCandidateHeader,
    includeBubbleSheet,
    includeMarkScheme,
    includeExplanations,
    selectedQuestionIds,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    if (!activeDraftId) {
      return selectedQuestionIds.length > 0 || testTitle.trim().length > 0;
    }
    return lastSavedSnapshot !== currentConfigSignature;
  }, [activeDraftId, lastSavedSnapshot, currentConfigSignature, selectedQuestionIds.length, testTitle]);

  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      if (draftSubjectFilter !== 'all' && d.subjectCode !== draftSubjectFilter) {
        return false;
      }
      if (draftSearch.trim().length > 0) {
        const q = draftSearch.toLowerCase();
        const matchTitle = (d.title || '').toLowerCase().includes(q);
        const matchNotes = (d.notes || '').toLowerCase().includes(q);
        const matchCode = (d.testCode || '').toLowerCase().includes(q);
        const matchSubject = `${d.subjectCode} ${d.subjectName || ''}`.toLowerCase().includes(q);
        const matchTopics = (d.topicSummary || []).some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchNotes && !matchCode && !matchSubject && !matchTopics) {
          return false;
        }
      }
      return true;
    });
  }, [drafts, draftSearch, draftSubjectFilter]);

  // --- Derived State & Series Extraction ---
  const availableSeries = useMemo(() => {
    return getAvailableSeries(questions);
  }, [questions]);

  const seriesOptions: SelectOption[] = useMemo(
    () => [
      { value: 'all', label: 'All Series / Years' },
      ...availableSeries.map((s) => ({ value: s, label: s })),
    ],
    [availableSeries]
  );

  const sortOptions: SelectOption[] = useMemo(
    () => [
      { value: 'paper', label: 'Paper Order' },
      { value: 'shortest', label: 'Shortest Stem' },
      { value: 'longest', label: 'Longest / Scenario' },
    ],
    []
  );

  const filteredQuestions = useMemo(() => {
    return filterAndSortQuestions(questions, {
      search,
      topicId: selectedTopicId,
      topicIds: selectedTopicIds,
      series: selectedSeries,
      selection: selectionFilter,
      selectedQuestionIds,
      withDiagramsOnly,
      withTablesOnly,
      withMathOnly,
      sortBy,
    });
  }, [
    questions,
    search,
    selectedTopicId,
    selectedTopicIds,
    selectedSeries,
    selectionFilter,
    selectedQuestionIds,
    withDiagramsOnly,
    withTablesOnly,
    withMathOnly,
    sortBy,
  ]);

  const activeFilterCount = useMemo(() => {
    return countActiveFilters({
      search,
      topicId: selectedTopicId,
      topicIds: selectedTopicIds,
      series: selectedSeries,
      selection: selectionFilter,
      withDiagramsOnly,
      withTablesOnly,
      withMathOnly,
      sortBy,
    });
  }, [
    search,
    selectedTopicId,
    selectedTopicIds,
    selectedSeries,
    selectionFilter,
    withDiagramsOnly,
    withTablesOnly,
    withMathOnly,
    sortBy,
  ]);

  const handleResetAllFilters = () => {
    setSearch('');
    setSelectedTopicIds(['all']);
    setSelectedSeries('all');
    setSelectionFilter('all');
    setWithDiagramsOnly(false);
    setWithTablesOnly(false);
    setWithMathOnly(false);
    setSortBy('paper');
  };

  const handleToggleTopic = (topicId: string) => {
    setSelectedTopicIds((prev) => {
      const withoutAll = prev.filter((id) => id !== 'all');
      if (withoutAll.includes(topicId)) {
        const next = withoutAll.filter((id) => id !== topicId);
        return next.length === 0 ? ['all'] : next;
      } else {
        return [...withoutAll, topicId];
      }
    });
  };

  const triggerLabel = useMemo(() => {
    const isAllOrEmpty = selectedTopicIds.includes('all') || selectedTopicIds.length === 0;
    if (isAllOrEmpty) {
      return `All Topics (${questions.length} Qs)`;
    }
    if (selectedTopicIds.length === 1) {
      const tid = selectedTopicIds[0];
      const t = topics.find((item) => item.id === tid);
      const count = questions.filter((q) => q.topic_id === tid).length;
      const topicLabel = t
        ? (t.orderIndex != null ? `Ch ${t.orderIndex} · ${t.name}` : t.name)
        : '1 Topic';
      return `${topicLabel} (${count} Qs)`;
    }
    const filteredCount = questions.filter(
      (q) => q.topic_id && selectedTopicIds.includes(q.topic_id)
    ).length;
    return `${selectedTopicIds.length} Topics Selected (${filteredCount} Qs)`;
  }, [selectedTopicIds, questions, topics]);

  const allFilteredSelected = useMemo(() => {
    if (filteredQuestions.length === 0) return false;
    return filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));
  }, [filteredQuestions, selectedQuestionIds]);

  const selectedQuestions = useMemo(() => {
    return selectedQuestionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean) as Question[];
  }, [selectedQuestionIds, questions]);

  const topicDistribution = useMemo(() => {
    return computeTopicDistribution(selectedQuestionIds, questions);
  }, [selectedQuestionIds, questions]);

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

  const generateConfig = (
    customId?: string,
    customTitle?: string,
    customNotes?: string
  ): TestPaperConfig => {
    const compiled = buildCompiledQuestions(selectedQuestionIds, questions);
    const resolvedTitle = customTitle !== undefined ? customTitle : testTitle;
    const resolvedNotes = customNotes !== undefined ? customNotes : draftNotes;
    const topicSummary = topicDistribution.map((t) => t.topic);
    const now = new Date().toISOString();

    return {
      id: customId || activeDraftId || Math.random().toString(36).substring(2, 9),
      title: resolvedTitle,
      subjectCode: subjectCode,
      subjectName: subjectName,
      schoolName: schoolName,
      durationMinutes: durationMinutes,
      totalMarks: selectedQuestionIds.length,
      testCode: testCode,
      dateString: dateString,
      includeCoverPage: includeCoverPage,
      includeCandidateHeader: includeCandidateHeader,
      includeBubbleSheet: includeBubbleSheet,
      includeMarkScheme: includeMarkScheme,
      includeExplanations: includeExplanations,
      notes: resolvedNotes,
      topicSummary: topicSummary.length > 0 ? topicSummary : undefined,
      ownerId: currentAccountId,
      ownerName: currentAccountLabel,
      ownerEmail: userProfile?.email || null,
      questionIds: selectedQuestionIds,
      compiledQuestions: compiled,
      createdAt: now,
      updatedAt: now,
    };
  };

  const handleOpenSaveDraftModal = () => {
    if (testTitle.trim().length > 0) {
      setSaveModalTitle(testTitle.trim());
    } else {
      const topTopic = topicDistribution[0]?.topic;
      const count = selectedQuestionIds.length;
      const suggested = `${subjectCode} ${subjectName} — ${topTopic || 'Mixed Topics'} (${count} Qs)`;
      setSaveModalTitle(suggested);
    }
    setSaveModalNotes(draftNotes);
    setSaveModalMode(activeDraftId ? 'update' : 'new');
    setIsSaveDraftModalOpen(true);
  };

  const handleAutoNameDraft = () => {
    const topTopic = topicDistribution[0]?.topic;
    const count = selectedQuestionIds.length;
    const name = `${subjectCode} ${subjectName} — ${topTopic || 'Mixed Topics'} (${count} Qs)`;
    setSaveModalTitle(name);
  };

  const handleConfirmSaveDraft = () => {
    const isUpdatingActive = saveModalMode === 'update' && activeDraftId !== null;
    const targetId = isUpdatingActive
      ? activeDraftId!
      : Math.random().toString(36).substring(2, 9);

    const finalTitle = saveModalTitle.trim() || formatDefaultDraftTitle({
      subjectCode,
      subjectName,
      topicSummary: topicDistribution.map((t) => t.topic),
      questionIds: selectedQuestionIds,
    });

    setTestTitle(finalTitle);
    setDraftNotes(saveModalNotes);

    const configToSave = generateConfig(targetId, finalTitle, saveModalNotes);
    const saved = saveTestDraft(configToSave, currentAccountId);

    setActiveDraftId(saved.id);
    const newSnapshot = JSON.stringify({
      title: (saved.title || '').trim(),
      notes: (saved.notes || '').trim(),
      subjectCode: saved.subjectCode,
      schoolName: (saved.schoolName || '').trim(),
      durationMinutes: saved.durationMinutes,
      testCode: (saved.testCode || '').trim(),
      dateString: (saved.dateString || 'October 2026').trim(),
      includeCoverPage: saved.includeCoverPage,
      includeCandidateHeader: saved.includeCandidateHeader,
      includeBubbleSheet: saved.includeBubbleSheet,
      includeMarkScheme: saved.includeMarkScheme,
      includeExplanations: saved.includeExplanations ?? true,
      questionIds: saved.questionIds,
    });
    setLastSavedSnapshot(newSnapshot);

    setDrafts(listTestDrafts(currentAccountId));
    setIsSaveDraftModalOpen(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    setLastSavedDraftBanner({
      id: saved.id,
      title: saved.title,
      questionCount: saved.questionIds.length,
      updated: isUpdatingActive,
    });
    setTimeout(() => {
      setLastSavedDraftBanner((prev) => (prev?.id === saved.id ? null : prev));
    }, 6000);
  };

  const handleQuickUpdateDraft = () => {
    if (!activeDraftId) {
      handleOpenSaveDraftModal();
      return;
    }
    const finalTitle = testTitle.trim() || formatDefaultDraftTitle({
      subjectCode,
      subjectName,
      topicSummary: topicDistribution.map((t) => t.topic),
      questionIds: selectedQuestionIds,
    });
    const configToSave = generateConfig(activeDraftId, finalTitle, draftNotes);
    const saved = saveTestDraft(configToSave, currentAccountId);

    setLastSavedSnapshot(currentConfigSignature);
    setDrafts(listTestDrafts(currentAccountId));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);

    setLastSavedDraftBanner({
      id: saved.id,
      title: saved.title,
      questionCount: saved.questionIds.length,
      updated: true,
    });
    setTimeout(() => {
      setLastSavedDraftBanner((prev) => (prev?.id === saved.id ? null : prev));
    }, 6000);
  };

  const handleStartNewDraft = () => {
    setActiveDraftId(null);
    setTestTitle('');
    setDraftNotes('');
    setSelectedQuestionIds([]);
    setLastSavedSnapshot(null);
    setIsDraftsModalOpen(false);
  };

  const handleGeneratePDF = () => {
    const config = generateConfig();
    savePrintSnapshot(config);
    if (activeDraftId) {
      saveTestDraft(config, currentAccountId);
    }
    window.open(`/portal/compiler/print?testId=${config.id}`, '_blank');
  };

  const handleAutoCompile = () => {
    const topicIdsParam =
      autoTopicIds.includes('all') || autoTopicIds.length === 0 ? undefined : autoTopicIds;
    const ids = autoSelectQuestions(
      {
        count: autoCount,
        topicIds: topicIdsParam,
      },
      questions
    );
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
    setDrafts(listTestDrafts(currentAccountId));
    setDraftSearch('');
    setDraftSubjectFilter('all');
    setEditingDraftId(null);
    setDraftModalFeedback(null);
    setIsDraftsModalOpen(true);
  };

  const handleLoadDraft = (draft: TestPaperConfig) => {
    setActiveDraftId(draft.id);
    setDraftNotes(draft.notes || '');
    setTestTitle(draft.title || '');
    if (draft.subjectCode) setSubjectCode(draft.subjectCode);
    setSchoolName(draft.schoolName || '');
    setDateString(draft.dateString || 'October 2026');
    setDurationMinutes(draft.durationMinutes || 45);
    setTestCode(draft.testCode || '');
    setIncludeCoverPage(draft.includeCoverPage ?? true);
    setIncludeCandidateHeader(draft.includeCandidateHeader ?? true);
    setIncludeBubbleSheet(draft.includeBubbleSheet ?? true);
    setIncludeMarkScheme(draft.includeMarkScheme ?? true);
    if (draft.includeExplanations !== undefined) setIncludeExplanations(draft.includeExplanations);
    setSelectedQuestionIds(draft.questionIds || []);

    const snapshot = JSON.stringify({
      title: (draft.title || '').trim(),
      notes: (draft.notes || '').trim(),
      subjectCode: draft.subjectCode || subjectCode,
      schoolName: (draft.schoolName || '').trim(),
      durationMinutes: draft.durationMinutes || 45,
      testCode: (draft.testCode || '').trim(),
      dateString: (draft.dateString || 'October 2026').trim(),
      includeCoverPage: draft.includeCoverPage ?? true,
      includeCandidateHeader: draft.includeCandidateHeader ?? true,
      includeBubbleSheet: draft.includeBubbleSheet ?? true,
      includeMarkScheme: draft.includeMarkScheme ?? true,
      includeExplanations: draft.includeExplanations ?? true,
      questionIds: draft.questionIds || [],
    });
    setLastSavedSnapshot(snapshot);
    setIsDraftsModalOpen(false);
  };

  const handleDeleteDraft = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    deleteTestDraft(id, currentAccountId);
    if (activeDraftId === id) {
      setActiveDraftId(null);
      setLastSavedSnapshot(null);
    }
    setDrafts(listTestDrafts(currentAccountId));
    setDraftModalFeedback('Draft deleted.');
    setTimeout(() => setDraftModalFeedback(null), 3000);
  };

  const handleDuplicateDraft = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const dup = duplicateTestDraft(id, undefined, currentAccountId);
    if (dup) {
      setDrafts(listTestDrafts(currentAccountId));
      setDraftModalFeedback(`Draft duplicated as "${dup.title}"`);
      setTimeout(() => setDraftModalFeedback(null), 3000);
    }
  };

  const handleStartRenameDraft = (draft: TestPaperConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDraftId(draft.id);
    setEditingDraftTitle(draft.title || '');
    setEditingDraftNotes(draft.notes || '');
  };

  const handleSaveRenameDraft = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = renameTestDraft(id, editingDraftTitle, editingDraftNotes, currentAccountId);
    if (updated) {
      if (activeDraftId === id) {
        setTestTitle(updated.title);
        setDraftNotes(updated.notes || '');
      }
      setDrafts(listTestDrafts(currentAccountId));
      setEditingDraftId(null);
      setDraftModalFeedback('Draft updated successfully.');
      setTimeout(() => setDraftModalFeedback(null), 3000);
    }
  };

  const handleCancelRenameDraft = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDraftId(null);
  };

  const handleExportDraft = (draft: TestPaperConfig, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const jsonStr = exportTestDraftJson(draft);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = (draft.title || 'draft')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      link.href = url;
      link.download = `${safeTitle || 'revizz-test-draft'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDraftModalFeedback('Draft exported as JSON.');
      setTimeout(() => setDraftModalFeedback(null), 3000);
    } catch (err) {
      setDraftModalFeedback('Failed to export draft.');
      setTimeout(() => setDraftModalFeedback(null), 3000);
    }
  };

  const handleImportDraftFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = importTestDraftJson(content, currentAccountId);
        setDrafts(listTestDrafts(currentAccountId));
        setDraftModalFeedback(`Imported draft "${imported.title}" (${imported.questionIds.length} Qs)!`);
        setTimeout(() => setDraftModalFeedback(null), 4000);
      } catch (err: any) {
        setDraftModalFeedback(`Import failed: ${err?.message || 'Invalid draft JSON'}`);
        setTimeout(() => setDraftModalFeedback(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePublishAssignment = () => {
    const codeToUse = testCode.trim() || generateTestCode(subjectCode);
    const newAssignment: OnlineQuizAssignment = {
      id: Math.random().toString(36).substring(7),
      title: testTitle || `${subjectName} Assessment`,
      subjectCode: subjectCode,
      subjectName: subjectName,
      cohortName: assignCohort,
      dueDate: assignDueDate,
      durationMinutes: assignDuration,
      questionIds: selectedQuestionIds,
      testCode: codeToUse,
      createdAt: new Date().toISOString(),
    };
    saveOnlineAssignment(newAssignment);
    setOnlineAssignments(listOnlineAssignments());
    setPublishedBanner({
      testCode: newAssignment.testCode,
      cohortName: newAssignment.cohortName,
    });
    setIsAssignModalOpen(false);
  };

  // Close modals on Escape key & Cmd/Ctrl+S shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isSaveDraftModalOpen) {
          handleConfirmSaveDraft();
        } else {
          handleOpenSaveDraftModal();
        }
      } else if (e.key === 'Escape') {
        if (isLayoutModalOpen) {
          setIsLayoutModalOpen(false);
        } else if (isSaveDraftModalOpen) {
          setIsSaveDraftModalOpen(false);
        } else if (isDraftsModalOpen) {
          setIsDraftsModalOpen(false);
        } else if (isCohortDropdownOpen) {
          setIsCohortDropdownOpen(false);
          setIsCustomCohortInputOpen(false);
        } else if (isAutoModalOpen) {
          setIsAutoModalOpen(false);
        } else if (isAssignModalOpen) {
          setIsAssignModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isLayoutModalOpen,
    isSaveDraftModalOpen,
    isDraftsModalOpen,
    isCohortDropdownOpen,
    isAutoModalOpen,
    isAssignModalOpen,
    saveModalTitle,
    saveModalNotes,
    saveModalMode,
    activeDraftId,
    testTitle,
    draftNotes,
    selectedQuestionIds,
    subjectCode,
    subjectName,
    schoolName,
    durationMinutes,
    testCode,
    dateString,
    includeCoverPage,
    includeCandidateHeader,
    includeBubbleSheet,
    includeMarkScheme,
    includeExplanations,
    topicDistribution,
    questions,
  ]);

  const isTopicFiltered = selectedTopicIds.length > 0 && !selectedTopicIds.includes('all');

  return (
    <div className="flex flex-col gap-6 text-[#201e1d] font-body pb-12">
      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
        {/* LEFT COLUMN: Question Bank Canvas */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* Sleek, Compact Sticky Header Bar */}
          <div className="sticky top-0 z-10 px-4 py-2.5 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_0_rgba(32,30,29,0.15)] flex items-center justify-between gap-3 flex-wrap backdrop-blur-sm">
            {/* Search Input (moved from Question Filters) */}
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <label htmlFor="compiler-search-input" className="sr-only">
                Search stems, question IDs, citations, and option texts
              </label>
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a] pointer-events-none" aria-hidden="true" />
              <input
                id="compiler-search-input"
                type="text"
                placeholder="Search stems, citations, IDs, options..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search questions by stem, citations, IDs, or option text"
                className="w-full py-1.5 pl-8 pr-7 rounded-xl bg-white border border-[#dcd3c4] text-xs font-medium text-[#201e1d] focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 hover:border-[#201e1d] placeholder:text-[#a19786] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search query"
                  title="Clear search query"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d] p-0.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] active:translate-y-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Card Density Toggle */}
              <button
                type="button"
                onClick={() => setCardDensity((prev) => (prev === 'expanded' ? 'compact' : 'expanded'))}
                aria-label={`Switch to ${cardDensity === 'expanded' ? 'Compact' : 'Expanded'} card density`}
                title={`Card Density: ${cardDensity}`}
                className="px-2.5 py-1 rounded-xl bg-white border border-[#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <LayoutGrid className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                <span>{cardDensity === 'expanded' ? 'Compact' : 'Expanded'}</span>
              </button>

              <button
                type="button"
                onClick={handleSelectAllFiltered}
                aria-label={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
                title={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
                className="text-xs font-bold text-[#c67139] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-2 rounded-md transition-all active:translate-y-0.5 cursor-pointer ml-1"
              >
                {allFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>
          </div>

          {/* Scrollable Question Cards Container */}
          <div className="h-[calc(100vh-140px)] min-h-[520px] overflow-y-auto pr-2 flex flex-col gap-4">
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  aria-label={`Question ${stripCambridgeIgcse(q.citation || q.id)}: ${q.topic}. ${isSelected ? 'Selected' : 'Not selected'}`}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 active:translate-y-0.5 ${
                    isSelected
                      ? 'border-[#728157] bg-[#f0fae1] shadow-[4px_4px_0_0_#728157]'
                      : 'border-[#dcd3c4] bg-[#f9f4ed] shadow-sm hover:border-[#a19786]'
                  }`}
                  onClick={() => handleToggleQuestion(q.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleToggleQuestion(q.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {parseCitationTagPills(q.citation, q.id).map((pill, pIdx) => {
                        let pillClass = 'px-2.5 py-0.5 rounded-full bg-[#eee7db] text-[#474238] border border-[#c8beae] font-mono text-[11px] font-bold';
                        if (pill.kind === 'subject') {
                          pillClass = 'px-2.5 py-0.5 rounded-full bg-[#e3eed4] text-[#273818] border border-[#94a878] text-[11px] font-bold';
                        } else if (pill.kind === 'paper') {
                          pillClass = 'px-2.5 py-0.5 rounded-full bg-[#ffe1d0] text-[#9c4100] border border-[#e09f77] font-mono text-[11px] font-bold';
                        } else if (pill.kind === 'series') {
                          pillClass = 'px-2.5 py-0.5 rounded-full bg-[#dff0f7] text-[#18526b] border border-[#8ec3d8] text-[11px] font-bold';
                        } else if (pill.kind === 'question') {
                          pillClass = 'px-2.5 py-0.5 rounded-full bg-[#fef0c7] text-[#854d0e] border border-[#e8c468] font-mono text-[11px] font-bold';
                        }
                        return (
                          <span key={`${pill.kind}-${pIdx}`} className={pillClass}>
                            {pill.label}
                          </span>
                        );
                      })}
                      {q.topic && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ede8f5] text-[#4a3875] border border-[#bfb2d9] text-[11px] font-bold">
                          {q.topic}
                        </span>
                      )}
                      {q.image_url && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] text-[#c67139] border border-[#f0c2a8] text-[11px] font-bold flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" aria-hidden="true" /> Diagram
                        </span>
                      )}
                      {hasDataTable(q.stem_markdown, q) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#e1f0fa] text-[#2c6e91] border border-[#aed2e6] text-[11px] font-bold flex items-center gap-1">
                          <Table className="w-3 h-3" aria-hidden="true" /> Table
                        </span>
                      )}
                      {isMathOrCalculation(q.stem_markdown) && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ede8f5] text-[#5e4b8b] border border-[#cdc2e8] text-[11px] font-bold flex items-center gap-1">
                          <Calculator className="w-3 h-3" aria-hidden="true" /> Math
                        </span>
                      )}
                    </div>
                    <div
                      aria-hidden="true"
                      className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#728157] bg-[#728157] text-white'
                          : 'border-[#c0b6a5] bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-[#201e1d] font-medium leading-relaxed mb-3">
                    <RichMarkdown content={q.stem_markdown || ''} variant="cambridge" />
                  </div>

                  {q.image_url && (
                    <div className="mb-3">
                      <CompilerDiagramPreview
                        imageUrl={q.image_url}
                        citation={stripCambridgeIgcse(q.citation || q.id)}
                        altText={q.citation ? `Diagram for ${stripCambridgeIgcse(q.citation)}` : 'Question diagram'}
                      />
                    </div>
                  )}

                  {/* Options Rendering: Compact vs Expanded */}
                  {cardDensity === 'compact' ? (
                    <div className="pt-2 border-t border-[#dcd3c4]/70">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCardIds((prev) =>
                            prev.includes(q.id) ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                          );
                        }}
                        aria-expanded={expandedCardIds.includes(q.id)}
                        aria-label={`${expandedCardIds.includes(q.id) ? 'Hide' : 'Preview'} options for question ${stripCambridgeIgcse(q.citation || q.id)}`}
                        className="text-xs font-bold text-[#c67139] hover:underline flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c67139] rounded py-0.5"
                      >
                        {expandedCardIds.includes(q.id) ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Hide Options</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Preview Options (4)</span>
                          </>
                        )}
                      </button>
                      {expandedCardIds.includes(q.id) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
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
                                <RichMarkdown content={opt.text_markdown} variant="plain" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
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
                            <RichMarkdown content={opt.text_markdown} variant="plain" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {questions.length === 0 ? (
              <div className="text-center py-16 px-4 bg-[#f9f4ed] rounded-3xl border-2 border-dashed border-[#dcd3c4] text-[#645c50] flex flex-col items-center justify-center gap-3">
                <div className="text-3xl">📝</div>
                <span className="font-heading font-black text-base text-[#201e1d]">Question Bank is empty</span>
                <span className="font-medium text-xs max-w-sm">
                  Question Bank is empty. Ingest exam papers in App Admin to assemble tests.
                </span>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-16 px-4 bg-[#f9f4ed] rounded-3xl border-2 border-dashed border-[#dcd3c4] text-[#645c50] flex flex-col items-center justify-center gap-3">
                <span className="font-bold text-sm">No questions match your filters.</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="px-4 py-2 rounded-full bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-sm hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* RIGHT COLUMN: Controls & Test Assembly Drawer */}
        <div className="flex flex-col gap-3.5 lg:sticky lg:top-4 min-w-0">
          {/* Panel 1: Compact Question Filters & Tools (shrink-0) */}
          <div className="p-3 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_0_rgba(32,30,29,0.15)] flex flex-col gap-2.5 shrink-0">
            {/* Header: Title, Found Badge, Reset Button, Select All Quick Toggle, Collapse Toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Filter className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                  <span className="font-heading font-black text-sm text-[#201e1d]">Question Filters</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#eee7db] text-[10px] font-bold text-[#645c50] shrink-0">
                  {filteredQuestions.length}/{questions.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    aria-label={`Reset ${activeFilterCount} active filters`}
                    title="Reset all active filters"
                    className="px-2 py-0.5 rounded-full bg-white border border-[#c67139] text-[#c67139] text-[10px] font-bold hover:bg-[#ffe1d0] flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] active:translate-y-0.5 transition-all shadow-xs"
                  >
                    <RotateCcw className="w-2.5 h-2.5" aria-hidden="true" />
                    <span>Reset ({activeFilterCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  aria-label={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
                  title={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
                  className="text-[11px] font-bold text-[#c67139] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] rounded px-1 transition-all active:translate-y-0.5 cursor-pointer"
                >
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  aria-expanded={isFiltersExpanded}
                  aria-label={isFiltersExpanded ? 'Collapse filters' : 'Expand filters'}
                  title={isFiltersExpanded ? 'Collapse filters' : 'Expand filters'}
                  className="p-1 rounded-lg text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] active:translate-y-0.5 transition-all cursor-pointer"
                >
                  {isFiltersExpanded ? (
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsed Active Filter Summary Strip */}
            {!isFiltersExpanded && activeFilterCount > 0 && (
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-[#dcd3c4] overflow-x-auto text-[10px] text-[#645c50]">
                <span className="font-bold text-[#c67139] shrink-0">Active:</span>
                <div className="flex items-center gap-1 flex-nowrap shrink-0">
                  {search && (
                    <span className="px-1.5 py-0.5 rounded bg-[#eee7db] text-[#201e1d] font-medium max-w-[90px] truncate" title={`Search: ${search}`}>
                      &ldquo;{search}&rdquo;
                    </span>
                  )}
                  {selectedTopicIds.length > 0 && !selectedTopicIds.includes('all') &&
                    selectedTopicIds.map((tid) => {
                      const topic = topics.find((t) => t.id === tid);
                      const label = topic
                        ? topic.orderIndex != null
                          ? `Ch ${topic.orderIndex}`
                          : topic.name
                        : tid;
                      const fullName = topic?.name || tid;
                      return (
                        <span
                          key={tid}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#eee7db] text-[#201e1d] font-medium max-w-[110px] truncate"
                          title={fullName}
                        >
                          <span className="truncate">{label}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTopicIds((prev) => {
                                const next = prev.filter((id) => id !== tid);
                                return next.length === 0 ? ['all'] : next;
                              });
                            }}
                            className="hover:text-[#c67139] p-0.5 cursor-pointer"
                            aria-label={`Remove topic filter ${fullName}`}
                          >
                            <X className="w-2.5 h-2.5" aria-hidden="true" />
                          </button>
                        </span>
                      );
                    })}
                  {selectedSeries !== 'all' && (
                    <span className="px-1.5 py-0.5 rounded bg-[#eee7db] text-[#201e1d] font-medium">
                      {selectedSeries}
                    </span>
                  )}
                  {selectionFilter !== 'all' && (
                    <span className="px-1.5 py-0.5 rounded bg-[#eee7db] text-[#201e1d] font-medium capitalize">
                      {selectionFilter}
                    </span>
                  )}
                  {withDiagramsOnly && (
                    <span className="px-1.5 py-0.5 rounded bg-[#ffe1d0] text-[#c67139] font-medium">
                      Diagrams
                    </span>
                  )}
                  {withTablesOnly && (
                    <span className="px-1.5 py-0.5 rounded bg-[#e1f0fa] text-[#2c6e91] font-medium">
                      Tables
                    </span>
                  )}
                  {withMathOnly && (
                    <span className="px-1.5 py-0.5 rounded bg-[#ede8f5] text-[#5e4b8b] font-medium">
                      Math
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible Body */}
            {isFiltersExpanded && (
              <div className="flex flex-col gap-2.5 pt-1 border-t border-[#dcd3c4]">
                {/* Dropdowns Grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="col-span-2 relative" ref={topicDropdownRef}>
                    <label htmlFor="compiler-topic-filter" className="sr-only">
                      Topic
                    </label>
                    <button
                      id="compiler-topic-filter"
                      data-testid="compiler-topic-filter-trigger"
                      type="button"
                      onClick={() => setIsTopicDropdownOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={isTopicDropdownOpen}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-bold focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 transition-all cursor-pointer text-left ${
                        isTopicFiltered
                          ? 'bg-[#faeee5] border-[#c67139] text-[#c67139]'
                          : 'bg-white border-[#dcd3c4] text-[#201e1d] hover:border-[#201e1d]'
                      }`}
                    >
                      <span className="truncate mr-2">{triggerLabel}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                          isTopicFiltered ? 'text-[#c67139]' : 'text-[#645c50]'
                        } ${isTopicDropdownOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    {/* Removable chips in expanded view when filtered */}
                    {selectedTopicIds.length > 0 && !selectedTopicIds.includes('all') && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedTopicIds.map((tid) => {
                          const topic = topics.find((t) => t.id === tid);
                          const label = topic
                            ? topic.orderIndex != null
                              ? `Ch ${topic.orderIndex}`
                              : topic.name
                            : tid;
                          const fullName = topic?.name || tid;
                          return (
                            <span
                              key={tid}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#faeee5] border border-[#c67139]/30 text-[10px] font-bold text-[#c67139] max-w-[150px] truncate"
                              title={fullName}
                            >
                              <span className="truncate">{label}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedTopicIds((prev) => {
                                    const next = prev.filter((id) => id !== tid);
                                    return next.length === 0 ? ['all'] : next;
                                  });
                                }}
                                className="hover:text-[#201e1d] p-0.5 cursor-pointer"
                                aria-label={`Remove topic filter ${fullName}`}
                              >
                                <X className="w-2.5 h-2.5" aria-hidden="true" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Popover Menu */}
                    {isTopicDropdownOpen && (
                      <div
                        data-testid="compiler-topic-filter-menu"
                        role="listbox"
                        aria-multiselectable="true"
                        className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-[#201e1d] rounded-2xl shadow-offset-3 p-2 max-h-[320px] overflow-y-auto"
                      >
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#eee7db] px-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTopicIds(['all'])}
                            className="text-[11px] font-bold text-[#c67139] hover:underline cursor-pointer"
                          >
                            All Topics
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedTopicIds([])}
                            className="text-[11px] font-medium text-[#82796a] hover:text-[#201e1d] hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>

                        <div className="flex flex-col gap-1">
                          {topics.map((t) => {
                            const isChecked =
                              !selectedTopicIds.includes('all') && selectedTopicIds.includes(t.id);
                            const qCount = questions.filter((q) => q.topic_id === t.id).length;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                role="option"
                                aria-selected={isChecked}
                                onClick={() => handleToggleTopic(t.id)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors cursor-pointer ${
                                  isChecked ? 'bg-[#faeee5]' : 'hover:bg-[#f4ece1]'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                    isChecked
                                      ? 'bg-[#c67139] border-[#c67139] text-white'
                                      : 'border-[#dcd3c4] bg-white'
                                  }`}
                                >
                                  {isChecked && (
                                    <Check className="w-3 h-3 stroke-[3]" aria-hidden="true" />
                                  )}
                                </div>
                                {t.orderIndex != null && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-[#eee7db] text-[10px] font-bold text-[#645c50] shrink-0">
                                    Ch {t.orderIndex}
                                  </span>
                                )}
                                <span
                                  className="text-xs font-semibold text-[#201e1d] truncate flex-1"
                                  title={t.name}
                                >
                                  {t.name}
                                </span>
                                <span className="text-[10px] font-medium text-[#82796a] shrink-0 px-1.5 py-0.5 rounded-full bg-[#eee7db]">
                                  {qCount} Qs
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="compiler-series-filter" className="sr-only">
                      Exam Series / Year
                    </label>
                    <Select
                      id="compiler-series-filter"
                      aria-label="Filter by exam series or year"
                      value={selectedSeries}
                      onChange={(val) => setSelectedSeries(val)}
                      options={seriesOptions}
                      variant="button"
                      isActive={selectedSeries !== 'all'}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="compiler-sort-control" className="sr-only">
                      Sort By
                    </label>
                    <Select
                      id="compiler-sort-control"
                      aria-label="Sort questions"
                      value={sortBy}
                      onChange={(val) => setSortBy(val as SortOption)}
                      options={sortOptions}
                      variant="button"
                      align="right"
                      isActive={sortBy !== 'paper'}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Selection Status Segmented Pill */}
                <div
                  className="grid grid-cols-3 p-0.5 rounded-xl bg-[#eee7db] text-[11px] font-bold"
                  role="radiogroup"
                  aria-label="Selection status filter"
                >
                  {(
                    [
                      { id: 'all', label: 'All', count: questions.length },
                      { id: 'selected', label: 'Selected', count: selectedQuestionIds.length },
                      {
                        id: 'unselected',
                        label: 'Unselected',
                        count: Math.max(0, questions.length - selectedQuestionIds.length),
                      },
                    ] as const
                  ).map((opt) => {
                    const isActive = selectionFilter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isActive}
                        aria-label={`Filter by ${opt.label} (${opt.count} questions)`}
                        onClick={() => setSelectionFilter(opt.id)}
                        className={`py-1 px-1 rounded-lg transition-all flex items-center justify-center gap-1 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] cursor-pointer ${
                          isActive
                            ? 'bg-white text-[#201e1d] shadow-[0_1px_2px_rgba(0,0,0,0.1)] border border-[#dcd3c4]'
                            : 'text-[#645c50] hover:text-[#201e1d]'
                        }`}
                      >
                        <span className="truncate">{opt.label}</span>
                        <span
                          className={`text-[10px] font-mono px-1 rounded-full ${
                            isActive ? 'bg-[#ffe1d0] text-[#c67139]' : 'bg-[#e2d9cb] text-[#645c50]'
                          }`}
                        >
                          {opt.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Content Type Chips - Uniform 3-Column Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={withDiagramsOnly}
                    aria-label="Filter questions with diagrams only"
                    title="Toggle diagrams only filter"
                    onClick={() => setWithDiagramsOnly(!withDiagramsOnly)}
                    className={`justify-center py-1 px-2 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] cursor-pointer ${
                      withDiagramsOnly
                        ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                        : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                    }`}
                  >
                    <ImageIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Diagrams</span>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={withTablesOnly}
                    aria-label="Filter questions with data tables only"
                    title="Toggle data tables only filter"
                    onClick={() => setWithTablesOnly(!withTablesOnly)}
                    className={`justify-center py-1 px-2 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] cursor-pointer ${
                      withTablesOnly
                        ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                        : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                    }`}
                  >
                    <Table className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Tables</span>
                  </button>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={withMathOnly}
                    aria-label="Filter questions with calculations or math formulas only"
                    title="Toggle calculations / math filter"
                    onClick={() => setWithMathOnly(!withMathOnly)}
                    className={`justify-center py-1 px-2 rounded-xl border text-[11px] font-bold flex items-center gap-1 transition-all active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] cursor-pointer ${
                      withMathOnly
                        ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                        : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]'
                    }`}
                  >
                    <Calculator className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Math</span>
                  </button>
                </div>

                {/* Single-Row 4-Column Quick Utility Bar */}
                <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-[#dcd3c4]/70">
                  <button
                    type="button"
                    onClick={() => setIsAutoModalOpen(true)}
                    title="Auto-generate question preset"
                    aria-label="Auto-generate question preset"
                    className="justify-center py-1 px-1 rounded-xl bg-[#f0fae1] border border-[#8fa073] text-[11px] font-bold text-[#3d472b] hover:bg-[#e1eecc] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] flex items-center gap-1 transition-all cursor-pointer shadow-xs truncate"
                  >
                    <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Preset</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenDrafts}
                    title="View and load saved test drafts"
                    aria-label="View and load saved test drafts"
                    className="justify-center py-1 px-1 rounded-xl bg-white border border-[#dcd3c4] text-[11px] font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] flex items-center gap-1 transition-all cursor-pointer shadow-xs truncate"
                  >
                    <FolderOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Drafts{drafts.length > 0 ? ` (${drafts.length})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOnlineAssignments(listOnlineAssignments());
                      setIsAssignModalOpen(true);
                    }}
                    title="Manage online quiz assignments"
                    aria-label="Manage online quiz assignments"
                    className="justify-center py-1 px-1 rounded-xl bg-[#f0fae1] border border-[#8fa073] text-[11px] font-bold text-[#3d472b] hover:bg-[#e1eecc] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] flex items-center gap-1 transition-all cursor-pointer shadow-xs truncate"
                  >
                    <Send className="w-3 h-3 shrink-0 text-[#556b2f]" aria-hidden="true" />
                    <span className="truncate">Assign{onlineAssignments.length > 0 ? ` (${onlineAssignments.length})` : ''}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearSelection}
                    title="Clear all selected questions"
                    aria-label="Clear all selected questions"
                    disabled={selectedQuestionIds.length === 0}
                    className="justify-center py-1 px-1 rounded-xl bg-white border border-[#dcd3c4] text-[11px] font-bold text-[#474238] hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 truncate"
                  >
                    <X className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">Clear</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Panel 2: Dedicated Test Assembly Drawer (compact, shrink-0) */}
          <aside
            id="test-assembly-drawer"
            aria-label="Test Assembly Drawer"
            className="shrink-0 flex flex-col p-4 rounded-3xl bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] gap-2.5"
          >
            {/* Summary Header */}
            <div className="shrink-0 flex items-center justify-between border-b-[1.5px] border-[#dcd3c4] pb-3">
              <div>
                <h2 className="font-heading text-lg font-black text-[#201e1d]">Test Assembly</h2>
                <div className="flex gap-2 text-xs font-bold text-[#645c50] mt-0.5">
                  <span>{selectedQuestionIds.length} Questions</span>
                  <span>•</span>
                  <span>{selectedQuestionIds.length} Marks</span>
                  <span>•</span>
                  <span>~{estimatedTime} mins</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenDrafts}
                  title="Open Saved Drafts Manager"
                  aria-label={`Open Saved Drafts (${drafts.length})`}
                  className="px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-black text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 shadow-[2px_2px_0_0_#201e1d] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Drafts ({drafts.length})</span>
                </button>
                <div
                  title={`${selectedQuestionIds.length} questions selected`}
                  className="w-10 h-10 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center font-black text-[#201e1d] shadow-offset-2 text-sm shrink-0"
                >
                  {selectedQuestionIds.length}
                </div>
              </div>
            </div>

            {/* Always-Visible Draft Identity & Title Strip */}
            <div className="shrink-0 flex flex-col gap-2 border-b-[1.5px] border-[#dcd3c4] py-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="assessment-title-input" className="text-[11px] font-black uppercase tracking-wider text-[#645c50] flex items-center gap-1">
                    <FileText className="w-3 h-3 text-[#201e1d]" aria-hidden="true" />
                    <span>Assessment Title</span>
                  </label>
                  {activeDraftId ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                          hasUnsavedChanges
                            ? 'bg-[#ffe1d0] text-[#c67139] border-[#c67139]'
                            : 'bg-[#e4ede1] text-[#3d472b] border-[#8fa073]'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${hasUnsavedChanges ? 'bg-[#c67139] animate-pulse' : 'bg-[#556b2f]'}`} />
                        {hasUnsavedChanges ? 'Unsaved edits' : 'Saved'}
                      </span>
                      {hasUnsavedChanges && (
                        <button
                          type="button"
                          onClick={handleQuickUpdateDraft}
                          title="Quick save changes to active draft"
                          aria-label="Quick update draft"
                          className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#c67139] text-[#f9f4ed] hover:bg-[#b2622d] border border-[#201e1d] active:translate-y-0.5 transition-all cursor-pointer shadow-[1px_1px_0_0_#201e1d]"
                        >
                          Quick Update
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleStartNewDraft}
                        title="Start a fresh blank paper"
                        aria-label="New draft"
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg bg-white text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] border border-[#dcd3c4] active:translate-y-0.5 transition-all cursor-pointer"
                      >
                        New Draft
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-[#8c8273]">Unsaved new paper</span>
                  )}
                </div>
                <div className="relative flex items-center">
                  <input
                    id="assessment-title-input"
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder={`${subjectCode} ${subjectName} Assessment...`}
                    aria-label="Assessment or draft title"
                    className="w-full px-3 py-2 pr-8 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] placeholder-[#8c8273] focus:outline-none focus:ring-2 focus:ring-[#201e1d] shadow-[2px_2px_0_0_rgba(32,30,29,0.1)] transition-all"
                  />
                  {testTitle.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTestTitle('')}
                      title="Clear title"
                      aria-label="Clear title"
                      className="absolute right-2 text-[#8c8273] hover:text-[#201e1d] p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </div>


            {/* Topic Distribution Breakdown Strip */}
            {selectedQuestions.length > 0 && topicDistribution.length > 0 && (
              <div className="shrink-0 p-2.5 rounded-2xl bg-[#eee7db]/80 border border-[#dcd3c4] flex flex-col gap-1.5 my-0.5">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#645c50]">
                  <span>Topic Coverage Breakdown</span>
                  <span>{topicDistribution.length} Topics</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                  {topicDistribution.map((item) => (
                    <span
                      key={item.topic}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#dcd3c4] text-[10px] font-bold text-[#201e1d]"
                    >
                      <span className="truncate max-w-[130px]">{item.topic}:</span>
                      <span className="text-[#c67139]">{item.count}</span>
                      <span className="text-[#82796a] font-normal">({item.percentage}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Footer */}
            <div className="shrink-0 pt-2.5 border-t-[1.5px] border-[#dcd3c4] flex flex-col gap-2">
              {publishedBanner && (
                <div className="p-2.5 rounded-xl bg-[#e3f4d7] border-2 border-[#728157] text-[#2b3a1a] text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Check className="w-4 h-4 text-[#556b2f] shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Assigned to <span className="underline">{publishedBanner.cohortName}</span>! Code: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#728157] text-[11px]">{publishedBanner.testCode}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPublishedBanner(null)}
                    aria-label="Dismiss assignment notification"
                    className="p-1 hover:bg-[#cbe8b7] rounded text-[#2b3a1a] shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {lastSavedDraftBanner && (
                <div className="bg-[#e4ede1] border-2 border-[#8fa073] p-2.5 rounded-2xl flex items-center justify-between gap-2 shadow-xs mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="w-4 h-4 text-[#556b2f] shrink-0" aria-hidden="true" />
                    <div className="text-xs font-bold text-[#2b3a1a] truncate">
                      Draft {lastSavedDraftBanner.updated ? 'updated' : 'saved'}: <span className="font-black">{lastSavedDraftBanner.title}</span> ({lastSavedDraftBanner.questionCount} Qs)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleOpenDrafts}
                      className="text-[11px] font-black underline text-[#3d472b] hover:text-[#201e1d] px-1 py-0.5 cursor-pointer"
                    >
                      View Drafts ({drafts.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLastSavedDraftBanner(null)}
                      aria-label="Dismiss saved draft notification"
                      className="p-1 hover:bg-[#cbe8b7] rounded text-[#2b3a1a] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {saveSuccess && (
                <div className="text-[11px] font-bold text-[#56633f] flex items-center justify-center gap-1 mb-1">
                  <Check className="w-3 h-3" /> Draft saved
                </div>
              )}

              {/* Row 1: Layout & Shuffle */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsLayoutModalOpen(true)}
                  aria-label="Edit Layout & Settings"
                  className="py-2 px-3 rounded-2xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedQuestionIds((prev) => shuffleQuestionIds(prev))}
                  disabled={selectedQuestions.length < 2}
                  aria-label="Shuffle question order"
                  title={selectedQuestions.length < 2 ? 'Add at least 2 questions to shuffle' : 'Shuffle question order'}
                  className="py-2 px-3 rounded-2xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:shadow-[2px_2px_0_0_#201e1d]"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                  <span>Shuffle Order</span>
                </button>
              </div>

              {/* Row 2: Save, Assign, Print */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleOpenSaveDraftModal}
                  title="Save test configuration as draft"
                  aria-label="Save current test configuration as draft"
                  className="py-2.5 px-1 rounded-2xl bg-white border-2 border-[#201e1d] font-bold text-xs text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 transition-all cursor-pointer text-center"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  disabled={selectedQuestions.length === 0}
                  title={selectedQuestions.length === 0 ? 'Select questions to assign online' : 'Assign as online quiz or homework'}
                  aria-label="Assign compiled questions as online quiz"
                  className="py-2.5 px-1 rounded-2xl bg-[#f0fae1] border-2 border-[#201e1d] font-bold text-xs text-[#2b3a1a] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#e1eecc] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 flex items-center justify-center gap-1 text-center"
                >
                  <Send className="w-3.5 h-3.5 text-[#556b2f]" aria-hidden="true" />
                  <span>Assign Online</span>
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  disabled={selectedQuestions.length === 0}
                  title={selectedQuestions.length === 0 ? 'Select questions to generate PDF' : 'Generate printable PDF'}
                  aria-label="Generate printable PDF of compiled test paper"
                  className="py-2.5 px-1 rounded-2xl bg-[#c67139] border-2 border-[#201e1d] text-[#f9f4ed] font-black text-xs shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 flex items-center justify-center gap-1 text-center cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>PDF / Print</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Layout & Exam Settings Modal */}
      {isLayoutModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="layout-settings-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-lg flex flex-col gap-4 max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b-[1.5px] border-[#dcd3c4]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] shrink-0">
                  <Settings2 className="w-5 h-5 text-[#201e1d]" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="layout-settings-modal-title" className="font-heading text-lg sm:text-xl font-black text-[#201e1d] leading-tight">
                    Layout & Exam Settings
                  </h3>
                  <p className="text-[11px] font-medium text-[#645c50]">
                    {subjectCode} • {subjectName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLayoutModalOpen(false)}
                aria-label="Close layout and settings dialog"
                title="Close dialog"
                className="w-8 h-8 rounded-full border-2 border-[#201e1d] bg-white shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto pr-1 flex flex-col gap-3">
              {/* Dynamic Subject Selector */}
              <div>
                <label htmlFor="settings-subject-select" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                  Subject Catalog
                </label>
                <select
                  id="settings-subject-select"
                  aria-label="Select Subject Catalog"
                  value={subjectCode}
                  onChange={(e) => {
                    const newCode = e.target.value;
                    setSubjectCode(newCode);
                    const cat = SUBJECT_CATALOG.find((s) => s.code === newCode);
                    if (cat) {
                      if (testTitle) setTestTitle(`Assessment - ${cat.name}`);
                      if (testCode) setTestCode(`REV-${cat.code}`);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] cursor-pointer hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  {SUBJECT_CATALOG.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="settings-modal-test-title" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                  Assessment Title
                </label>
                <input
                  id="settings-modal-test-title"
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="Enter assessment title..."
                  aria-label="Assessment Title"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                />
              </div>

              <div>
                <label htmlFor="settings-modal-school-name" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                  School Name
                </label>
                <input
                  id="settings-modal-school-name"
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="Enter school name..."
                  aria-label="School Name"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="settings-modal-date" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                    Exam Date
                  </label>
                  <input
                    id="settings-modal-date"
                    type="text"
                    value={dateString}
                    onChange={(e) => setDateString(e.target.value)}
                    placeholder="Exam Date"
                    aria-label="Exam Date"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                  />
                </div>
                <div>
                  <label htmlFor="settings-modal-duration" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                    Duration (mins)
                  </label>
                  <input
                    id="settings-modal-duration"
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                    placeholder="Duration (m)"
                    aria-label="Duration in minutes"
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings-modal-test-code" className="text-[10px] font-black uppercase text-[#645c50] block mb-1">
                  Test Code
                </label>
                <input
                  id="settings-modal-test-code"
                  type="text"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="e.g. REV-0455-T1"
                  aria-label="Test Code"
                  className="w-full px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                />
              </div>

              {/* Layout Toggles */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#dcd3c4]">
                <span className="text-[10px] font-black uppercase text-[#645c50]">Layout Toggles</span>
                {[
                  { label: 'Exam Cover Page', state: includeCoverPage, set: setIncludeCoverPage, id: 'toggle-modal-cover-page' },
                  { label: 'Candidate Details Header', state: includeCandidateHeader, set: setIncludeCandidateHeader, id: 'toggle-modal-header' },
                  { label: 'Candidate MCQ Bubble Sheet', state: includeBubbleSheet, set: setIncludeBubbleSheet, id: 'toggle-modal-bubble' },
                  { label: 'Teacher Mark Scheme', state: includeMarkScheme, set: setIncludeMarkScheme, id: 'toggle-modal-mark-scheme' },
                  { label: 'Mark Scheme Explanations', state: includeExplanations, set: setIncludeExplanations, id: 'toggle-modal-explanations' },
                ].map((toggle, i) => (
                  <label key={i} htmlFor={toggle.id} className="flex items-center justify-between p-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs text-[#201e1d] cursor-pointer hover:bg-[#fbf7f0] transition-colors">
                    <span className="font-bold text-xs">{toggle.label}</span>
                    <button
                      id={toggle.id}
                      type="button"
                      role="switch"
                      aria-checked={toggle.state}
                      aria-label={toggle.label}
                      onClick={() => toggle.set(!toggle.state)}
                      className={`w-8 h-4 shrink-0 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 ${
                        toggle.state ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                          toggle.state ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-[#dcd3c4]">
              <button
                type="button"
                onClick={() => setIsLayoutModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-2xl bg-[#f0fae1] border-2 border-[#201e1d] font-bold text-xs text-[#2b3a1a] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#e1eecc] active:translate-y-0.5 cursor-pointer text-center"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Modal */}
      {isAutoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-generate-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-sm flex flex-col gap-5">
            <h3 id="auto-generate-modal-title" className="font-heading text-xl font-black text-[#201e1d]">Auto-Generate Config</h3>
            <div className="flex flex-col gap-3">
              <label htmlFor="auto-count-select" className="text-[11px] font-black uppercase tracking-wider text-[#201e1d]">
                Number of Questions
              </label>
              <select
                id="auto-count-select"
                aria-label="Number of Questions"
                value={autoCount}
                onChange={(e) => setAutoCount(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-sm font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] cursor-pointer hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              >
                {[5, 10, 15, 20, 30].map((c) => (
                  <option key={c} value={c}>
                    {c} Questions
                  </option>
                ))}
              </select>
              <div className="flex flex-col gap-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <label id="auto-topic-label" htmlFor="auto-topic-select" className="text-xs font-bold text-[#645c50]">
                    Topic Focus
                  </label>
                  <span className="text-[10px] font-bold text-[#c67139]">
                    {autoTopicIds.includes('all') || autoTopicIds.length === 0
                      ? 'All Topics (Mixed)'
                      : `${autoTopicIds.length} Topic${autoTopicIds.length > 1 ? 's' : ''} Selected`}
                  </span>
                </div>
                <div
                  id="auto-topic-select"
                  role="group"
                  aria-labelledby="auto-topic-label"
                  className="flex flex-col gap-1 p-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] max-h-48 overflow-y-auto"
                >
                  <button
                    type="button"
                    onClick={() => setAutoTopicIds(['all'])}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold text-left transition-colors cursor-pointer ${
                      autoTopicIds.includes('all') || autoTopicIds.length === 0
                        ? 'bg-[#c67139] text-white'
                        : 'bg-[#f4ece1] text-[#201e1d] hover:bg-[#eee7db]'
                    }`}
                  >
                    <span>All Topics (Mixed)</span>
                    {(autoTopicIds.includes('all') || autoTopicIds.length === 0) && (
                      <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                    )}
                  </button>
                  {topics.map((t) => {
                    const isSelected = !autoTopicIds.includes('all') && autoTopicIds.includes(t.id);
                    const qCount = questions.filter((q) => q.topic_id === t.id).length;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="checkbox"
                        aria-checked={isSelected}
                        onClick={() => {
                          setAutoTopicIds((prev) => {
                            const withoutAll = prev.filter((id) => id !== 'all');
                            if (withoutAll.includes(t.id)) {
                              const next = withoutAll.filter((id) => id !== t.id);
                              return next.length === 0 ? ['all'] : next;
                            } else {
                              return [...withoutAll, t.id];
                            }
                          });
                        }}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#faeee5] text-[#201e1d] border border-[#c67139]/40'
                            : 'hover:bg-[#f4ece1] text-[#201e1d]'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#c67139] border-[#c67139] text-white'
                              : 'border-[#dcd3c4] bg-white'
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-2.5 h-2.5 stroke-[3]" aria-hidden="true" />
                          )}
                        </div>
                        {t.orderIndex != null && (
                          <span className="px-1 py-0.5 rounded bg-[#eee7db] text-[10px] font-bold text-[#645c50] shrink-0">
                            Ch {t.orderIndex}
                          </span>
                        )}
                        <span className="truncate flex-1 font-semibold">{t.name}</span>
                        <span className="text-[10px] font-medium text-[#82796a] shrink-0">
                          {qCount} Qs
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsAutoModalOpen(false)}
                title="Cancel auto-generation"
                aria-label="Cancel auto-generation"
                className="flex-1 py-2 rounded-full border-2 border-[#201e1d] font-bold text-xs hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoCompile}
                title="Auto-compile questions"
                aria-label="Auto-compile questions with selected options"
                className="flex-[2] py-2 rounded-full bg-[#201e1d] text-white font-black text-xs hover:bg-[#3d3a36] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 transition-all cursor-pointer"
              >
                Auto-Compile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Draft Modal */}
      {isSaveDraftModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-draft-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_#201e1d] w-full max-w-md flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b-[1.5px] border-[#dcd3c4] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]">
                  <Save className="w-5 h-5 text-[#201e1d]" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="save-draft-modal-title" className="font-heading text-lg font-black text-[#201e1d]">
                    Save Assessment Draft
                  </h3>
                  <p className="text-[11px] font-bold text-[#645c50]">
                    {activeDraftId ? 'Update active draft or save as a new copy' : 'Save configuration to your local drafts'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveDraftModalOpen(false)}
                aria-label="Close save draft dialog"
                className="p-1 hover:bg-[#dcd3c4] rounded-full active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Account Isolation Pill Badge */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#dcd3c4] text-xs font-bold text-[#645c50]">
              <div className="flex items-center gap-1.5 min-w-0">
                <Users className="w-3.5 h-3.5 text-[#201e1d] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Account: <span className="font-black text-[#201e1d]">{currentAccountLabel}</span>
                  {userProfile?.email && userProfile.email !== currentAccountLabel ? ` (${userProfile.email})` : ''}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#3d472b] bg-[#e4ede1] px-1.5 py-0.5 rounded-md border border-[#8fa073] shrink-0">
                Private Vault
              </span>
            </div>

            {/* Save Mode Selector (When activeDraftId exists) */}
            {activeDraftId && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-[#645c50]">
                  Save Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSaveModalMode('update')}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      saveModalMode === 'update'
                        ? 'border-[#201e1d] bg-[#ffe1d0] shadow-[2px_2px_0_0_#201e1d]'
                        : 'border-[#dcd3c4] bg-white hover:border-[#201e1d]'
                    }`}
                  >
                    <div className="text-xs font-black text-[#201e1d] flex items-center justify-between">
                      <span>Update Active</span>
                      {saveModalMode === 'update' && <Check className="w-3.5 h-3.5 text-[#c67139]" />}
                    </div>
                    <div className="text-[10px] font-bold text-[#645c50] mt-0.5">
                      Overwrite current draft
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSaveModalMode('new')}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      saveModalMode === 'new'
                        ? 'border-[#201e1d] bg-[#ffe1d0] shadow-[2px_2px_0_0_#201e1d]'
                        : 'border-[#dcd3c4] bg-white hover:border-[#201e1d]'
                    }`}
                  >
                    <div className="text-xs font-black text-[#201e1d] flex items-center justify-between">
                      <span>Save as New</span>
                      {saveModalMode === 'new' && <Check className="w-3.5 h-3.5 text-[#c67139]" />}
                    </div>
                    <div className="text-[10px] font-bold text-[#645c50] mt-0.5">
                      Create separate draft
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Draft Title Input */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="save-draft-title-input" className="text-[11px] font-black uppercase tracking-wider text-[#645c50]">
                  Draft Title <span className="text-[#c67139]">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAutoNameDraft}
                  className="text-[10px] font-bold text-[#c67139] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  <span>Auto-Name</span>
                </button>
              </div>
              <input
                id="save-draft-title-input"
                type="text"
                value={saveModalTitle}
                onChange={(e) => setSaveModalTitle(e.target.value)}
                placeholder="e.g. 0455 Economics — Price Elasticity Quiz"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] placeholder-[#8c8273] focus:outline-none focus:ring-2 focus:ring-[#201e1d]"
              />
            </div>

            {/* Teacher Notes / Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="save-draft-notes-input" className="text-[11px] font-black uppercase tracking-wider text-[#645c50]">
                Teacher Notes & Instructions (Optional)
              </label>
              <textarea
                id="save-draft-notes-input"
                rows={2}
                value={saveModalNotes}
                onChange={(e) => setSaveModalNotes(e.target.value)}
                placeholder="Add notes, target class, or instructions reminder..."
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] placeholder-[#8c8273] focus:outline-none focus:ring-2 focus:ring-[#201e1d] resize-none"
              />
            </div>

            {/* Draft Snapshot Summary Box */}
            <div className="p-3 rounded-2xl bg-white border-2 border-[#dcd3c4] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#645c50]">Paper Summary:</span>
                <span className="font-black px-2 py-0.5 rounded-lg bg-[#f0fae1] text-[#3d472b] border border-[#8fa073]">
                  {subjectCode} {subjectName}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#201e1d]">
                <span>{selectedQuestionIds.length} Questions</span>
                <span>•</span>
                <span>{selectedQuestionIds.length} Marks</span>
                <span>•</span>
                <span>~{estimatedTime} mins</span>
              </div>

              {topicDistribution.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {topicDistribution.slice(0, 3).map((item) => (
                    <span
                      key={item.topic}
                      className="px-2 py-0.5 rounded-md bg-[#f9f4ed] border border-[#dcd3c4] text-[10px] font-bold text-[#645c50]"
                    >
                      {item.topic} ({item.count})
                    </span>
                  ))}
                  {topicDistribution.length > 3 && (
                    <span className="text-[10px] font-bold text-[#8c8273] self-center">
                      +{topicDistribution.length - 3} more
                    </span>
                  )}
                </div>
              )}

              {selectedQuestionIds.length === 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#c67139] bg-[#ffe1d0] p-2 rounded-xl border border-[#c67139]/30 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>0 questions selected — this will save your layout and header settings as a template draft.</span>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t-[1.5px] border-[#dcd3c4]">
              <button
                type="button"
                onClick={() => setIsSaveDraftModalOpen(false)}
                className="px-4 py-2 rounded-xl border-2 border-[#dcd3c4] text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveDraft}
                className="px-5 py-2 rounded-xl bg-[#c67139] border-2 border-[#201e1d] text-[#f9f4ed] text-xs font-black shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Save Draft</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Manager Modal */}
      {isDraftsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-drafts-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_#201e1d] w-full max-w-2xl flex flex-col gap-4 max-h-[88vh] overflow-hidden">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between border-b-[1.5px] border-[#dcd3c4] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]">
                  <FolderOpen className="w-5 h-5 text-[#201e1d]" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 id="saved-drafts-modal-title" className="font-heading text-xl font-black text-[#201e1d]">
                      Saved Test Drafts
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] text-xs font-black">
                      {drafts.length}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-[#645c50]">
                    Manage, load, duplicate, and export your compiled test papers
                  </p>
                </div>
              </div>

              {/* Action Toolbar in Header */}
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportDraftFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Import draft from a JSON file"
                  aria-label="Import draft JSON"
                  className="px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-black text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 shadow-[2px_2px_0_0_#201e1d] flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Import JSON</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartNewDraft}
                  title="Clear compiler and start a fresh paper"
                  aria-label="Start new blank paper"
                  className="px-2.5 py-1.5 rounded-xl bg-[#c67139] border-2 border-[#201e1d] text-xs font-black text-[#f9f4ed] hover:bg-[#b2622d] active:translate-y-0.5 shadow-[2px_2px_0_0_#201e1d] flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>+ New Paper</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDraftsModalOpen(false)}
                  aria-label="Close saved drafts dialog"
                  title="Close dialog"
                  className="p-1.5 hover:bg-[#dcd3c4] rounded-full active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] cursor-pointer"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Account Isolation Pill Badge */}
            <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#dcd3c4] text-xs font-bold text-[#645c50]">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 text-[#201e1d] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Account Vault: <span className="font-black text-[#201e1d]">{currentAccountLabel}</span>
                  {userProfile?.email && userProfile.email !== currentAccountLabel ? ` (${userProfile.email})` : ''}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#3d472b] bg-[#e4ede1] px-2 py-0.5 rounded-md border border-[#8fa073] shrink-0">
                Private Vault
              </span>
            </div>

            {/* Feedback / Notification Banner */}
            {draftModalFeedback && (
              <div className="shrink-0 p-2.5 rounded-xl bg-[#e4ede1] border-2 border-[#8fa073] text-xs font-bold text-[#2b3a1a] flex items-center gap-2">
                <Check className="w-4 h-4 text-[#556b2f] shrink-0" aria-hidden="true" />
                <span className="flex-1">{draftModalFeedback}</span>
              </div>
            )}

            {/* Search & Subject Filter Bar */}
            {drafts.length > 0 && (
              <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8c8273]" aria-hidden="true" />
                  <input
                    type="text"
                    value={draftSearch}
                    onChange={(e) => setDraftSearch(e.target.value)}
                    placeholder="Search drafts by title, notes, topic, or code..."
                    aria-label="Search saved drafts"
                    className="w-full pl-9 pr-7 py-2 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] placeholder-[#8c8273] focus:outline-none focus:ring-2 focus:ring-[#201e1d]"
                  />
                  {draftSearch.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDraftSearch('')}
                      title="Clear search"
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8c8273] hover:text-[#201e1d] p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Subject Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 py-0.5">
                  <button
                    type="button"
                    onClick={() => setDraftSubjectFilter('all')}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 ${
                      draftSubjectFilter === 'all'
                        ? 'bg-[#201e1d] text-[#f9f4ed] border-[#201e1d]'
                        : 'bg-white text-[#645c50] border-[#dcd3c4] hover:border-[#201e1d]'
                    }`}
                  >
                    All
                  </button>
                  {SUBJECT_CATALOG.map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => setDraftSubjectFilter(cat.code)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 ${
                        draftSubjectFilter === cat.code
                          ? 'bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                          : 'bg-white text-[#645c50] border-[#dcd3c4] hover:border-[#201e1d]'
                      }`}
                    >
                      {cat.code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Draft Cards List */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-1">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-14 h-14 rounded-3xl bg-[#ffe1d0] border-3 border-[#201e1d] flex items-center justify-center text-[#c67139] shadow-[3px_3px_0_0_#201e1d] mb-3">
                    <FolderOpen className="w-7 h-7" aria-hidden="true" />
                  </div>
                  <h4 className="font-heading text-base font-black text-[#201e1d] mb-1">
                    No Saved Drafts Yet
                  </h4>
                  <p className="text-xs font-bold text-[#645c50] max-w-sm mb-4">
                    Compile questions from the question bank and click <span className="font-black text-[#201e1d]">Save Draft</span> in the right drawer, or import a pre-saved <span className="font-black text-[#201e1d]">.json</span> draft!
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-2xl bg-white border-2 border-[#201e1d] text-xs font-black text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 shadow-[2px_2px_0_0_#201e1d] flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Import JSON Draft</span>
                  </button>
                </div>
              ) : filteredDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <p className="text-xs font-bold text-[#645c50] mb-2">
                    No drafts match your current search or filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftSearch('');
                      setDraftSubjectFilter('all');
                    }}
                    className="text-xs font-black text-[#c67139] underline cursor-pointer"
                  >
                    Clear search and subject filters
                  </button>
                </div>
              ) : (
                filteredDrafts.map((d) => {
                  const isActive = d.id === activeDraftId;
                  const isEditing = editingDraftId === d.id;

                  if (isEditing) {
                    return (
                      <div
                        key={d.id}
                        className="p-4 rounded-2xl border-3 border-[#201e1d] bg-white shadow-[4px_4px_0_0_#201e1d] flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-[#201e1d] uppercase tracking-wider flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                            <span>Rename Draft</span>
                          </span>
                          <span className="text-[10px] font-bold text-[#8c8273]">ID: {d.id}</span>
                        </div>
                        <input
                          type="text"
                          value={editingDraftTitle}
                          onChange={(e) => setEditingDraftTitle(e.target.value)}
                          placeholder="Draft title..."
                          className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#201e1d]"
                        />
                        <textarea
                          rows={2}
                          value={editingDraftNotes}
                          onChange={(e) => setEditingDraftNotes(e.target.value)}
                          placeholder="Draft notes (optional)..."
                          className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#201e1d] resize-none"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={handleCancelRenameDraft}
                            className="px-3 py-1 rounded-lg border border-[#dcd3c4] text-xs font-bold text-[#645c50] hover:bg-[#eee7db] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleSaveRenameDraft(d.id, e)}
                            className="px-3 py-1 rounded-lg bg-[#201e1d] text-[#f9f4ed] text-xs font-black active:translate-y-0.5 cursor-pointer shadow-[1px_1px_0_0_#201e1d]"
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={d.id}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-2.5 ${
                        isActive
                          ? 'border-[#c67139] bg-[#fffbf8] shadow-[3px_3px_0_0_#c67139]'
                          : 'border-[#201e1d] bg-white shadow-[2px_2px_0_0_#201e1d] hover:shadow-[3px_3px_0_0_#201e1d]'
                      }`}
                    >
                      {/* Top Row: Title + Subject + Active Indicator */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-heading text-sm font-black text-[#201e1d] leading-snug">
                            {d.title || formatDefaultDraftTitle(d)}
                          </h4>
                          <span className="px-2 py-0.5 rounded-md bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-black text-[#201e1d]">
                            {d.subjectCode} {d.subjectName || ''}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-[#c67139] text-[#f9f4ed] text-[9px] font-black tracking-wider uppercase">
                              Active in Compiler
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-[#645c50]">
                        <span>{d.questionIds?.length || 0} Questions</span>
                        <span>•</span>
                        <span>{d.durationMinutes || 45} mins</span>
                        {d.testCode && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-[#201e1d] font-bold">
                              {d.testCode}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="text-[11px] text-[#8c8273]">
                          Saved {new Date(d.updatedAt || d.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Notes snippet */}
                      {d.notes && d.notes.trim().length > 0 && (
                        <p className="text-xs text-[#645c50] bg-[#f9f4ed] p-2 rounded-xl border border-[#dcd3c4] italic line-clamp-2">
                          "{d.notes}"
                        </p>
                      )}

                      {/* Topic chips */}
                      {d.topicSummary && d.topicSummary.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {d.topicSummary.slice(0, 3).map((topicStr, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-md bg-[#f9f4ed] border border-[#dcd3c4] text-[10px] font-bold text-[#645c50]"
                            >
                              {topicStr}
                            </span>
                          ))}
                          {d.topicSummary.length > 3 && (
                            <span className="text-[10px] font-bold text-[#8c8273] self-center">
                              +{d.topicSummary.length - 3} more
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Toolbar (6 Buttons) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#f0eade]">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadDraft(d)}
                            aria-label={`Load draft ${d.title}`}
                            className="px-3 py-1.5 rounded-xl bg-[#201e1d] text-[#f9f4ed] hover:bg-[#3d3835] active:translate-y-0.5 text-xs font-black shadow-[1px_1px_0_0_#201e1d] flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Load Draft</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => window.open(`/portal/compiler/print?testId=${d.id}`, '_blank')}
                            title="Open printable test paper in new tab"
                            aria-label={`Print draft ${d.title}`}
                            className="px-2.5 py-1.5 rounded-xl bg-white border border-[#201e1d] text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 text-xs font-black shadow-[1px_1px_0_0_#201e1d] flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Print / PDF</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateDraft(d.id, e)}
                            title="Duplicate draft"
                            aria-label={`Duplicate draft ${d.title}`}
                            className="p-1.5 rounded-lg bg-white border border-[#dcd3c4] text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleStartRenameDraft(d, e)}
                            title="Rename or edit notes"
                            aria-label={`Rename draft ${d.title}`}
                            className="p-1.5 rounded-lg bg-white border border-[#dcd3c4] text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleExportDraft(d, e)}
                            title="Export draft as JSON file"
                            aria-label={`Export draft ${d.title} as JSON`}
                            className="p-1.5 rounded-lg bg-white border border-[#dcd3c4] text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteDraft(d.id, e)}
                            title="Delete draft"
                            aria-label={`Delete draft ${d.title}`}
                            className="p-1.5 rounded-lg bg-white border border-[#dcd3c4] text-[#c67139] hover:bg-[#ffe1d0] hover:border-[#c67139] active:translate-y-0.5 cursor-pointer transition-colors ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Online Modal */}
      {isAssignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_#201e1d] w-full max-w-lg flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#e3f4d7] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] shrink-0">
                  <Send className="w-5 h-5 text-[#201e1d]" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="assign-modal-title" className="font-heading text-lg sm:text-xl font-black text-[#201e1d] leading-tight">
                    Assign Online Quiz
                  </h3>
                  <p className="text-[11px] font-medium text-[#645c50]">
                    Publish for student cohort self-paced online completion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close assign online dialog"
                title="Close dialog"
                className="w-8 h-8 rounded-full border-2 border-[#201e1d] bg-white shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#201e1d] hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] transition-all cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Test Summary Card */}
            <div className="p-3.5 rounded-2xl bg-[#f0fae1] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-heading font-black text-sm text-[#201e1d] line-clamp-1">
                  {testTitle || `${subjectName} Assessment`}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-[#201e1d] text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                  {subjectCode} {subjectName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="px-2.5 py-1 rounded-xl bg-white border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[11px] font-black text-[#201e1d]">
                  {selectedQuestionIds.length} Questions
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-white border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[11px] font-black text-[#201e1d]">
                  {selectedQuestionIds.length} Marks
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-[#e3f4d7] border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[11px] font-black text-[#2b3a1a]">
                  ~{assignDuration > 0 ? `${assignDuration} Mins` : 'Untimed'}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-3.5">
              {/* Target Cohort Custom Neobrutalist Dropdown */}
              <div ref={cohortDropdownRef} className="relative">
                <label
                  id="assign-cohort-label"
                  htmlFor="assign-cohort-select"
                  className="text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1.5 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                  <span>Target Cohort</span>
                </label>
                <button
                  id="assign-cohort-select"
                  type="button"
                  role="combobox"
                  aria-haspopup="listbox"
                  aria-expanded={isCohortDropdownOpen}
                  aria-labelledby="assign-cohort-label"
                  onClick={() => setIsCohortDropdownOpen(!isCohortDropdownOpen)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-bold text-[#201e1d] flex items-center justify-between cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none hover:bg-[#fbf7f0] transition-all"
                >
                  <span className="truncate">{assignCohort}</span>
                  <ChevronDown
                    className={`w-4 h-4 ml-2 transition-transform duration-200 shrink-0 ${
                      isCohortDropdownOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <AnimatePresence>
                  {isCohortDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      role="listbox"
                      aria-labelledby="assign-cohort-label"
                      className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-[#FFFDF7] border-2 border-[#201e1d] shadow-[4px_4px_0_0_#201e1d] rounded-2xl p-1.5 max-h-56 overflow-y-auto"
                    >
                      <div className="flex flex-col gap-0.5">
                        {cohortList.map((cohort) => {
                          const isSelected = cohort === assignCohort;
                          return (
                            <button
                              key={cohort}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setAssignCohort(cohort);
                                setIsCohortDropdownOpen(false);
                                setIsCustomCohortInputOpen(false);
                              }}
                              className={`w-full px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-bold flex items-center justify-between transition-colors cursor-pointer hover:bg-[#ffe1d0] ${
                                isSelected ? 'bg-[#faeee5] text-[#201e1d]' : 'text-[#201e1d]'
                              }`}
                            >
                              <span className="truncate">{cohort}</span>
                              {isSelected && (
                                <Check
                                  className="w-4 h-4 text-[#c67139] stroke-[2.5] shrink-0 ml-2"
                                  aria-hidden="true"
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-1.5 mt-1 border-t-2 border-[#201e1d]/10 px-1">
                        {isCustomCohortInputOpen ? (
                          <div className="flex items-center gap-1.5 py-0.5">
                            <input
                              type="text"
                              placeholder="e.g. 10C Economics"
                              value={customCohortInput}
                              onChange={(e) => setCustomCohortInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const trimmed = customCohortInput.trim();
                                  if (trimmed) {
                                    if (!cohortList.includes(trimmed)) {
                                      setCohortList((prev) => [...prev, trimmed]);
                                    }
                                    setAssignCohort(trimmed);
                                    setCustomCohortInput('');
                                    setIsCustomCohortInputOpen(false);
                                    setIsCohortDropdownOpen(false);
                                  }
                                }
                              }}
                              className="flex-1 px-2.5 py-1.5 text-xs font-bold rounded-xl border-2 border-[#201e1d] bg-white text-[#201e1d] outline-none focus:ring-1 focus:ring-[#201e1d]"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = customCohortInput.trim();
                                if (trimmed) {
                                  if (!cohortList.includes(trimmed)) {
                                    setCohortList((prev) => [...prev, trimmed]);
                                  }
                                  setAssignCohort(trimmed);
                                  setCustomCohortInput('');
                                  setIsCustomCohortInputOpen(false);
                                  setIsCohortDropdownOpen(false);
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-[#201e1d] text-white font-black text-xs hover:bg-[#3d3835] active:translate-y-0.5 transition-all cursor-pointer shadow-[1px_1px_0_0_#201e1d]"
                            >
                              Add
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsCustomCohortInputOpen(true)}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-black text-[#c67139] hover:bg-[#ffe1d0] flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
                            <span>+ Enter Custom Cohort</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Due Date & Time Limit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="assign-due-date"
                    className="text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1.5 flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                    <span>Due Date</span>
                  </label>
                  <input
                    id="assign-due-date"
                    type="date"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {[
                      { label: 'Tomorrow', days: 1 },
                      { label: '3 Days', days: 3 },
                      { label: '1 Week', days: 7 }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSetDueDateDays(preset.days)}
                        className="px-2 py-0.5 rounded-lg bg-white border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[10px] font-bold text-[#201e1d] hover:bg-[#ffe1d0] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="assign-duration"
                    className="text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1.5 flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                    <span>Time Limit (mins)</span>
                  </label>
                  <input
                    id="assign-duration"
                    type="number"
                    min={0}
                    max={300}
                    value={assignDuration === 0 ? '' : assignDuration}
                    placeholder="Untimed"
                    onChange={(e) => setAssignDuration(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {[15, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setAssignDuration(mins)}
                        className={`px-2 py-0.5 rounded-lg border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[10px] font-bold active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer ${
                          assignDuration === mins
                            ? 'bg-[#201e1d] text-white'
                            : 'bg-white text-[#201e1d] hover:bg-[#ffe1d0]'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAssignDuration(0)}
                      className={`px-2 py-0.5 rounded-lg border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[10px] font-bold active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-none transition-all cursor-pointer ${
                        assignDuration === 0
                          ? 'bg-[#201e1d] text-white'
                          : 'bg-white text-[#201e1d] hover:bg-[#ffe1d0]'
                      }`}
                    >
                      Untimed
                    </button>
                  </div>
                </div>
              </div>

              {/* Access Code / Test Code */}
              <div>
                <label
                  htmlFor="assign-test-code"
                  className="text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1.5 flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                  <span>Access Code / Test Code</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="assign-test-code"
                      type="text"
                      value={testCode}
                      onChange={(e) => setTestCode(e.target.value.toUpperCase())}
                      placeholder={`REV-${subjectCode}-XXXX`}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-mono font-black text-xs sm:text-sm tracking-wider uppercase text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTestCode(generateTestCode(subjectCode))}
                    title="Roll a fresh access code"
                    aria-label="Regenerate access code"
                    className="p-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center justify-center shrink-0"
                  >
                    <RefreshCw className="w-4 h-4 text-[#201e1d]" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy access code to clipboard"
                    aria-label="Copy access code"
                    className="px-3 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-bold text-xs text-[#201e1d] hover:bg-[#fbf7f0] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-4 h-4 text-[#556b2f] stroke-[2.5]" aria-hidden="true" />
                        <span className="text-[#556b2f]">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#201e1d]" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] font-medium text-[#645c50] mt-1.5">
                  Students enter this access code on the home screen to begin.
                </p>
              </div>
            </div>

            {/* Recent published assignments list */}
            {onlineAssignments.length > 0 && (
              <div className="mt-1 pt-3 border-t-2 border-[#201e1d]/10">
                <span className="text-[10px] font-black uppercase text-[#645c50] tracking-wider block mb-2">
                  Recent Cohort Assignments ({onlineAssignments.length})
                </span>
                <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                  {onlineAssignments.slice(0, 5).map((a) => (
                    <div
                      key={a.id}
                      className="p-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-between text-xs gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-[#201e1d] truncate">{a.title}</div>
                        <div className="text-[10px] font-medium text-[#645c50] truncate">
                          {a.cohortName} • Due {a.dueDate}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded-lg bg-[#eee7db] border border-[#201e1d] text-[10px] font-mono font-black text-[#201e1d]">
                          {a.testCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(a.testCode);
                            setCopiedRecentId(a.id);
                            setTimeout(() => setCopiedRecentId(null), 2000);
                          }}
                          title="Copy test code"
                          aria-label={`Copy test code ${a.testCode}`}
                          className="p-1.5 rounded-lg bg-white border border-[#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
                        >
                          {copiedRecentId === a.id ? (
                            <Check className="w-3.5 h-3.5 text-[#556b2f]" aria-hidden="true" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-[#201e1d]" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white font-bold text-xs text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublishAssignment}
                className="flex-[2] py-2.5 rounded-xl bg-[#728157] text-white font-black text-xs sm:text-sm hover:bg-[#5f6c48] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 transition-all cursor-pointer border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>Confirm & Publish</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Assembly Bar (lg:hidden) */}
      {selectedQuestions.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 p-3 rounded-2xl bg-[#201e1d] text-white border-2 border-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex flex-col">
            <span className="font-heading font-black text-sm">
              {selectedQuestions.length} Questions · {selectedQuestions.length} Marks
            </span>
            <span className="text-[11px] text-[#eee7db]/80 font-medium">
              ~{estimatedTime} mins estimated
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const drawer = document.getElementById('test-assembly-drawer');
              if (drawer) {
                drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#c67139] text-[#f9f4ed] font-bold text-xs border border-white hover:bg-[#b2622d] active:translate-y-0.5 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Jump to Assembly Drawer
          </button>
        </div>
      )}
    </div>
  );
}
