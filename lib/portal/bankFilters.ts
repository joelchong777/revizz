/**
 * Pure, zero-DOM-dependency Question Bank Filter Engine & URL Synchronization Module.
 * Used by AdminTools.tsx, automated verification test suites, and API endpoints.
 */

import { hasDataTable, isMathOrCalculation } from '../compilerFilters';

export type BankItemStatus = 'Live' | 'Agent draft' | 'Needs review' | 'Flagged';
export type BankDifficulty = 'Easy' | 'Medium' | 'Hard';
export type BankContentFeature = 'diagram' | 'table' | 'math';

export interface EnrichedBankQuestion {
  id: string;
  dbId?: string;
  stem: string;
  cite: string;
  subjectCode: string;      // e.g. '0455'
  subjectName: string;      // e.g. 'Economics'
  paper: string;            // e.g. '0455/12 s 2024'
  session: string;          // e.g. 'May/June 2024'
  year: string;             // e.g. '2024'
  season: string;           // e.g. 'May/June (s)' | 'Feb/March (m)' | 'Oct/Nov (w)'
  seriesCode: string;       // e.g. 's' | 'm' | 'w'
  variant: string;          // e.g. '12'
  topic: string;            // e.g. 'The basic economic problem'
  diff: BankDifficulty;
  acc: string;
  st: BankItemStatus;
  stCls: string;
  upd: string;
  hasDiagram: boolean;
  hasTable: boolean;
  hasMath: boolean;
  optionsText?: string;
}

export interface BankFilterState {
  search: string;
  subject: string;          // 'All' or subjectCode e.g. '0455'
  year: string;             // 'All' or year e.g. '2024'
  season: string;           // 'All' or season label / seriesCode
  variant: string;          // 'All' or paper_code e.g. '12'
  paper: string;            // 'All' or full paper string
  papers?: string[];        // optional multi-select papers
  session: string;          // 'All' or session string
  topic: string;            // 'All' or topic name
  topics?: string[];        // optional multi-select topics
  difficulty: string;       // 'All' | 'Easy' | 'Medium' | 'Hard'
  difficulties?: string[];  // optional multi-select difficulties
  status: string;           // 'All' | BankItemStatus
  features: BankContentFeature[]; // e.g. ['diagram', 'table', 'math']
  page: number;
}

export interface FilterOptionWithCount {
  value: string;
  label: string;
  count: number;
}

export interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
}

export const DEFAULT_BANK_FILTER_STATE: BankFilterState = {
  search: '',
  subject: 'All',
  year: 'All',
  season: 'All',
  variant: 'All',
  paper: 'All',
  papers: [],
  session: 'All',
  topic: 'All',
  topics: [],
  difficulty: 'All',
  difficulties: [],
  status: 'All',
  features: [],
  page: 1,
};

/**
 * Returns consistent visual status badge styling classes across the portal.
 */
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

/**
 * Normalizes exam series shorthand codes or strings into standard Cambridge season labels.
 * Examples:
 * - 'm' | 'f/m' | 'feb/march' | 'march' -> { code: 'm', label: 'Feb/March (m)' }
 * - 's' | 'm/j' | 'may/june' | 'june'  -> { code: 's', label: 'May/June (s)' }
 * - 'w' | 'o/n' | 'oct/nov' | 'november' -> { code: 'w', label: 'Oct/Nov (w)' }
 */
export function normalizeSeriesToSeasonLabel(series?: string | null): { code: string; label: string } {
  if (!series || typeof series !== 'string') {
    return { code: 's', label: 'May/June (s)' };
  }
  const clean = series.trim();
  if (!clean) {
    return { code: 's', label: 'May/June (s)' };
  }
  const lower = clean.toLowerCase();

  // Feb/March (m / f/m / feb)
  if (
    lower === 'm' ||
    lower === 'f/m' ||
    lower.includes('feb') ||
    lower.includes('march') ||
    /\b(f\/m|feb\/march)\b/i.test(lower)
  ) {
    return { code: 'm', label: 'Feb/March (m)' };
  }

  // May/June (s / m/j / may / june / summer)
  if (
    lower === 's' ||
    lower === 'm/j' ||
    lower.includes('may') ||
    lower.includes('june') ||
    lower.includes('summer') ||
    /\b(m\/j|may\/june)\b/i.test(lower)
  ) {
    return { code: 's', label: 'May/June (s)' };
  }

  // Oct/Nov (w / o/n / oct / nov / winter)
  if (
    lower === 'w' ||
    lower === 'o/n' ||
    lower.includes('oct') ||
    lower.includes('nov') ||
    lower.includes('winter') ||
    /\b(o\/n|oct\/nov)\b/i.test(lower)
  ) {
    return { code: 'w', label: 'Oct/Nov (w)' };
  }

  return { code: clean, label: clean };
}

