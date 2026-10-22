import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Options } from 'rehype-sanitize';
import type { PluggableList } from 'unified';

const MATH_CLASSES = ['language-math', 'math-inline', 'math-display'];
const mathClass = ['className', ...MATH_CLASSES] as [string, ...string[]];
const attrs = defaultSchema.attributes ?? {};

/**
 * Allow-list for question/explanation Markdown. Strips iframe, form, input,
 * script, style, object and inline style attributes; keeps remark-math output.
 */
export const markdownSanitizeSchema: Options = {
  ...defaultSchema,
  tagNames: Array.from(
    new Set([...(defaultSchema.tagNames ?? []), 'sub', 'sup', 'u', 'br', 'mark'])
  ),
  attributes: {
    ...attrs,
    code: [...(attrs.code ?? []).filter((a) => (Array.isArray(a) ? a[0] !== 'className' : a !== 'className')), mathClass],
    pre: [...(attrs.pre ?? []), mathClass],
    span: [...(attrs.span ?? []), mathClass],
    div: [...(attrs.div ?? []), mathClass],
  },
};

// Sanitize BEFORE katex so KaTeX's own generated markup is not stripped.
export const safeRehypePlugins: PluggableList = [
  rehypeRaw,
  [rehypeSanitize, markdownSanitizeSchema],
  rehypeKatex,
];
