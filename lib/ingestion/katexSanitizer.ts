/**
 * Cambridge MCQ Ingestion - KaTeX Typography and Math Sanitizer
 *
 * Normalizes and cleans LaTeX / KaTeX typography:
 * 1. Escapes unescaped currency dollar signs ($50 -> \$50) without breaking legitimate math blocks.
 * 2. Fixes double-escaped LaTeX command backslashes (\\frac -> \frac inside math blocks).
 * 3. Standardizes math delimiters: converts \[...\] to $$...$$ (display) and \(...\) to $...$ (inline).
 * 4. Normalizes Cambridge scientific unit notation (\text{m/s}^2, \text{m s}^{-1}).
 */

/**
 * Standardizes math delimiters:
 * - \[...\] -> $$...$$ (display math)
 * - \(...\) -> $...$ (inline math)
 * - Trims improper whitespace right inside inline $...$ delimiters ($ x $ -> $x$)
 */
export function normalizeMathDelimiters(text: string): string {
  if (!text) return '';

  // 1. Convert display math \[ ... \] to $$...$$
  let result = text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
    return `$$${math.trim()}$$`;
  });

  // 2. Convert inline math \( ... \) to $...$
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
    return `$${math.trim()}$`;
  });

  return result;
}

/**
 * Escapes unescaped currency dollar signs (e.g. $50 -> \$50) without corrupting valid math blocks.
 *
 * Handles:
 * - Lone currency signs ($50, $1,500.00, $0.99)
 * - Currency ranges and lists ($50 to $60, between $10 and $20)
 * - Prefix currencies (US$50, SGD$100)
 * - Preserves legitimate inline and display math expressions ($x = 5$, $50 \text{ N}$, $$E = mc^2$$)
 */
export function escapeCurrencyDollars(text: string): string {
  if (!text) return '';

  // Step 1: Stash display math blocks ($$...$$) to avoid touching them
  const displayBlocks: string[] = [];
  const stashed = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    displayBlocks.push(match);
    return `@@DISPLAY_MATH_${displayBlocks.length - 1}@@`;
  });

  // Step 2: Process line by line
  const lines = stashed.split('\n');
  const processedLines = lines.map((line) => {
    // If no unescaped dollar signs on this line, return line as is
    if (!/(?<!\\)\$/.test(line)) {
      return line;
    }

    let result = '';
    let i = 0;

    while (i < line.length) {
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        // Find the next unescaped dollar sign on this line
        let closingIdx = -1;
        for (let j = i + 1; j < line.length; j++) {
          if (line[j] === '$' && line[j - 1] !== '\\') {
            closingIdx = j;
            break;
          }
        }

        // Case A: No closing dollar sign on this line -> Dangling / Currency
        if (closingIdx === -1) {
          result += '\\$';
          i++;
          continue;
        }

        const candidateContent = line.slice(i + 1, closingIdx);
        const charAfterClosing = line[closingIdx + 1];

        // Case B: If closing $ is immediately followed by a digit (e.g. "$50 to $60")
        // the closing $ is actually the opening of another currency value!
        const isFollowedByDigit = charAfterClosing !== undefined && /\d/.test(charAfterClosing);

        // Check if content looks like English text / currency rather than math
        const startsWithDigit = /^\s*\d/.test(candidateContent);
        const hasEnglishProse =
          /\b(to|and|or|each|per|in|is|was|are|were|for|from|between|with|than|at|of)\b/i.test(
            candidateContent
          );
        const hasMathSyntax =
          /[\\^_{}=+\-<>*\/]|\\times|\\text|\\mathrm|\\pm|\\le|\\ge|\\ne|\\approx|\\alpha|\\beta|\\cdot|%/.test(
            candidateContent
          );

        if (isFollowedByDigit || hasEnglishProse || (startsWithDigit && !hasMathSyntax)) {
          // This $ is currency, not math. Escape it and continue.
          result += '\\$';
          i++;
          continue;
        }

        // Legitimate inline math block found
        result += '$' + candidateContent + '$';
        i = closingIdx + 1;
      } else {
        result += line[i];
        i++;
      }
    }

    return result;
  });

  let restored = processedLines.join('\n');

  // Step 3: Restore display math blocks
  restored = restored.replace(/@@DISPLAY_MATH_(\d+)@@/g, (_m, idx) => {
    return displayBlocks[parseInt(idx, 10)];
  });

  return restored;
}