export interface CambridgePaperMetadata {
  subjectCode: string;
  subjectName: string;
  variant: string;
  year: string;
  seriesCode: string;
  season: string;
  paperLabel: string;
  sessionLabel: string;
}

export interface RawPaperMetadataInput {
  id?: string;
  cite?: string;
  citation?: string;
  paper?: string;
  session?: string;
  subjectCode?: string;
  subjectName?: string;
  paperCode?: string;
  series?: string;
  year?: number | string;
}

/**
 * Extracts normalized Cambridge paper metadata (subjectCode, variant, year, season, etc.)
 * from citations, papers, IDs, or database references.
 */
export function parseCambridgePaperMetadata(raw: RawPaperMetadataInput): CambridgePaperMetadata {
  const citeStr = raw.cite || raw.citation || '';
  const paperStr = raw.paper || '';
  const idStr = raw.id || '';
  const sessionStr = raw.session || '';

  // 1. Subject Code
  let subjectCode = raw.subjectCode || '';
  if (!subjectCode) {
    const codeMatch = (citeStr + ' ' + paperStr + ' ' + idStr).match(/\b(\d{4})\/(\d{2})\b/);
    if (codeMatch) {
      subjectCode = codeMatch[1];
    } else {
      const generalMatch = (citeStr + ' ' + paperStr + ' ' + idStr).match(/\b(0\d{3})\b/);
      subjectCode = generalMatch ? generalMatch[1] : '0455';
    }
  }

  // 2. Subject Name
  let subjectName = raw.subjectName || '';
  if (!subjectName) {
    if (subjectCode === '0455') {
      subjectName = 'Economics';
    } else if (subjectCode === '0610') {
      subjectName = 'Biology';
    } else if (subjectCode === '0620') {
      subjectName = 'Chemistry';
    } else if (subjectCode === '0625') {
      subjectName = 'Physics';
    } else if (subjectCode === '0580') {
      subjectName = 'Mathematics';
    } else {
      subjectName = 'Economics';
    }
  }

  // 3. Variant
  let variant = raw.paperCode ? String(raw.paperCode).trim() : '';
  if (!variant) {
    const variantMatch = (paperStr + ' ' + citeStr).match(/\b\d{4}\/(\d{2})\b/);
    if (variantMatch) {
      variant = variantMatch[1];
    } else {
      const idVariantMatch = idStr.match(/[-_][swm]\d{2}[-_](\d{2})[-_]/i);
      if (idVariantMatch) {
        variant = idVariantMatch[1];
      } else {
        const paperNumMatch = (paperStr + ' ' + citeStr).match(/\bPaper\s+(\d{2})\b/i);
        variant = paperNumMatch ? paperNumMatch[1] : '12';
      }
    }
  }

  // 4. Year
  let year = '';
  if (raw.year !== undefined && raw.year !== null) {
    const yStr = String(raw.year).trim();
    year = yStr.length === 2 ? `20${yStr}` : yStr;
  }
  if (!year) {
    const yearMatch = (sessionStr + ' ' + paperStr + ' ' + citeStr).match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      year = yearMatch[1];
    } else {
      const shortYearMatch = (paperStr + ' ' + citeStr).match(/\b(?:m\/j|o\/n|f\/m|[swm])\/?(\d{2})\b/i);
      if (shortYearMatch) {
        year = `20${shortYearMatch[1]}`;
      } else {
        const idYearMatch = idStr.match(/[-_][swm](\d{2})[-_]/i);
        year = idYearMatch ? `20${idYearMatch[1]}` : '2024';
      }
    }
  }

  // 5. Exam Series & Season
  let seriesCandidate = raw.series || '';
  if (!seriesCandidate) {
    const idSeriesMatch = idStr.match(/[-_]([swm]|sp)\d{2}[-_]/i);
    if (idSeriesMatch) {
      seriesCandidate = idSeriesMatch[1].toLowerCase();
    } else {
      const seasonMatch = (sessionStr + ' ' + paperStr + ' ' + citeStr).match(
        /\b(May\/June|Oct\/Nov|Feb\/March|m\/j|o\/n|f\/m)\b/i
      );
      if (seasonMatch) {
        seriesCandidate = seasonMatch[1];
      } else {
        seriesCandidate = 's';
      }
    }
  }

  const normalized = normalizeSeriesToSeasonLabel(seriesCandidate);
  const seriesCode = normalized.code;
  const season = normalized.label;

  // 6. Paper and Session Labels
  const paperLabel = `${subjectCode}/${variant} ${seriesCode} ${year}`;
  let sessionLabel = sessionStr.trim();
  if (!sessionLabel || sessionLabel === 'All') {
    const seasonBase = season.split(' ')[0] || 'May/June';
    sessionLabel = `${seasonBase} ${year}`;
  }

  return {
    subjectCode,
    subjectName,
    variant,
    year,
    seriesCode,
    season,
    paperLabel,
    sessionLabel,
  };
}

