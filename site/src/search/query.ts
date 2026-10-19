// Natural-language query → search terms + type intent (spec section 6).
import type { ArtifactType } from "../lib/types";
import { STOPWORDS } from "./stopwords";

export interface ParsedQuery {
  /** Meaningful query words passed to MiniSearch. */
  terms: string[];
  /** Artifact types named in the query ("skill", "agents", …). */
  types: ArtifactType[];
}

const TYPE_INTENTS: { type: ArtifactType; words: string[] }[] = [
  { type: "skill", words: ["skill", "skills"] },
  { type: "agent", words: ["agent", "agents", "subagent", "subagents"] },
  { type: "command", words: ["command", "commands", "slash"] },
  { type: "hook", words: ["hook", "hooks"] },
  { type: "mcp", words: ["mcp", "server", "servers"] },
];

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ʼ’‘`]/g, "'")
    .replace(/[^\p{L}\p{N}'\s-]/gu, " ");
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s\-_]+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

export function parseQuery(raw: string): ParsedQuery {
  const terms = new Set<string>();
  const types = new Set<ArtifactType>();

  for (const token of tokenize(raw)) {
    const type = TYPE_INTENTS.find((i) => i.words.includes(token))?.type;
    if (type) types.add(type);
    else if (!STOPWORDS.has(token) && token.length > 1) terms.add(token);
  }

  return { terms: [...terms], types: [...types] };
}
