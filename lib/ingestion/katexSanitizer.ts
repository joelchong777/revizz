import katex from 'katex';

/**
 * Cambridge MCQ Ingestion - KaTeX Typography and Math Sanitizer
 *
 * Normalizes and cleans LaTeX / KaTeX typography:
 * 1. Escapes unescaped currency dollar signs ($50 -> \$50) without breaking legitimate math blocks.
 * 2. Fixes double-escaped LaTeX command backslashes (\\frac -> \frac inside math blocks).
 * 3. Standardizes math delimiters: converts \[...\] to $$...$$ (display) and \(...\) to $...$ (inline).
 * 4. Normalizes Cambridge scientific unit notation (\text{m/s}^2, \text{m s}^{-1}, \text{kg/m}^3, \times 10^5).
 * 5. Normalizes fractions (\frac{a}{b}, shorthand fractions \frac 1 2, \frac 12).
 * 6. Normalizes exponents (10^-5 -> 10^{-5}) and multi-character subscripts (v_max -> v_{max}).
 * 7. Normalizes unicode Greek letters and scientific symbols (α -> \alpha, Ω -> \Omega, °C -> ^\circ\text{C}).
 * 8. Validates formula syntax safety via validateKaTeXSyntax without throwing runtime errors.
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

  // 3. Trim whitespace directly inside inline dollar signs ($ x $ -> $x$)
  result = result.replace(/(?<!\$)\$\s+([^$\n]+?)\s+\$(?!\$)/g, '$$$1$$');

  return result;
}

/**
 * Escapes unescaped currency dollar signs (e.g. $50 -> \$50) without corrupting valid math blocks.
 *
 * Handles:
 * - Lone currency signs ($50, $1,500.00, $0.99, $ 50)
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
 * Normalizes LaTeX fraction notation:
 * - \frac 1 2 -> \frac{1}{2}
 * - \frac 12 -> \frac{1}{2} (single digit numerator & denominator)
 * - \frac 1{2} -> \frac{1}{2}
 * - \frac{1} 2 -> \frac{1}{2}
 * - \frac a b -> \frac{a}{b}
 * - \frac {a} {b} -> \frac{a}{b}
 */
export function normalizeFractions(mathContent: string): string {
  if (!mathContent) return '';

  let normalized = mathContent;

  // 1. \frac {a} {b} -> \frac{a}{b} (normalize whitespace between braces)
  normalized = normalized.replace(/\\(?:d|t)?frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '\\frac{$1}{$2}');

  // 2. \frac{a} b -> \frac{a}{b}
  normalized = normalized.replace(
    /\\(?:d|t)?frac\s*\{([^{}]+)\}\s*([a-zA-Z0-9])/g,
    '\\frac{$1}{$2}'
  );

  // 3. \frac a{b} -> \frac{a}{b}
  normalized = normalized.replace(
    /\\(?:d|t)?frac\s*([a-zA-Z0-9])\s*\{([^{}]+)\}/g,
    '\\frac{$1}{$2}'
  );

  // 4. \frac 1 2 or \frac a b -> \frac{a}{b}
  normalized = normalized.replace(
    /\\(?:d|t)?frac\s+([a-zA-Z0-9])\s+([a-zA-Z0-9])/g,
    '\\frac{$1}{$2}'
  );

  // 5. \frac 12 -> \frac{1}{2} (shorthand two single digits or chars)
  normalized = normalized.replace(
    /\\(?:d|t)?frac\s+([a-zA-Z0-9])([a-zA-Z0-9])(?![a-zA-Z0-9{])/g,
    '\\frac{$1}{$2}'
  );

  return normalized;
}

/**
 * Normalizes exponents, scientific notation, and subscripts:
 * - 10^-5 -> 10^{-5} (braces required in LaTeX for negative exponents)
 * - 10^12 -> 10^{12} (braces required for multi-digit exponents)
 * - 3.0 x 10^8 or 3.0 * 10^8 -> 3.0 \times 10^8
 * - v_max or v_initial -> v_{max} or v_{initial} (braces required for multi-char subscripts)
 */
export function normalizeExponentsAndSubscripts(mathContent: string): string {
  if (!mathContent) return '';

  let normalized = mathContent;

  // 1. Normalize scientific multiplication notation: e.g. "x 10^" or "* 10^" -> "\times 10^"
  normalized = normalized.replace(
    /(?<=\d|\))\s*(?:[xX]|\*)\s*10\^/g,
    ' \\times 10^'
  );

  // 2. Negative exponents without braces: e.g. 10^-5 -> 10^{-5}, x^-2 -> x^{-2}, s^-1 -> s^{-1}
  normalized = normalized.replace(
    /(?<=[0-9a-zA-Z\)\]\}])\^(-?\d{2,}|-\d+)(?![0-9a-zA-Z{])/g,
    '^{$1}'
  );

  // 3. Multi-digit positive exponents without braces: e.g. 10^12 -> 10^{12}
  normalized = normalized.replace(
    /(?<=[0-9a-zA-Z\)\]\}])\^(\d{2,})(?![0-9a-zA-Z{])/g,
    '^{$1}'
  );

  // 4. Multi-character subscripts without braces: e.g. v_max -> v_{max}, x_12 -> x_{12}, F_net -> F_{net}
  normalized = normalized.replace(
    /(?<=[0-9a-zA-Z\)\]\}])_([a-zA-Z]{2,}|\d{2,})(?![0-9a-zA-Z{])/g,
    '_{$1}'
  );

  return normalized;
}