/**
 * Derives the active BankItemStatus from database fields or metadata.
 */
export function deriveQuestionStatus(raw: {
  status?: string | null;
  active?: boolean | null;
  diagram_metadata?: any;
  diagram?: any;
}): BankItemStatus {
  const statusStr =
    raw.status ||
    raw.diagram_metadata?.bank_status ||
    raw.diagram?.bank_status;

  if (typeof statusStr === 'string' && statusStr.trim()) {
    const s = statusStr.trim().toLowerCase();
    if (s === 'agent draft' || s === 'draft') {
      return 'Agent draft';
    }
    if (s === 'needs review' || s === 'in_review' || s === 'review' || s === 'needs_review') {
      return 'Needs review';
    }
    if (s === 'flagged' || s === 'withdrawn') {
      return 'Flagged';
    }
    if (s === 'live') {
      return 'Live';
    }
  }

  if (raw.active === false) {
    return 'Needs review';
  }

  return 'Live';
}

/**
 * Derives question difficulty ('Easy' | 'Medium' | 'Hard') based on explicit metadata
 * or deterministic structural complexity heuristics.
 */
export function deriveQuestionDifficulty(raw: {
  difficulty?: string | null;
  diff?: string | null;
  diagram_metadata?: any;
  diagram?: any;
  hasDiagram?: boolean;
  hasTable?: boolean;
  hasMath?: boolean;
  stem?: string;
  stem_markdown?: string;
}): BankDifficulty {
  const diffStr =
    raw.difficulty ||
    raw.diff ||
    raw.diagram_metadata?.difficulty ||
    raw.diagram?.difficulty;

  if (typeof diffStr === 'string' && diffStr.trim()) {
    const lower = diffStr.trim().toLowerCase();
    if (lower === 'easy') return 'Easy';
    if (lower === 'medium') return 'Medium';
    if (lower === 'hard') return 'Hard';
  }

  const stem = raw.stem_markdown || raw.stem || '';
  const hasDiagram = Boolean(raw.hasDiagram);
  const hasTable = Boolean(raw.hasTable);
  const hasMath = Boolean(raw.hasMath);

  // Heuristic rule: Diagram/Table + Math -> Hard
  if ((hasDiagram && hasMath) || (hasTable && hasMath)) {
    return 'Hard';
  }

  // Heuristic rule: Any diagram, table, math calculation, or long stem (> 180 chars) -> Medium
  if (hasDiagram || hasTable || hasMath || stem.length > 180) {
    return 'Medium';
  }

  return 'Easy';
}

/**
 * Detects presence of diagrams, data tables, and mathematical formulas in stem and options.
 */
