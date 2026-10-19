export type ArtifactType = "skill" | "agent" | "command" | "hook" | "mcp";

export const ARTIFACT_TYPES: ArtifactType[] = ["skill", "command", "agent", "hook", "mcp"];

export const TYPE_LABELS: Record<ArtifactType, { one: string; many: string }> = {
  skill: { one: "Skill", many: "Skills" },
  command: { one: "Command", many: "Commands" },
  agent: { one: "Agent", many: "Agents" },
  hook: { one: "Hook", many: "Hooks" },
  mcp: { one: "MCP", many: "MCP" },
};

export interface Plugin {
  name: string;
  displayName?: string;
  version: string;
  description: string;
  category?: string;
  tags: string[];
  license?: string;
  path: string;
  counts: Record<ArtifactType, number>;
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  slug: string;
  plugin: string;
  description: string;
  invocation?: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  body: string;
  files: string[];
  sourceUrl: string;
  url: string;
}

export interface SiteIndex {
  schemaVersion: 1;
  generatedAt: string;
  commit: string;
  marketplace: {
    name: string;
    description: string;
    repo: string;
    owner: { name: string; url?: string };
  };
  plugins: Plugin[];
  artifacts: Artifact[];
}