/**
 * Fixes double-escaped backslashes inside LaTeX math expressions (\\frac -> \frac, \\text -> \text).
 * Preserves intentional double backslashes (\\) used for line breaks in matrices and multiline equations.
 */
export function fixEscapedBackslashes(mathContent: string): string {
  if (!mathContent) return '';
  // Match 2 or more backslashes followed immediately by a command name (letters)
  // e.g. \\frac -> \frac, \\text -> \text, \\\\sqrt -> \sqrt
  return mathContent.replace(/\\\\+([a-zA-Z]+)/g, '\\$1');
}

/**
 * Normalizes scientific unit notation inside LaTeX expressions:
 * - \text{m/s^2} -> \text{m/s}^2
 * - \text{m/s}^{2} -> \text{m/s}^2
 * - \text{m s^-1} or \text{m s^{-1}} -> \text{m s}^{-1}
 * - \text{m s^-2} -> \text{m s}^{-2}
 * - \text{kg/m^3} -> \text{kg/m}^3
 * - \text{kg m^-3} -> \text{kg m}^{-3}
 * - \text{mol dm^-3} -> \text{mol dm}^{-3}
 * - Unwrapped units in math: m/s^2 -> \text{m/s}^2, m s^{-1} -> \text{m s}^{-1}
 */
export function normalizeUnits(mathContent: string): string {
  if (!mathContent) return '';

  let normalized = mathContent;

  // 1. Pull exponents out of \text{...} or \mathrm{...}
  // e.g. \text{m/s^2} -> \text{m/s}^2, \text{m s^-1} -> \text{m s}^{-1}, \text{kg/m^3} -> \text{kg/m}^3
  normalized = normalized.replace(
    /\\(?:text|mathrm)\{([a-zA-Z\s\/]+)\^\{?(-?\d+)\}?\}/g,
    (_match, base, exp) => {
      const trimmedBase = base.trim();
      const formattedExp = exp.startsWith('-') ? `{${exp}}` : exp;
      return `\\text{${trimmedBase}}^${formattedExp}`;
    }
  );

  // 2. Normalize \text{...}^{single_positive_digit} -> \text{...}^2 (strip redundant braces on positive exponents)
  normalized = normalized.replace(
    /\\(?:text|mathrm)\{([a-zA-Z\s\/]+)\}\^\{(\d)\}/g,
    '\\text{$1}^$2'
  );

  // 3. Ensure negative exponents have braces: \text{...}^-1 -> \text{...}^{-1}
  normalized = normalized.replace(
    /\\(?:text|mathrm)\{([a-zA-Z\s\/]+)\}\^(-?\d+)(?!})/g,
    (_match, base, exp) => {
      const formattedExp = exp.startsWith('-') ? `{${exp}}` : exp;
      return `\\text{${base.trim()}}^${formattedExp}`;
    }
  );

  // 4. Convert \mathrm{...} for units into \text{...}
  normalized = normalized.replace(
    /\\mathrm\{(m\/s|m\s+s|kg\/m|kg\s+m|g\/cm|cm|mol\s+dm|mol\/dm|km\/h|m|s|kg|N|J|W|V|A|K|Pa|Hz|C)\}/g,
    '\\text{$1}'
  );

  // 5. Wrap raw / unwrapped scientific compound units inside math into \text{...}
  // Only when not already preceded by \text{ or \mathrm{
  const unitReplacements: [RegExp, string][] = [
    // m/s^2 -> \text{m/s}^2
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)m\/s\^2(?=\s|\$|\)|$)/g, ' \\text{m/s}^2'],
    // m/s -> \text{m/s}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)m\/s(?=\s|\$|\)|$)/g, ' \\text{m/s}'],
    // m s^{-1} or m s^-1 -> \text{m s}^{-1}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)m\s*s\^\{?-1\}?(?=\s|\$|\)|$)/g, ' \\text{m s}^{-1}'],
    // m s^{-2} or m s^-2 -> \text{m s}^{-2}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)m\s*s\^\{?-2\}?(?=\s|\$|\)|$)/g, ' \\text{m s}^{-2}'],
    // kg/m^3 -> \text{kg/m}^3
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)kg\/m\^3(?=\s|\$|\)|$)/g, ' \\text{kg/m}^3'],
    // kg m^{-3} or kg m^-3 -> \text{kg m}^{-3}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)kg\s*m\^\{?-3\}?(?=\s|\$|\)|$)/g, ' \\text{kg m}^{-3}'],
    // g/cm^3 -> \text{g/cm}^3
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)g\/cm\^3(?=\s|\$|\)|$)/g, ' \\text{g/cm}^3'],
    // km/h -> \text{km/h}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)km\/h(?=\s|\$|\)|$)/g, ' \\text{km/h}'],
    // mol dm^{-3} or mol dm^-3 -> \text{mol dm}^{-3}
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)mol\s*dm\^\{?-3\}?(?=\s|\$|\)|$)/g, ' \\text{mol dm}^{-3}'],
    // mol/dm^3 -> \text{mol/dm}^3
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)mol\/dm\^3(?=\s|\$|\)|$)/g, ' \\text{mol/dm}^3'],
    // cm^3 -> \text{cm}^3
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)cm\^3(?=\s|\$|\)|$)/g, ' \\text{cm}^3'],
    // cm^2 -> \text{cm}^2
    [/(?<!\\(?:text|mathrm)\{)(?:(?<=\d|\s|^|\\times|\\cdot)\s*)cm\^2(?=\s|\$|\)|$)/g, ' \\text{cm}^2'],
  ];

  for (const [regex, replacement] of unitReplacements) {
    normalized = normalized.replace(regex, replacement);
  }

  // Clean any accidental duplicate leading spaces created in substitution
  normalized = normalized.replace(/\s{2,}\\text\{/g, ' \\text{');

  return normalized;
}