export function detectQuestionFeatures(raw: {
  stem?: string | null;
  stem_markdown?: string | null;
  image_url?: string | null;
  diagram_metadata?: any;
  diagram?: any;
  tags?: any;
  options?: Array<{ content_markdown?: string; text?: string; text_markdown?: string }> | null;
  [key: string]: any;
}): {
  hasDiagram: boolean;
  hasTable: boolean;
  hasMath: boolean;
} {
  const stem = raw.stem_markdown || raw.stem || '';
  const meta = raw.diagram_metadata || raw.diagram;

  const hasDiagram =
    Boolean(raw.image_url) ||
    Boolean(
      meta &&
        (meta.has_diagram ||
          meta.crop_box ||
          meta.storage_url ||
          meta.image_url)
    ) ||
    /!\[.*?\]\(.+?\)/.test(stem);

  const optionsList = Array.isArray(raw.options) ? raw.options : [];
  const optionsTextList = optionsList.map(
    (o) => o.content_markdown || o.text_markdown || o.text || ''
  );

  const hasTableMeta = Boolean(
    meta &&
      (meta.type === 'table' ||
        meta.has_table === true ||
        (typeof meta.description === 'string' && /\btables?\b/i.test(meta.description)))
  );

  const hasTableTag = Boolean(
    Array.isArray(raw.tags) &&
      raw.tags.some(
        (t: any) =>
          typeof t === 'string' &&
          (t.toLowerCase() === 'table' ||
            t.toLowerCase() === 'tables' ||
            t.toLowerCase() === 'has_table')
      )
  );

  const hasTable =
    hasDataTable(stem, raw) ||
    hasTableMeta ||
    hasTableTag ||
    optionsList.some((o) =>
      hasDataTable(o.content_markdown || o.text_markdown || o.text || '')
    );

  const hasMath =
    isMathOrCalculation(stem) ||
    optionsTextList.some((txt) => isMathOrCalculation(txt));

  return {
    hasDiagram,
    hasTable,
    hasMath,
  };
}

/**
 * Enriches a raw Question or bank item with all derived metadata, features, and status.
 */
export function enrichBankQuestion(
  raw: any,
  index: number = 0
): EnrichedBankQuestion {
  const features = detectQuestionFeatures(raw);
  const meta = parseCambridgePaperMetadata({
    id: raw.id,
    cite: raw.citation || raw.cite,
    paper: raw.paper,
    session: raw.session,
    subjectCode: raw.subjectCode || raw.subject_code,
    subjectName: raw.subjectName || raw.subject_name,
    paperCode: raw.paperCode || raw.paper_code,
    series: raw.series,
    year: raw.year,
  });

  const st = deriveQuestionStatus(raw);
  const stCls = getStatusBadgeClass(st);
  const diff = deriveQuestionDifficulty({
    difficulty: raw.difficulty || raw.diff,
    diagram_metadata: raw.diagram_metadata || raw.diagram,
    hasDiagram: features.hasDiagram,
    hasTable: features.hasTable,
    hasMath: features.hasMath,
    stem: raw.stem_markdown || raw.stem,
  });

  const optionsText = Array.isArray(raw.options)
    ? raw.options
        .map((o: any) => o.content_markdown || o.text_markdown || o.text || '')
        .join(' ')
    : undefined;

  const stem = raw.stem_markdown || raw.stem || '';
  const cite = raw.citation || raw.cite || `Q${index + 1}`;
  const topic = raw.topic || 'General';
  const acc =
    raw.acc ||
    (index % 4 === 0 ? '78%' : index % 4 === 1 ? '64%' : index % 4 === 2 ? '89%' : '52%');
  const upd = raw.upd || (st === 'Live' ? 'Live' : '2d ago');

  return {
    id: raw.id,
    dbId: raw.dbId || raw.id,
    stem,
    cite,
    subjectCode: meta.subjectCode,
    subjectName: meta.subjectName,
    paper: meta.paperLabel,
    session: meta.sessionLabel,
    year: meta.year,
    season: meta.season,
    seriesCode: meta.seriesCode,
    variant: meta.variant,
    topic,
    diff,
    acc,
    st,
    stCls,
    upd,
    hasDiagram: features.hasDiagram,
    hasTable: features.hasTable,
    hasMath: features.hasMath,
    optionsText,
  };
}

/**
 * Batch enriches a list of questions.
 */
export function enrichBankQuestions(questions: any[]): EnrichedBankQuestion[] {
  return questions.map((q, idx) => enrichBankQuestion(q, idx));
}

/**
 * Pure multi-dimensional filter evaluator for Question Bank items.
 */
