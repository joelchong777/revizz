import { Question } from './questions';

export type SelectionFilter = 'all' | 'selected' | 'unselected';
export type SortOption = 'paper' | 'shortest' | 'longest';

export interface CitationTagPill {
  kind: 'subject' | 'paper' | 'series' | 'question' | 'fallback';
  label: string;
  text?: string;
}

export interface CompilerFilterOptions {
  search?: string;
  topicId?: string;
  series?: string;
  selection?: SelectionFilter;
  selectedQuestionIds?: string[];
  withDiagramsOnly?: boolean;
  withTablesOnly?: boolean;
  withMathOnly?: boolean;
  sortBy?: SortOption;
}

/**
 * Extracts Exam Series or Year from Cambridge citation or Question ID.
 * Examples:
 * - "Cambridge IGCSE Economics 0455/12 May/June 2024 Q1" -> "May/June 2024"
 * - "Cambridge IGCSE Economics 0455/22 Oct/Nov 2023 Q5" -> "Oct/Nov 2023"
 * - "0455-s24-12-q01" -> "May/June 2024"
 */
export function extractSeriesOrYear(citation?: string, id?: string): string {
  if (citation) {
    // 1. Season/Session + Year (e.g. "May/June 2024", "Oct/Nov 2023", "Feb/March 2024", "Specimen 2024")
    const seriesMatch = citation.match(
      /\b(May\/June|Oct\/Nov|Feb\/March|Spring|Summer|Winter|Autumn|Specimen(?:\s+Paper)?)\s+\d{4}\b/i
    );
    if (seriesMatch) {
      return seriesMatch[0].trim();
    }

    // 2. Shorthand session codes (e.g. M/J/24, O/N/23, s24)
    const shortMatch = citation.match(/\b(m\/j|o\/n|f\/m|s|w|m)\/?(\d{2})\b/i);
    if (shortMatch) {
      const code = shortMatch[1].toLowerCase();
      const yr = `20${shortMatch[2]}`;
      const season =
        code.includes('m/j') || code === 's'
          ? 'May/June'
          : code.includes('o/n') || code === 'w'
          ? 'Oct/Nov'
          : code.includes('f/m') || code === 'm'
          ? 'Feb/March'
          : code.toUpperCase();
      return `${season} ${yr}`;
    }

    // 3. Isolated 4-digit year (e.g. "2024")
    const yearMatch = citation.match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) {
      return yearMatch[0];
    }
  }

  if (id) {
    // ID conventions e.g. 0455-s24-12-q01 or 0455_w23_12
    const idMatch = id.match(/[-_]([swm]|sp)(\d{2})[-_]/i);
    if (idMatch) {
      const code = idMatch[1].toLowerCase();
      const yr = `20${idMatch[2]}`;
      const season =
        code === 's'
          ? 'May/June'
          : code === 'w'
          ? 'Oct/Nov'
          : code === 'm'
          ? 'Feb/March'
          : 'Specimen';
      return `${season} ${yr}`;
    }
  }

  return 'Other Series';
}

/**
 * Strips "Cambridge" and "IGCSE" (case-insensitive) along with trademark symbols ™ from text,
 * collapsing multiple spaces into a single space, and trimming the result.
 */