/**
 * Normalizes Unicode Greek letters and scientific symbols into standard LaTeX commands.
 */
export function normalizeGreekSymbols(mathContent: string): string {
  if (!mathContent) return '';

  const greekMap: Record<string, string> = {
    // Lowercase Greek
    'α': '\\alpha',
    'β': '\\beta',
    'γ': '\\gamma',
    'δ': '\\delta',
    'ε': '\\varepsilon',
    'ζ': '\\zeta',
    'η': '\\eta',
    'θ': '\\theta',
    'ι': '\\iota',
    'κ': '\\kappa',
    'λ': '\\lambda',
    'μ': '\\mu',
    'ν': '\\nu',
    'ξ': '\\xi',
    'π': '\\pi',
    'ρ': '\\rho',
    'σ': '\\sigma',
    'τ': '\\tau',
    'υ': '\\upsilon',
    'φ': '\\phi',
    'χ': '\\chi',
    'ψ': '\\psi',
    'ω': '\\omega',

    // Uppercase Greek
    'Γ': '\\Gamma',
    'Δ': '\\Delta',
    'Θ': '\\Theta',
    'Λ': '\\Lambda',
    'Ξ': '\\Xi',
    'Π': '\\Pi',
    'Σ': '\\Sigma',
    'Υ': '\\Upsilon',
    'Φ': '\\Phi',
    'Ψ': '\\Psi',
    'Ω': '\\Omega',

    // Micro symbol variants
    'µ': '\\mu', // Unicode U+00B5 Micro Sign
  };

  let normalized = mathContent;

  for (const [char, latex] of Object.entries(greekMap)) {
    // Replace standalone unicode char if not preceded by backslash
    const regex = new RegExp(`(?<!\\\\)${char}`, 'g');
    normalized = normalized.replace(regex, `${latex} `);
  }

  // Normalize degree Celsius symbol in math: e.g. "°C" or "° C" -> "^\circ\text{C}"
  normalized = normalized.replace(/(?<!\\)°\s*C/g, '^\\circ\\text{C}');
  // Standalone degree symbol "°" -> "^\circ"
  normalized = normalized.replace(/(?<!\\)°/g, '^\\circ');

  // Clean trailing spaces before punctuation or closing brackets
  normalized = normalized.replace(/\\(alpha|beta|gamma|delta|varepsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega)\s+([.,;:!?^_{}\)\]])/g, '\\$1$2');

  return normalized;
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
 * Internal helper to sanitize an individual math formula segment.
 */
function sanitizeMathSegment(mathInner: string): string {
  let sanitized = fixEscapedBackslashes(mathInner);
  sanitized = normalizeFractions(sanitized);
  sanitized = normalizeGreekSymbols(sanitized);
  sanitized = normalizeExponentsAndSubscripts(sanitized);
  sanitized = normalizeUnits(sanitized);

  // Escape unescaped % inside math (prevent KaTeX comment truncation)
  sanitized = sanitized.replace(/(?<!\\)%/g, '\\%');

  return sanitized.trim();
}

/**
 * Sanitizes and normalizes KaTeX / LaTeX syntax in Cambridge MCQ content:
 * 1. Standardizes math delimiters (\[...\] -> $$, \(...\) -> $)
 * 2. Escapes unescaped currency dollar signs ($50 -> \$50) without corrupting math
 * 3. Fixes double-escaped backslashes inside math blocks (\\frac -> \frac)
 * 4. Normalizes fractions (\frac{a}{b}, \frac 1 2)
 * 5. Normalizes exponents, subscripts, and scientific multiplication (\times 10^5)
 * 6. Normalizes Cambridge scientific unit notation (\text{m/s}^2, \text{m s}^{-1})
 * 7. Normalizes Greek symbols into LaTeX commands (α -> \alpha, Ω -> \Omega)
 * 8. Cleans inline math whitespace ($ x $ -> $x$) for remark-math compatibility
 */
export function sanitizeKaTeX(text: string): string {
  if (!text) return '';

  // 1. Standardize delimiters: \[...\] -> $$...$$, \(...\) -> $...$
  let output = normalizeMathDelimiters(text);

  // 2. Escape currency dollar signs without touching math blocks
  output = escapeCurrencyDollars(output);

  // 3. Process Display Math blocks ($$...$$)
  output = output.replace(/\$\$([\s\S]*?)\$\$/g, (_match, mathInner) => {
    const sanitized = sanitizeMathSegment(mathInner);
    return `$$${sanitized}$$`;
  });

  // 4. Process Inline Math blocks ($...$)
  output = output.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_match, mathInner) => {
    const sanitized = sanitizeMathSegment(mathInner);
    return `$${sanitized}$`;
  });

  return output;
}

