import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify);

/** Renders artifact Markdown at build time; raw HTML is dropped and the output sanitized (NF6). */
export async function renderMarkdown(markdown: string): Promise<string> {
  return String(await processor.process(markdown));
}