export function stripCambridgeIgcse(text?: string): string {
  if (!text) return '';
  return text
    .replace(/\b(?:cambridge|igcse)\b/gi, '')
    .replace(/™/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYLLABUS_CODE_TO_SUBJECT: Record<string, string> = {
  '0455': 'Economics',
  '0610': 'Biology',
  '0620': 'Chemistry',
  '0625': 'Physics',
  '0580': 'Mathematics',
  '0478': 'Computer Science',
};

/**
 * Parses citation and/or question ID into discrete tag pills (Subject, Paper, Series, Question)
 * with Cambridge and IGCSE branding stripped.
 */
export function parseCitationTagPills(citation?: string, id?: string): CitationTagPill[] {
  const pills: CitationTagPill[] = [];

  // 1. Subject (Title Case)
  let subjectLabel: string | undefined;
  if (citation) {
    const subjectMatch = citation.match(
      /\b(Economics|Biology|Chemistry|Physics|Mathematics|Computer Science)\b/i
    );
    if (subjectMatch) {
      const raw = subjectMatch[1].toLowerCase();
      subjectLabel = raw
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }
  if (!subjectLabel) {
    const codeMatch =
      (citation && citation.match(/\b(0455|0610|0620|0625|0580|0478)\b/)) ||
      (id && id.match(/\b(0455|0610|0620|0625|0580|0478)\b/));
    if (codeMatch && SYLLABUS_CODE_TO_SUBJECT[codeMatch[1]]) {
      subjectLabel = SYLLABUS_CODE_TO_SUBJECT[codeMatch[1]];
    }
  }
  if (subjectLabel) {
    pills.push({ kind: 'subject', label: subjectLabel, text: subjectLabel });
  }

  // 2. Paper (e.g. '0455/12')
  let paperLabel: string | undefined;
  if (citation) {
    const paperMatch = citation.match(/\b(\d{4}\/\d{1,2})\b/);
    if (paperMatch) {
      paperLabel = paperMatch[1];
    }
  }
  if (!paperLabel && id) {
    const idPaperMatch = id.match(/\b(\d{4})[-_](?:[swm]|sp)\d{2}[-_](\d{1,2})\b/i);
    if (idPaperMatch) {
      paperLabel = `${idPaperMatch[1]}/${idPaperMatch[2]}`;
    }
  }
  if (paperLabel) {
    pills.push({ kind: 'paper', label: paperLabel, text: paperLabel });
  }

  // 3. Series (e.g. 'Oct/Nov 2024')
  const series = extractSeriesOrYear(citation, id);
  if (series && series !== 'Other Series') {
    pills.push({ kind: 'series', label: series, text: series });
  }

  // 4. Question (e.g. 'Q1')
  let questionLabel: string | undefined;
  if (citation) {
    const qMatch = citation.match(/\bQ0*(\d+)\b/i);
    if (qMatch) {
      questionLabel = `Q${qMatch[1]}`;
    }
  }
  if (!questionLabel && id) {
    const qIdMatch = id.match(/(?:[-_]q|\bq)0*(\d+)\b/i);
    if (qIdMatch) {
      questionLabel = `Q${qIdMatch[1]}`;
    }
  }
  if (questionLabel) {
    pills.push({ kind: 'question', label: questionLabel, text: questionLabel });
  }

  // 5. Fallback
  if (pills.length === 0) {
    const cleaned = stripCambridgeIgcse(citation || id);
    if (cleaned) {
      pills.push({ kind: 'fallback', label: cleaned, text: cleaned });
    }
  }

  return pills;
}

/**
 * Checks if question stem contains markdown table syntax `|`.
 */
export function hasDataTable(stem?: string): boolean {
  if (!stem) return false;
  return stem.includes('|');
}

/**
 * Checks if question stem contains formulas, KaTeX `$`, or numerical calculation data.
 */
export function isMathOrCalculation(stem?: string): boolean {
  if (!stem) return false;
  // KaTeX or LaTeX syntax
  if (stem.includes('$') || stem.includes('\\(') || stem.includes('\\[') || stem.includes('\\frac')) {
    return true;
  }
  // Formula or currency operators
  if (/[=×÷%¥£€]/.test(stem)) {
    return true;
  }
  // Math operators or signed numbers
  if (/[-–—]\s*\d/.test(stem) || /\d\s*[\+\*\/=]\s*\d/.test(stem)) {
    return true;
  }
  // Numerical data / calculation contexts
  if (
    /\b\d+(?:,\d+)*(?:\.\d+)?\b/.test(stem) &&
    (/\b(?:calculate|elasticity|revenue|cost|balance|profit|gdp|inflation|rate|ratio|index|quantity|price)\b/i.test(stem) ||
      /[\d\s]+(?:trillion|billion|million|thousand|kg|hours|years|units)/i.test(stem))
  ) {
    return true;
  }
  return false;
}

/**
 * Dynamically extracts all unique exam series / years from questions.
 */
export function getAvailableSeries(questions: Question[]): string[] {
  const seriesSet = new Set<string>();
  questions.forEach((q) => {
    const s = extractSeriesOrYear(q.citation, q.id);
    if (s) {
      seriesSet.add(s);
    }
  });
  return Array.from(seriesSet).sort();
}

/**
 * Evaluates all filter and sort criteria simultaneously.
 */
export function filterAndSortQuestions(
  questions: Question[],
  options: CompilerFilterOptions
): Question[] {
  const {
    search = '',
    topicId = 'all',
    series = 'all',
    selection = 'all',
    selectedQuestionIds = [],
    withDiagramsOnly = false,
    withTablesOnly = false,
    withMathOnly = false,
    sortBy = 'paper',
  } = options;

  const searchLower = search.trim().toLowerCase();

  const filtered = questions.filter((q) => {
    // 1. Text search across stems, IDs, citations, and option texts
    const matchSearch =
      !searchLower ||
      q.stem_markdown?.toLowerCase().includes(searchLower) ||
      q.id.toLowerCase().includes(searchLower) ||
      q.citation?.toLowerCase().includes(searchLower) ||
      q.options?.some((opt) => opt.text_markdown?.toLowerCase().includes(searchLower));

    if (!matchSearch) return false;

    // 2. Topic filter
    if (topicId !== 'all' && q.topic_id !== topicId) {
      return false;
    }

    // 3. Exam Series / Year filter
    if (series !== 'all') {
      const qSeries = extractSeriesOrYear(q.citation, q.id);
      if (qSeries !== series) return false;
    }

    // 4. Selection status filter
    const isSelected = selectedQuestionIds.includes(q.id);
    if (selection === 'selected' && !isSelected) return false;
    if (selection === 'unselected' && isSelected) return false;

    // 5. Diagrams toggle
    if (withDiagramsOnly && !q.image_url) {
      return false;
    }

    // 6. Data tables toggle
    if (withTablesOnly && !hasDataTable(q.stem_markdown)) {
      return false;
    }

    // 7. Math / calculations toggle
    if (withMathOnly && !isMathOrCalculation(q.stem_markdown)) {
      return false;
    }

    return true;
  });

  // Sort logic
  if (sortBy === 'shortest') {
    return [...filtered].sort(
      (a, b) => (a.stem_markdown?.length || 0) - (b.stem_markdown?.length || 0)
    );
  }
  if (sortBy === 'longest') {
    return [...filtered].sort(
      (a, b) => (b.stem_markdown?.length || 0) - (a.stem_markdown?.length || 0)
    );
  }

  return filtered;
}

/**
 * Counts how many non-default filters are actively applied.
 */
export function countActiveFilters(
  options: Omit<CompilerFilterOptions, 'selectedQuestionIds'>
): number {
  let count = 0;
  if (options.search && options.search.trim().length > 0) count++;
  if (options.topicId && options.topicId !== 'all') count++;
  if (options.series && options.series !== 'all') count++;
  if (options.selection && options.selection !== 'all') count++;
  if (options.withDiagramsOnly) count++;
  if (options.withTablesOnly) count++;
  if (options.withMathOnly) count++;
  if (options.sortBy && options.sortBy !== 'paper') count++;
  return count;
}
