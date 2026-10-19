// Card markup shared by the server render and the client-side search (spec section 7).
import { escapeHtml, highlight } from "../lib/html";
import { TYPE_LABELS, type Artifact } from "../lib/types";

export interface CardOptions {
  base: string;
  version?: string;
  terms?: string[];
  added?: boolean;
}

export function renderCard(a: Artifact, { base, version, terms = [], added = false }: CardOptions): string {
  const e = escapeHtml;
  const tags = a.tags
    .map((t) => `<li><a class="tag" href="${base}?tag=${encodeURIComponent(t)}" data-tag="${e(t)}">#${e(t)}</a></li>`)
    .join("");
  const invocation = a.invocation
    ? `<div class="invoke"><code>${e(a.invocation)}</code><button type="button" class="btn-icon" data-copy="${e(a.invocation)}" aria-label="Copy ${e(a.invocation)}">Copy</button></div>`
    : "";
  return `<article class="card" data-id="${e(a.id)}">
  <div class="card-meta">
    <span class="badge badge-${a.type}">${TYPE_LABELS[a.type].one}</span>
    <a class="card-plugin" href="${base}p/${encodeURIComponent(a.plugin)}/">${e(a.plugin)}${version ? ` <span>v${e(version)}</span>` : ""}</a>
  </div>
  <h3 class="card-title"><a href="${base}${a.url}">${highlight(a.name, terms)}</a></h3>
  <p class="card-desc" title="${e(a.description)}">${highlight(a.description, terms)}</p>
  ${tags ? `<ul class="tags">${tags}</ul>` : ""}
  ${invocation}
  <div class="card-actions">
    <button type="button" class="btn btn-small" data-add-plugin="${e(a.plugin)}" aria-pressed="${added}">${added ? "✓ Added" : "+ Add plugin"}</button>
    <span class="links"><a href="${base}${a.url}">Details</a>${a.sourceUrl ? ` · <a href="${e(a.sourceUrl)}" target="_blank" rel="noopener">Source</a>` : ""}</span>
  </div>
</article>`;
}