/**
 * Helper to check curly brace balance in LaTeX formulas.
 */
function checkBraceBalance(str: string): { balanced: boolean; reason?: string } {
  let open = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{' && (i === 0 || str[i - 1] !== '\\')) {
      open++;
    } else if (str[i] === '}' && (i === 0 || str[i - 1] !== '\\')) {
      open--;
      if (open < 0) {
        return { balanced: false, reason: 'Unexpected closing brace "}"' };
      }
    }
  }
  if (open > 0) {
    return { balanced: false, reason: `Missing ${open} closing brace(s) "}"` };
  }
  return { balanced: true };
}

/**
 * Validates KaTeX syntax safely across markdown or standalone formula text.
 * Tests formula syntax without throwing runtime errors in React renderers.
 *
 * @param text - Markdown content with math blocks or standalone LaTeX formula
 * @returns Object with isValid: boolean and array of specific descriptive error messages.
 */
export function validateKaTeXSyntax(text: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!text || typeof text !== 'string') {
    return { isValid: true, errors: [] };
  }

  try {
    // 1. Check for unclosed display math delimiters ($$)
    const displayMatches = text.match(/(?<!\\)\$\$/g) || [];
    if (displayMatches.length % 2 !== 0) {
      errors.push(`Unclosed display math delimiter "$$" (found ${displayMatches.length} unescaped "$$" delimiters).`);
    }

    // 2. Check for mismatched \( and \)
    const openParen = (text.match(/\\\(/g) || []).length;
    const closeParen = (text.match(/\\\)/g) || []).length;
    if (openParen !== closeParen) {
      errors.push(`Mismatched \\( ... \\) delimiters (${openParen} opened, ${closeParen} closed).`);
    }

    // 3. Check for mismatched \[ and \]
    const openBracket = (text.match(/\\\[/g) || []).length;
    const closeBracket = (text.match(/\\\]/g) || []).length;
    if (openBracket !== closeBracket) {
      errors.push(`Mismatched \\[ ... \\] delimiters (${openBracket} opened, ${closeBracket} closed).`);
    }

    // 4. Stash display math and test display blocks
    const displayBlocks: string[] = [];
    const textWithoutDisplay = text.replace(/(?<!\\)\$\$([\s\S]*?)\$\$/g, (_m, math) => {
      displayBlocks.push(math);
      return `@@DISPLAY_BLOCK_${displayBlocks.length - 1}@@`;
    });

    // 5. Test each display math block
    for (let i = 0; i < displayBlocks.length; i++) {
      const math = displayBlocks[i].trim();
      if (!math) continue;

      const braceCheck = checkBraceBalance(math);
      if (!braceCheck.balanced) {
        errors.push(`Unbalanced braces in display math "$$${math}$$": ${braceCheck.reason}`);
      }

      try {
        katex.renderToString(math, { throwOnError: true, displayMode: true });
      } catch (renderErr: any) {
        errors.push(`KaTeX syntax error in display math "$$${math}$$": ${renderErr.message || String(renderErr)}`);
      }
    }

    // 6. Test inline math blocks ($...$)
    let hasMathBlocks = displayBlocks.length > 0;
    const lines = textWithoutDisplay.split('\n');

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const singleDollarMatches = line.match(/(?<!\\)\$/g) || [];
      if (singleDollarMatches.length % 2 !== 0) {
        errors.push(`Unclosed inline math delimiter "$" on line ${l + 1}: "${line.trim().slice(0, 50)}"`);
      }
    }

    const inlineMathRegex = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
    let match: RegExpExecArray | null;

    while ((match = inlineMathRegex.exec(textWithoutDisplay)) !== null) {
      hasMathBlocks = true;
      const math = match[1].trim();
      if (!math) continue;

      const braceCheck = checkBraceBalance(math);
      if (!braceCheck.balanced) {
        errors.push(`Unbalanced braces in inline math "$${math}$": ${braceCheck.reason}`);
      }

      try {
        katex.renderToString(math, { throwOnError: true, displayMode: false });
      } catch (renderErr: any) {
        errors.push(`KaTeX syntax error in inline math "$${math}$": ${renderErr.message || String(renderErr)}`);
      }
    }

    // 7. If no delimiters were detected at all, but the string contains LaTeX commands,
    // test the string directly as a candidate formula
    if (
      !hasMathBlocks &&
      /\\(frac|sqrt|text|mathrm|times|cdot|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|tau|phi|omega|Delta|Omega|sum|int|infty|[a-zA-Z]+)/.test(text)
    ) {
      const braceCheck = checkBraceBalance(text);
      if (!braceCheck.balanced) {
        errors.push(`Unbalanced braces in formula: ${braceCheck.reason}`);
      }

      try {
        katex.renderToString(text.trim(), { throwOnError: true, displayMode: false });
      } catch (renderErr: any) {
        errors.push(`KaTeX syntax error in formula "${text.trim()}": ${renderErr.message || String(renderErr)}`);
      }
    }
  } catch (err: any) {
    errors.push(`Unexpected error validating KaTeX syntax: ${err.message || String(err)}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
