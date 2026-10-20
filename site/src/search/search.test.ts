import { describe, expect, it } from "vitest";
import { buildIndex } from "../../scripts/build-index.mjs";
import { highlight } from "../lib/html";
import type { SiteIndex } from "../lib/types";
import { createEngine } from "./engine";
import { parseQuery } from "./query";

const repoRoot = new URL("../../..", import.meta.url).pathname;
const fixtureRoot = new URL("../../scripts/__fixtures__/ok", import.meta.url).pathname;
const opts = { commit: "x", generatedAt: "x", repo: "o/r" };
const noFilters = { types: [], plugin: "", tags: [] };

describe("parseQuery", () => {
  it("drops stopwords and turns type words into intents", () => {
    expect(parseQuery("I need a skill to check the plugin works")).toEqual({
      terms: ["check", "plugin", "works"],
      types: ["skill"],
    });
    expect(parseQuery("slash commands").types).toEqual(["command"]);
    expect(parseQuery("an agent for code review")).toEqual({ terms: ["code", "review"], types: ["agent"] });
  });

  it("returns no terms for an empty or stopword-only query", () => {
    expect(parseQuery("  ").terms).toEqual([]);
    expect(parseQuery("I need something").terms).toEqual([]);
  });
});

describe("search on the repository index", () => {
  const index = buildIndex(repoRoot, opts) as SiteIndex;
  const engine = createEngine(index.artifacts);

  it("S2: finds run-plan for a natural-language query", () => {
    expect(engine.search("I need a skill to run an implementation plan", noFilters).hits[0]?.artifact.id).toBe("sdd-engineering:skill:run-plan");
  });

  it("S3: tolerates typos in longer words", () => {
    expect(engine.search("retrospectve", noFilters).hits[0]?.artifact.id).toBe("sdd-engineering:skill:workflow-retro");
    expect(engine.search("reserch", noFilters).hits[0]?.artifact.id).toBe("research-tools:agent:researcher");
  });
});

describe("search on the fixture index", () => {
  const index = buildIndex(fixtureRoot, opts) as SiteIndex;
  const engine = createEngine(index.artifacts);

  it("ranks the specification skill first", () => {
    expect(engine.search("I need a skill for writing a specification", noFilters).hits[0]?.artifact.id).toBe("alpha:skill:write-spec");
  });

  it("applies the type intent and falls back when it matches nothing", () => {
    const typed = engine.search("agent for tests", noFilters);
    expect(typed.hits.map((h) => h.artifact.type)).toEqual(["agent"]);
    const fallback = engine.search("hook for specification", noFilters);
    expect(fallback.typeFallback).toBe(true);
    expect(fallback.hits[0].artifact.id).toBe("alpha:skill:write-spec");
  });

  it("lists everything in default order for an empty query and computes facets", () => {
    const result = engine.search("", { types: [], plugin: "", tags: ["spec"] });
    expect(result.hits.map((h) => h.artifact.id)).toEqual(["alpha:skill:write-spec"]);
    expect(result.facets.types).toEqual({ skill: 1 });
    expect(engine.search("", noFilters).hits.map((h) => h.artifact.type)).toEqual(["skill", "command", "command", "agent", "hook", "mcp"]);
  });

  it("an explicit type filter overrides the query intent", () => {
    const result = engine.search("skill", { types: ["command"], plugin: "", tags: [] });
    expect(result.intentTypes).toEqual([]);
    expect(result.hits.every((h) => h.artifact.type === "command")).toBe(true);
  });
});

describe("highlight", () => {
  it("marks whole words by prefix and escapes HTML", () => {
    expect(highlight("Checks <plugins> & more", ["plugin", "check"])).toBe(
      "<mark>Checks</mark> &lt;<mark>plugins</mark>&gt; &amp; more",
    );
  });
});