export function filterBankQuestions(
  questions: EnrichedBankQuestion[],
  filters: BankFilterState
): EnrichedBankQuestion[] {
  return questions.filter((q) => {
    // 1. Status Filter
    if (filters.status && filters.status !== 'All' && q.st !== filters.status) {
      return false;
    }

    // 2. Subject Filter (matches code or name)
    if (filters.subject && filters.subject !== 'All') {
      const matchSubject =
        q.subjectCode === filters.subject ||
        q.subjectName.toLowerCase() === filters.subject.toLowerCase() ||
        q.paper.startsWith(filters.subject) ||
        q.cite.includes(filters.subject);
      if (!matchSubject) return false;
    }

    // 3. Year Filter
    if (filters.year && filters.year !== 'All') {
      if (q.year !== filters.year && !q.paper.includes(filters.year) && !q.cite.includes(filters.year)) {
        return false;
      }
    }

    // 4. Season / Series Filter
    if (filters.season && filters.season !== 'All') {
      const normFilter = normalizeSeriesToSeasonLabel(filters.season);
      const matchSeason =
        q.season === filters.season ||
        q.seriesCode === filters.season ||
        q.seriesCode === normFilter.code ||
        q.season.toLowerCase().includes(filters.season.toLowerCase());
      if (!matchSeason) return false;
    }

    // 5. Variant Filter
    if (filters.variant && filters.variant !== 'All') {
      if (q.variant !== filters.variant) {
        return false;
      }
    }

    // 6. Paper Filter (multi-select preferred, single-select fallback)
    if (filters.papers && filters.papers.length > 0) {
      const hasMatch = filters.papers.some(
        (p) => q.paper === p || q.paper.includes(p) || p.includes(q.paper)
      );
      if (!hasMatch) return false;
    } else if (filters.paper && filters.paper !== 'All') {
      if (q.paper !== filters.paper && !q.paper.includes(filters.paper)) {
        return false;
      }
    }

    // 7. Session Filter
    if (filters.session && filters.session !== 'All') {
      if (q.session !== filters.session && !q.session.includes(filters.session)) {
        return false;
      }
    }

    // 8. Topic Filter (multi-select preferred, single-select fallback)
    if (filters.topics && filters.topics.length > 0) {
      if (!filters.topics.includes(q.topic)) {
        return false;
      }
    } else if (filters.topic && filters.topic !== 'All') {
      if (q.topic !== filters.topic) {
        return false;
      }
    }

    // 9. Difficulty Filter (multi-select preferred, single-select fallback)
    if (filters.difficulties && filters.difficulties.length > 0) {
      if (!filters.difficulties.includes(q.diff)) {
        return false;
      }
    } else if (filters.difficulty && filters.difficulty !== 'All') {
      if (q.diff !== filters.difficulty) {
        return false;
      }
    }

    // 10. Content Features (AND logic: question must have all selected features)
    if (filters.features && filters.features.length > 0) {
      for (const feat of filters.features) {
        if ((feat === 'diagram' || (feat as string) === 'diagrams') && !q.hasDiagram) return false;
        if ((feat === 'table' || (feat as string) === 'tables') && !q.hasTable) return false;
        if (feat === 'math' && !q.hasMath) return false;
      }
    }

    // 11. Full-Text Search
    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      const matchSearch =
        q.stem.toLowerCase().includes(term) ||
        q.id.toLowerCase().includes(term) ||
        q.cite.toLowerCase().includes(term) ||
        q.topic.toLowerCase().includes(term) ||
        q.paper.toLowerCase().includes(term) ||
        (q.optionsText ? q.optionsText.toLowerCase().includes(term) : false);

      if (!matchSearch) return false;
    }

    return true;
  });
}

export interface BankFacetCounts {
  subjects: FilterOptionWithCount[];
  years: FilterOptionWithCount[];
  seasons: FilterOptionWithCount[];
  variants: FilterOptionWithCount[];
  papers: FilterOptionWithCount[];
  sessions: FilterOptionWithCount[];
  topics: FilterOptionWithCount[];
  difficulties: FilterOptionWithCount[];
  statuses: FilterOptionWithCount[];
  features: FilterOptionWithCount[];
}

/**
 * Computes exact facet counts across all question dimensions.
 * Every dimension starts with `{ value: 'All', label: 'All', count: questions.length }`.
 */
