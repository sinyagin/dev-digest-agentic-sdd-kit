// Home page search: lazy index load, filters, URL state (spec sections 6–7).
import { renderCard } from "../components/card";
import { getSelected } from "../install/store";
import { withBase } from "../lib/base";
import { escapeHtml } from "../lib/html";
import { TYPE_LABELS, type ArtifactType, type SiteIndex } from "../lib/types";
import { createEngine, type Filters } from "../search/engine";

const MAX_TAGS = 12;
const base = withBase();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const input = $<HTMLInputElement>("q");
const typeRow = $("type-filters");
const pluginSelect = $<HTMLSelectElement>("plugin-filter");
const tagRow = $("tag-filters");
const results = $("results");
const count = $("result-count");
const notice = $("notice");
const empty = $("empty");
const clearBtn = $("clear-filters");

const state: { q: string } & Filters = { q: "", types: [], plugin: "", tags: [] };
let engine: ReturnType<typeof createEngine> | undefined;
let data: SiteIndex | undefined;
let loading: Promise<void> | undefined;

function readUrl() {
  const p = new URLSearchParams(location.search);
  const list = (k: string) => (p.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  state.q = p.get("q") ?? "";
  state.types = list("type").filter((t): t is ArtifactType => t in TYPE_LABELS);
  state.plugin = p.get("plugin") ?? "";
  state.tags = list("tag");
}

function writeUrl() {
  const p = new URLSearchParams();
  if (state.q.trim()) p.set("q", state.q.trim());
  if (state.types.length) p.set("type", state.types.join(","));
  if (state.plugin) p.set("plugin", state.plugin);
  if (state.tags.length) p.set("tag", state.tags.join(","));
  const qs = p.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function load(): Promise<void> {
  loading ??= fetch(withBase("index.json"))
    .then((r) => {
      if (!r.ok) throw new Error(`index.json: ${r.status}`);
      return r.json();
    })
    .then((json: SiteIndex) => {
      data = json;
      engine = createEngine(json.artifacts);
    })
    .catch((err) => {
      loading = undefined;
      notice.textContent = "Search index failed to load. Reload the page to try again.";
      notice.hidden = false;
      throw err;
    });
  return loading;
}

const hasFilters = () => state.types.length > 0 || !!state.plugin || state.tags.length > 0;

function renderTags(facet: Record<string, number>) {
  const top = Object.entries(facet)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAGS)
    .map(([t]) => t);
  const shown = [...new Set([...state.tags, ...top])];
  tagRow.innerHTML = shown.length
    ? `<span class="filter-label">Tags</span>` +
      shown
        .map((t) => {
          const on = state.tags.includes(t);
          return `<button type="button" class="chip" data-tag-filter="${escapeHtml(t)}" aria-pressed="${on}">#${escapeHtml(t)}<span class="n">${facet[t] ?? 0}</span></button>`;
        })
        .join("")
    : "";
}

function render() {
  if (!engine || !data) return;
  const result = engine.search(state.q, state);
  const versions = new Map(data.plugins.map((p) => [p.name, p.version]));
  const selected = getSelected();

  results.innerHTML = result.hits
    .map((h) => renderCard(h.artifact, { base, version: versions.get(h.artifact.plugin), terms: h.terms, added: selected.includes(h.artifact.plugin) }))
    .join("");

  const total = Object.values(result.facets.types).reduce((a, b) => a + b, 0);
  typeRow.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((btn) => {
    const t = btn.dataset.type as ArtifactType | "";
    const n = t ? result.facets.types[t] ?? 0 : total;
    btn.querySelector(".n")!.textContent = String(n);
    btn.setAttribute("aria-pressed", String(t ? state.types.includes(t) : state.types.length === 0));
    btn.disabled = !!t && n === 0 && !state.types.includes(t);
  });
  pluginSelect.value = state.plugin;
  pluginSelect.querySelectorAll("option").forEach((o) => {
    if (o.value) o.textContent = `${o.textContent!.replace(/ \(\d+\)$/, "")} (${result.facets.plugins[o.value] ?? 0})`;
  });
  renderTags(result.facets.tags);

  const n = result.hits.length;
  count.textContent = `${n} ${n === 1 ? "artifact" : "artifacts"}`;
  clearBtn.hidden = !hasFilters();

  const typeNames = result.intentTypes.map((t) => TYPE_LABELS[t].many.toLowerCase()).join(" or ");
  if (result.typeFallback) {
    notice.textContent = `No ${typeNames} matched — showing all types.`;
    notice.hidden = false;
  } else if (result.intentTypes.length && n) {
    notice.textContent = `Showing ${typeNames} because your search mentions them.`;
    notice.hidden = false;
  } else {
    notice.hidden = true;
  }

  empty.hidden = n > 0;
  results.hidden = n === 0;
  $("empty-clear").hidden = !hasFilters();
  $("empty-text").textContent = state.q.trim()
    ? `No artifacts match “${state.q.trim()}”. Try other words, or browse everything in the marketplace.`
    : "No artifacts match these filters.";
}

async function update() {
  writeUrl();
  await load();
  render();
}

function clearFilters() {
  state.types = [];
  state.plugin = "";
  state.tags = [];
}

let timer: ReturnType<typeof setTimeout> | undefined;
input.addEventListener("input", () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.q = input.value;
    update();
  }, 120);
});
input.addEventListener("focus", () => void load(), { once: true });
input.form!.addEventListener("submit", (e) => {
  e.preventDefault();
  clearTimeout(timer);
  state.q = input.value;
  update();
});

typeRow.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-type]");
  if (!btn) return;
  const t = btn.dataset.type as ArtifactType | "";
  state.types = !t ? [] : state.types.includes(t) ? state.types.filter((x) => x !== t) : [...state.types, t];
  update();
});

pluginSelect.addEventListener("change", () => {
  state.plugin = pluginSelect.value;
  update();
});

tagRow.addEventListener("click", (e) => {
  const tag = (e.target as HTMLElement).closest<HTMLElement>("[data-tag-filter]")?.dataset.tagFilter;
  if (!tag) return;
  state.tags = state.tags.includes(tag) ? state.tags.filter((t) => t !== tag) : [...state.tags, tag];
  update();
});

// Tag links and example queries on cards apply in place instead of reloading.
document.addEventListener("click", (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-tag], a[data-example]");
  if (!link || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  if (link.dataset.tag) {
    if (!state.tags.includes(link.dataset.tag)) state.tags = [...state.tags, link.dataset.tag];
  } else {
    state.q = input.value = link.dataset.example!;
  }
  update();
});

clearBtn.addEventListener("click", () => {
  clearFilters();
  update();
});
$("empty-clear").addEventListener("click", () => {
  clearFilters();
  update();
});
$("empty-all").addEventListener("click", () => {
  clearFilters();
  state.q = input.value = "";
  update();
});

document.addEventListener("keydown", (e) => {
  const el = document.activeElement as HTMLElement | null;
  const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    input.focus();
  } else if (e.key === "Escape" && el === input && input.value) {
    clearTimeout(timer);
    state.q = input.value = "";
    update();
  }
});

readUrl();
if (location.search) {
  input.value = state.q;
  update();
}
