// Client-side search over index.json (spec section 6).
import MiniSearch from "minisearch";
import { ARTIFACT_TYPES, type Artifact, type ArtifactType } from "../lib/types";
import { parseQuery } from "./query";

export interface Filters {
  types: ArtifactType[];
  plugin: string;
  tags: string[];
}

export interface Hit {
  artifact: Artifact;
  score: number;
  /** Matched document terms, used for highlighting. */
  terms: string[];
}

export interface SearchResult {
  hits: Hit[];
  facets: { types: Record<string, number>; plugins: Record<string, number>; tags: Record<string, number> };
  /** Types named in the query (e.g. "skill"), applied when no type filter is selected. */
  intentTypes: ArtifactType[];
  /** True when the query named a type that had no matches, so all types are shown. */
  typeFallback: boolean;
}

const FULL_MATCH_BONUS = 1.2;

export const defaultOrder = (a: Artifact, b: Artifact) =>
  ARTIFACT_TYPES.indexOf(a.type) - ARTIFACT_TYPES.indexOf(b.type) || a.name.localeCompare(b.name);

function count(hits: Hit[], key: (a: Artifact) => string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const { artifact } of hits) for (const k of key(artifact)) out[k] = (out[k] ?? 0) + 1;
  return out;
}

export function createEngine(artifacts: Artifact[]) {
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  const ms = new MiniSearch<Artifact>({
    idField: "id",
    fields: ["name", "description", "tags", "plugin", "body"],
    storeFields: ["id"],
    extractField: (doc, field) => {
      const value = (doc as unknown as Record<string, unknown>)[field];
      return Array.isArray(value) ? value.join(" ") : (value as string);
    },
    searchOptions: {
      boost: { name: 4, tags: 3, description: 2, plugin: 1.5, body: 1 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : 0),
      combineWith: "OR",
    },
  });
  ms.addAll(artifacts);

  function rank(query: string) {
    const parsed = parseQuery(query);
    if (parsed.terms.length === 0) {
      return { parsed, hits: [...artifacts].sort(defaultOrder).map((artifact) => ({ artifact, score: 0, terms: [] })) };
    }
    const hits = ms
      .search({ combineWith: "OR", queries: parsed.terms })
      .map((r) => {
        const matched = parsed.terms.filter((t) => r.queryTerms.includes(t)).length;
        const bonus = matched / parsed.terms.length > 0.5 ? FULL_MATCH_BONUS : 1;
        return { artifact: byId.get(r.id as string)!, score: r.score * bonus, terms: r.terms };
      })
      .sort((a, b) => b.score - a.score || defaultOrder(a.artifact, b.artifact));
    return { parsed, hits };
  }

  function search(query: string, filters: Filters): SearchResult {
    const { parsed, hits: ranked } = rank(query);

    let hits = ranked;
    let typeFallback = false;
    const intentTypes = filters.types.length ? [] : parsed.types;
    if (intentTypes.length) {
      const typed = ranked.filter((h) => intentTypes.includes(h.artifact.type));
      if (typed.length || ranked.length === 0) hits = typed;
      else typeFallback = true;
    }

    const byType = (h: Hit) => !filters.types.length || filters.types.includes(h.artifact.type);
    const byPlugin = (h: Hit) => !filters.plugin || h.artifact.plugin === filters.plugin;
    const byTags = (h: Hit) => filters.tags.every((t) => h.artifact.tags.includes(t));

    return {
      hits: hits.filter((h) => byType(h) && byPlugin(h) && byTags(h)),
      facets: {
        types: count(hits.filter((h) => byPlugin(h) && byTags(h)), (a) => [a.type]),
        plugins: count(hits.filter((h) => byType(h) && byTags(h)), (a) => [a.plugin]),
        tags: count(hits.filter((h) => byType(h) && byPlugin(h)), (a) => a.tags),
      },
      intentTypes,
      typeFallback,
    };
  }

  return { search };
}