/**
 * Sanitizes and normalizes KaTeX / LaTeX syntax in Cambridge MCQ content:
 * 1. Standardizes math delimiters (\[...\] -> $$, \(...\) -> $)
 * 2. Escapes unescaped currency dollar signs ($50 -> \$50) without corrupting math
 * 3. Fixes double-escaped backslashes inside math blocks (\\frac -> \frac)
 * 4. Normalizes Cambridge scientific unit notation (\text{m/s}^2, \text{m s}^{-1})
 * 5. Cleans inline math whitespace ($ x $ -> $x$) for remark-math compatibility
 */
export function sanitizeKaTeX(text: string): string {
  if (!text) return '';

  // 1. Standardize delimiters: \[...\] -> $$...$$, \(...\) -> $...$
  let output = normalizeMathDelimiters(text);

  // 2. Escape currency dollar signs without touching math blocks
  output = escapeCurrencyDollars(output);

  // 3. Process Display Math blocks ($$...$$)
  output = output.replace(/\$\$([\s\S]*?)\$\$/g, (_match, mathInner) => {
    let sanitized = fixEscapedBackslashes(mathInner);
    sanitized = normalizeUnits(sanitized);
    // Escape unescaped % inside math (prevent KaTeX comment truncation)
    sanitized = sanitized.replace(/(?<!\\)%/g, '\\%');
    return `$$${sanitized.trim()}$$`;
  });

  // 4. Process Inline Math blocks ($...$)
  output = output.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_match, mathInner) => {
    let sanitized = fixEscapedBackslashes(mathInner);
    sanitized = normalizeUnits(sanitized);
    // Escape unescaped % inside math
    sanitized = sanitized.replace(/(?<!\\)%/g, '\\%');
    return `$${sanitized.trim()}$`;
  });

  return output;
}