export function computeBankFacetCounts(
  questions: EnrichedBankQuestion[],
  knownTopics?: string[],
  knownSubjects?: Array<{ code: string; name: string }>
): BankFacetCounts {
  const total = questions.length;

  // Helper to build sorted counts
  function countValues(
    extractor: (q: EnrichedBankQuestion) => string | undefined,
    sortFn?: (a: FilterOptionWithCount, b: FilterOptionWithCount) => number
  ): FilterOptionWithCount[] {
    const map = new Map<string, number>();
    for (const q of questions) {
      const v = extractor(q);
      if (v && v.trim()) {
        const clean = v.trim();
        map.set(clean, (map.get(clean) || 0) + 1);
      }
    }

    const items: FilterOptionWithCount[] = Array.from(map.entries()).map(([value, count]) => ({
      value,
      label: value,
      count,
    }));

    if (sortFn) {
      items.sort(sortFn);
    } else {
      items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    return [{ value: 'All', label: 'All', count: total }, ...items];
  }

  // 1. Subjects
  const subjectMap = new Map<string, { name: string; count: number }>();
  if (knownSubjects) {
    for (const s of knownSubjects) {
      subjectMap.set(s.code, { name: s.name, count: 0 });
    }
  }
  for (const q of questions) {
    const entry = subjectMap.get(q.subjectCode) || { name: q.subjectName, count: 0 };
    entry.count += 1;
    subjectMap.set(q.subjectCode, entry);
  }
  const subjectItems: FilterOptionWithCount[] = Array.from(subjectMap.entries())
    .filter(([, data]) => data.count > 0)
    .map(([code, data]) => ({
      value: code,
      label: `${code} - ${data.name}`,
      count: data.count,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
  const subjects: FilterOptionWithCount[] = [{ value: 'All', label: 'All', count: total }, ...subjectItems];

  // 2. Years (sorted descending)
  const years = countValues(
    (q) => q.year,
    (a, b) => b.value.localeCompare(a.value)
  );

  // 3. Seasons
  const seasons = countValues((q) => q.season);

  // 4. Variants (sorted ascending)
  const variants = countValues(
    (q) => q.variant,
    (a, b) => a.value.localeCompare(b.value)
  );

  // 5. Papers
  const papers = countValues((q) => q.paper);

  // 6. Sessions
  const sessions = countValues((q) => q.session);

  // 7. Topics
  const topicMap = new Map<string, number>();
  if (knownTopics) {
    for (const t of knownTopics) {
      topicMap.set(t, 0);
    }
  }
  for (const q of questions) {
    topicMap.set(q.topic, (topicMap.get(q.topic) || 0) + 1);
  }
  const topicItems: FilterOptionWithCount[] = Array.from(topicMap.entries())
    .filter(([, count]) => count > 0)
    .map(([topic, count]) => ({
      value: topic,
      label: topic,
      count,
    }));
  // Maintain knownTopics order if provided
  if (knownTopics && knownTopics.length > 0) {
    const topicOrder = new Map(knownTopics.map((t, idx) => [t, idx]));
    topicItems.sort((a, b) => {
      const orderA = topicOrder.has(a.value) ? topicOrder.get(a.value)! : 9999;
      const orderB = topicOrder.has(b.value) ? topicOrder.get(b.value)! : 9999;
      return orderA - orderB || a.label.localeCompare(b.label);
    });
  } else {
    topicItems.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }
  const topics: FilterOptionWithCount[] = [{ value: 'All', label: 'All', count: total }, ...topicItems];

  // 8. Difficulties
  const diffOrder: BankDifficulty[] = ['Easy', 'Medium', 'Hard'];
  const difficulties: FilterOptionWithCount[] = [
    { value: 'All', label: 'All', count: total },
    ...diffOrder
      .map((d) => ({
        value: d,
        label: d,
        count: questions.filter((q) => q.diff === d).length,
      }))
      .filter((o) => o.count > 0),
  ];

  // 9. Statuses
  const statusOrder: BankItemStatus[] = ['Live', 'Agent draft', 'Needs review', 'Flagged'];
  const statuses: FilterOptionWithCount[] = [
    { value: 'All', label: 'All', count: total },
    ...statusOrder
      .map((s) => ({
        value: s,
        label: s,
        count: questions.filter((q) => q.st === s).length,
      }))
      .filter((o) => o.count > 0),
  ];

  // 10. Content Features
  const features: FilterOptionWithCount[] = [
    { value: 'All', label: 'All', count: total },
    {
      value: 'diagram',
      label: 'With Diagram',
      count: questions.filter((q) => q.hasDiagram).length,
    },
    {
      value: 'table',
      label: 'With Data Table',
      count: questions.filter((q) => q.hasTable).length,
    },
    {
      value: 'math',
      label: 'With Math / Calc',
      count: questions.filter((q) => q.hasMath).length,
    },
  ];

  return {
    subjects,
    years,
    seasons,
    variants,
    papers,
    sessions,
    topics,
    difficulties,
    statuses,
    features,
  };
}

/**
 * Returns an array of user-visible active filter chips.
 */
export function getActiveFilterChips(filters: BankFilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.search && filters.search.trim()) {
    chips.push({ key: 'search', label: 'Search', value: filters.search.trim() });
  }
  if (filters.subject && filters.subject !== 'All') {
    chips.push({ key: 'subject', label: 'Subject', value: filters.subject });
  }
  if (filters.year && filters.year !== 'All') {
    chips.push({ key: 'year', label: 'Year', value: filters.year });
  }
  if (filters.season && filters.season !== 'All') {
    chips.push({ key: 'season', label: 'Season', value: filters.season });
  }
  if (filters.variant && filters.variant !== 'All') {
    chips.push({ key: 'variant', label: 'Variant', value: filters.variant });
  }
  if (filters.papers && filters.papers.length > 0) {
    for (const p of filters.papers) {
      chips.push({ key: 'papers', label: 'Paper', value: p });
    }
  } else if (filters.paper && filters.paper !== 'All') {
    chips.push({ key: 'paper', label: 'Paper', value: filters.paper });
  }
  if (filters.session && filters.session !== 'All') {
    chips.push({ key: 'session', label: 'Session', value: filters.session });
  }
  if (filters.topic && filters.topic !== 'All') {
    chips.push({ key: 'topic', label: 'Topic', value: filters.topic });
  }
  if (filters.topics && filters.topics.length > 0) {
    for (const t of filters.topics) {
      chips.push({ key: 'topics', label: 'Topic', value: t });
    }
  }
  if (filters.difficulty && filters.difficulty !== 'All') {
    chips.push({ key: 'difficulty', label: 'Difficulty', value: filters.difficulty });
  }
  if (filters.difficulties && filters.difficulties.length > 0) {
    for (const d of filters.difficulties) {
      chips.push({ key: 'difficulties', label: 'Difficulty', value: d });
    }
  }
  if (filters.status && filters.status !== 'All') {
    chips.push({ key: 'status', label: 'Status', value: filters.status });
  }
  if (filters.features && filters.features.length > 0) {
    for (const f of filters.features) {
      const featLabel =
        f === 'diagram' || (f as string) === 'diagrams'
          ? 'Diagram'
          : f === 'table' || (f as string) === 'tables'
          ? 'Table'
          : 'Math';
      chips.push({ key: 'features', label: featLabel, value: f });
    }
  }

  return chips;
}

/**
 * Returns the count of active filter dimensions.
 */
export function countActiveBankFilters(filters: BankFilterState): number {
  return getActiveFilterChips(filters).length;
}

/**
 * Immutably removes a specific active filter chip and resets page to 1.
 */
export function removeActiveFilterChip(
  filters: BankFilterState,
  chip: ActiveFilterChip
): BankFilterState {
  const next: BankFilterState = { ...filters, page: 1 };

  switch (chip.key) {
    case 'search':
      next.search = '';
      break;
    case 'subject':
      next.subject = 'All';
      break;
    case 'year':
      next.year = 'All';
      break;
    case 'season':
      next.season = 'All';
      break;
    case 'variant':
      next.variant = 'All';
      break;
    case 'paper':
      next.paper = 'All';
      break;
    case 'papers':
      next.papers = (filters.papers || []).filter((p) => p !== chip.value);
      break;
    case 'session':
      next.session = 'All';
      break;
    case 'topic':
      next.topic = 'All';
      break;
    case 'topics':
      next.topics = (filters.topics || []).filter((t) => t !== chip.value);
      break;
    case 'difficulty':
      next.difficulty = 'All';
      break;
    case 'difficulties':
      next.difficulties = (filters.difficulties || []).filter((d) => d !== chip.value);
      break;
    case 'status':
      next.status = 'All';
      break;
    case 'features': {
      const targetVal =
        chip.value === 'tables' ? 'table' : chip.value === 'diagrams' ? 'diagram' : chip.value;
      next.features = (filters.features || []).filter((f) => {
        const norm =
          (f as string) === 'tables' ? 'table' : (f as string) === 'diagrams' ? 'diagram' : f;
        return norm !== targetVal;
      });
      break;
    }
  }

  return next;
}

/**
 * Clean URL query parameter serialization omitting 'All' and empty values.
 */
export function serializeBankFiltersToQuery(filters: BankFilterState): string {
  const params = new URLSearchParams();

  if (filters.search && filters.search.trim()) {
    params.set('q', filters.search.trim());
  }
  if (filters.subject && filters.subject !== 'All') {
    params.set('subject', filters.subject);
  }
  if (filters.year && filters.year !== 'All') {
    params.set('year', filters.year);
  }
  if (filters.season && filters.season !== 'All') {
    params.set('season', filters.season);
  }
  if (filters.variant && filters.variant !== 'All') {
    params.set('variant', filters.variant);
  }
  if (filters.paper && filters.paper !== 'All') {
    params.set('paper', filters.paper);
  }
  if (filters.papers && filters.papers.length > 0) {
    params.set('papers', filters.papers.join(';'));
  }
  if (filters.session && filters.session !== 'All') {
    params.set('session', filters.session);
  }
  if (filters.topic && filters.topic !== 'All') {
    params.set('topic', filters.topic);
  }
  if (filters.topics && filters.topics.length > 0) {
    params.set('topics', filters.topics.join(','));
  }
  if (filters.difficulty && filters.difficulty !== 'All') {
    params.set('diff', filters.difficulty);
  }
  if (filters.difficulties && filters.difficulties.length > 0) {
    params.set('diffs', filters.difficulties.join(','));
  }
  if (filters.status && filters.status !== 'All') {
    params.set('status', filters.status);
  }
  if (filters.features && filters.features.length > 0) {
    params.set('features', filters.features.join(','));
  }
  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  return params.toString();
}

/**
 * Parses URL query parameters string into typed BankFilterState.
 */
export function parseBankFiltersFromQuery(searchString: string): BankFilterState {
  const cleanStr = searchString.startsWith('?') ? searchString.slice(1) : searchString;
  const params = new URLSearchParams(cleanStr);

  const search = params.get('q') || '';
  const subject = params.get('subject') || 'All';
  const year = params.get('year') || 'All';
  const season = params.get('season') || 'All';
  const variant = params.get('variant') || 'All';
  const paper = params.get('paper') || 'All';
  const papersParam = params.get('papers');
  const papers = papersParam
    ? papersParam.split(';').map((p) => p.trim()).filter(Boolean)
    : [];
  const session = params.get('session') || 'All';
  const topic = params.get('topic') || 'All';
  const topicsParam = params.get('topics');
  const topics = topicsParam
    ? topicsParam.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const difficulty = params.get('diff') || 'All';
  const diffsParam = params.get('diffs');
  const difficulties = diffsParam
    ? diffsParam.split(',').map((d) => d.trim()).filter(Boolean)
    : [];

  const status = params.get('status') || 'All';

  const featuresParam = params.get('features') || params.get('feature') || params.get('format');
  const features: BankContentFeature[] = featuresParam
    ? (featuresParam
        .split(',')
        .map((f) => f.trim().toLowerCase())
        .map((f) => (f === 'tables' ? 'table' : f === 'diagrams' ? 'diagram' : f))
        .filter((f): f is BankContentFeature =>
          f === 'diagram' || f === 'table' || f === 'math'
        )
        .filter((v, idx, arr) => arr.indexOf(v) === idx))
    : [];

  const pageParam = params.get('page');
  const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;

  return {
    search,
    subject,
    year,
    season,
    variant,
    paper,
    papers,
    session,
    topic,
    topics,
    difficulty,
    difficulties,
    status,
    features,
    page,
  };
}
