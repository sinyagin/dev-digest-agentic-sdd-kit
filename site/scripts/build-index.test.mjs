import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IndexError, buildIndex, toPublicIndex } from "./build-index.mjs";

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "__fixtures__/ok");
const opts = { commit: "abc", generatedAt: "2026-01-01T00:00:00.000Z", repo: "owner/repo" };

function copyFixture(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sddkit-index-"));
  fs.cpSync(fixture, dir, { recursive: true });
  mutate(dir);
  return dir;
}

describe("buildIndex", () => {
  const index = buildIndex(fixture, opts);
  const byId = Object.fromEntries(index.artifacts.map((a) => [a.id, a]));

  it("indexes all five artifact types", () => {
    expect(Object.keys(byId)).toEqual([
      "alpha:agent:tester",
      "alpha:command:plan",
      "alpha:command:review:pr",
      "alpha:hook:PostToolUse:Edit|Write",
      "alpha:mcp:docs",
      "alpha:skill:write-spec",
    ]);
  });

  it("reads skill frontmatter, files and invocation", () => {
    const skill = byId["alpha:skill:write-spec"];
    expect(skill.description).toBe("Writes a feature specification with EARS requirements.");
    expect(skill.invocation).toBe("/alpha:write-spec");
    expect(skill.frontmatter["allowed-tools"]).toBe("Read, Write");
    expect(skill.tags).toEqual(["sdd", "workflow", "spec"]);
    expect(skill.files).toEqual(["skills/write-spec/SKILL.md", "skills/write-spec/references/template.md"]);
    expect(skill.sourceUrl).toBe("https://github.com/owner/repo/blob/main/plugins/alpha/skills/write-spec/SKILL.md");
    expect(skill.url).toBe("a/alpha/skill/write-spec/");
  });

  it("falls back to the first paragraph for command descriptions and namespaces subdirectories", () => {
    expect(byId["alpha:command:plan"].description).toBe("Turns a spec into an implementation plan.");
    expect(byId["alpha:command:review:pr"].invocation).toBe("/alpha:review:pr");
    expect(byId["alpha:command:review:pr"].slug).toBe("review-pr");
  });

  it("describes hooks and MCP servers from their configs", () => {
    expect(byId["alpha:hook:PostToolUse:Edit|Write"].description).toContain("runs `${CLAUDE_PLUGIN_ROOT}/scripts/fmt.sh`");
    expect(byId["alpha:mcp:docs"].description).toBe("stdio MCP server: npx docs-mcp");
  });

  it("lists remote plugins without artifacts and counts local ones", () => {
    expect(index.plugins.map((p) => p.name)).toEqual(["alpha", "remote"]);
    expect(index.plugins[0].counts).toEqual({ skill: 1, agent: 1, command: 2, hook: 1, mcp: 1 });
    expect(index.plugins[1]).toMatchObject({ description: "Remote plugin", path: "" });
  });

  it("is deterministic (IX3)", () => {
    expect(JSON.stringify(buildIndex(fixture, opts))).toBe(JSON.stringify(index));
  });

  it("caps the public body as plain text", () => {
    const pub = toPublicIndex(index);
    expect(pub.artifacts.find((a) => a.name === "write-spec").body).toBe("Write spec Use the template in references/template.md.");
  });
});

describe("buildIndex validation", () => {
  it("fails when a skill has no description (IX1)", () => {
    const dir = copyFixture((d) => {
      fs.writeFileSync(path.join(d, "plugins/alpha/skills/write-spec/SKILL.md"), "---\nname: write-spec\n---\nBody\n");
    });
    expect(() => buildIndex(dir, opts)).toThrow(IndexError);
    expect(() => buildIndex(dir, opts)).toThrow(/alpha:skill:write-spec: missing description/);
  });

  it("fails on duplicate artifact ids (IX1)", () => {
    const dir = copyFixture((d) => {
      fs.writeFileSync(path.join(d, "plugins/alpha/agents/tester-copy.md"), "---\nname: tester\ndescription: Copy.\n---\n");
    });
    expect(() => buildIndex(dir, opts)).toThrow(/alpha:agent:tester: duplicate artifact id/);
  });

  it("fails when marketplace and plugin names differ (IX2)", () => {
    const dir = copyFixture((d) => {
      const file = path.join(d, "plugins/alpha/.claude-plugin/plugin.json");
      fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, "utf8")), name: "beta" }));
    });
    expect(() => buildIndex(dir, opts)).toThrow(/does not match plugin.json name "beta"/);
  });
});
