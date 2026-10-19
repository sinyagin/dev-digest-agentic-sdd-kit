const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Escapes text and wraps words starting with any of `terms` in <mark>. */
export function highlight(text: string, terms: string[]): string {
  const clean = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!clean.length) return escapeHtml(text);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${clean.join("|")})[\\p{L}\\p{N}]*`, "giu");
  let out = "";
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += escapeHtml(text.slice(last, m.index)) + `<mark>${escapeHtml(m[0])}</mark>`;
    last = m.index! + m[0].length;
  }
  return out + escapeHtml(text.slice(last));
}
