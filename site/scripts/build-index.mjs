#!/usr/bin/env node
// Builds the site index from the marketplace catalog and plugin directories.
// Spec: docs/specs/marketplace-site.md, section 5.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

export const TYPES = ["skill", "agent", "command", "hook", "mcp"];
const PUBLIC_BODY_LIMIT = 4000;

export class IndexError extends Error {
  constructor(errors) {
    super(`Index build failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    this.errors = errors;
  }
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const toPosix = (p) => p.split(path.sep).join("/");
const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((t) => t.trim()).filter(Boolean);
  return [];
}

function firstParagraph(markdown) {
  for (const block of markdown.split(/\n\s*\n/)) {
    const text = block.trim();
    if (text && !text.startsWith("#") && !text.startsWith("```")) return text.replace(/\s+/g, " ");
  }
  return "";
}

/** Markdown → rough plain text for search. */
export function plainText(markdown) {
  return markdown
    .replace(/```[^\n]*\n/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/[*_>|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function detectRepo(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    if (m) return m[1];
  } catch {}
  return "";
}

function detectCommit(root) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

/** Resolves a manifest path field (string | string[]) plus the default directory. */
function componentPaths(pluginDir, defaultDir, custom) {
  const paths = [path.join(pluginDir, defaultDir)];
  for (const p of asArray(custom)) if (typeof p === "string") paths.push(path.resolve(pluginDir, p));
  return [...new Set(paths)];
}

function markdownFiles(paths) {
  const files = [];
  for (const p of paths) {
    if (!fs.existsSync(p)) continue;
    if (fs.statSync(p).isFile()) files.push(p);
    else files.push(...listFiles(p).filter((f) => f.endsWith(".md")));
  }
  return [...new Set(files)];
}

function collectSkills(ctx) {
  const dirs = [];
  for (const p of componentPaths(ctx.dir, "skills", ctx.manifest.skills)) {
    if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) continue;
    if (fs.existsSync(path.join(p, "SKILL.md"))) dirs.push(p);
    for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
      const sub = path.join(p, entry.name);
      if (entry.isDirectory() && fs.existsSync(path.join(sub, "SKILL.md"))) dirs.push(sub);
    }
  }
  for (const dir of [...new Set(dirs)].sort()) {
    const file = path.join(dir, "SKILL.md");
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const name = data.name || path.basename(dir);
    ctx.add({
      type: "skill",
      name,
      description: data.description,
      invocation: data["user-invocable"] === false ? undefined : `/${ctx.plugin}:${name}`,
      frontmatter: data,
      body: content,
      mainFile: file,
      files: listFiles(dir),
    });
  }
}

function collectMarkdownComponents(ctx, type, defaultDir, field) {
  const paths = componentPaths(ctx.dir, defaultDir, ctx.manifest[field]);
  for (const file of markdownFiles(paths).sort()) {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const base = paths.find((p) => file.startsWith(p + path.sep)) ?? path.dirname(file);
    const relName = toPosix(path.relative(base, file)).replace(/\.md$/, "").split("/").join(":");
    const name = (type === "agent" && data.name) || relName;
    ctx.add({
      type,
      name,
      description: data.description || (type === "command" ? firstParagraph(content) : undefined),
      invocation: type === "command" ? `/${ctx.plugin}:${name}` : `${ctx.plugin}:${name}`,
      frontmatter: data,
      body: content,
      mainFile: file,
      files: [file],
    });
  }
}

/** Loads a JSON config that is either inline in plugin.json, at a path, or at the default path. */
function loadConfigs(ctx, defaultFile, field, key) {
  const sources = [];
  const def = path.join(ctx.dir, defaultFile);
  if (fs.existsSync(def)) sources.push({ file: def, json: readJson(def) });
  for (const v of asArray(ctx.manifest[field])) {
    if (typeof v === "string") {
      const file = path.resolve(ctx.dir, v);
      if (file === def) continue;
      if (!fs.existsSync(file)) ctx.error(`${ctx.plugin}: ${field} path not found: ${v}`);
      else sources.push({ file, json: readJson(file) });
    } else if (v && typeof v === "object") {
      sources.push({ file: path.join(ctx.dir, ".claude-plugin/plugin.json"), json: v });
    }
  }
  return sources.map(({ file, json }) => ({ file, map: json[key] && typeof json[key] === "object" ? json[key] : json }));
}

const fence = (obj) => "```json\n" + JSON.stringify(obj, null, 2) + "\n```\n";

function collectHooks(ctx) {
  for (const { file, map } of loadConfigs(ctx, "hooks/hooks.json", "hooks", "hooks")) {
    for (const [event, groups] of Object.entries(map)) {
      if (!Array.isArray(groups)) continue;
      groups.forEach((group) => {
        const matcher = group.matcher && group.matcher !== "*" ? group.matcher : "";
        const handlers = asArray(group.hooks);
        const summary = handlers
          .map((h) => (h.type === "command" ? `runs \`${h.command}\`` : `${h.type} hook`))
          .join("; ");
        ctx.add({
          type: "hook",
          name: matcher ? `${event}:${matcher}` : event,
          description: group.description || `On ${event}${matcher ? ` (matcher: ${matcher})` : ""}: ${summary || "no handlers"}`,
          frontmatter: { event, ...(matcher ? { matcher } : {}), handlers: handlers.length },
          body: fence(group),
          mainFile: file,
          files: [file],
        });
      });
    }
  }
}

function collectMcp(ctx) {
  for (const { file, map } of loadConfigs(ctx, ".mcp.json", "mcpServers", "mcpServers")) {
    for (const [name, server] of Object.entries(map)) {
      if (!server || typeof server !== "object") continue;
      const transport = server.type || (server.url ? "http" : "stdio");
      const target = server.url || [server.command, ...asArray(server.args)].filter(Boolean).join(" ");
      ctx.add({
        type: "mcp",
        name,
        description: server.description || `${transport} MCP server: ${target}`,
        frontmatter: { transport, ...(server.command ? { command: server.command } : {}), ...(server.url ? { url: server.url } : {}) },
        body: fence(server),
        mainFile: file,
        files: [file],
      });
    }
  }
}

export function buildIndex(root, { commit, generatedAt, repo } = {}) {
  const errors = [];
  const marketplaceFile = path.join(root, ".claude-plugin/marketplace.json");
  if (!fs.existsSync(marketplaceFile)) throw new IndexError([`marketplace.json not found at ${marketplaceFile}`]);
  const catalog = readJson(marketplaceFile);
  repo ??= detectRepo(root);
  const blob = (file) => (repo ? `https://github.com/${repo}/blob/main/${toPosix(path.relative(root, file))}` : "");

  const plugins = [];
  const artifacts = [];
  const ids = new Set();
  const slugs = new Set();

  for (const entry of catalog.plugins ?? []) {
    const isLocal = typeof entry.source === "string";
    const dir = isLocal ? path.resolve(root, entry.source) : null;
    const manifestFile = dir && path.join(dir, ".claude-plugin/plugin.json");
    const manifest = manifestFile && fs.existsSync(manifestFile) ? readJson(manifestFile) : {};

    if (isLocal && !fs.existsSync(dir)) errors.push(`${entry.name}: source directory not found: ${entry.source}`);
    if (manifest.name && manifest.name !== entry.name) {
      errors.push(`${entry.name}: name in marketplace.json does not match plugin.json name "${manifest.name}"`);
    }

    const plugin = {
      name: entry.name,
      ...(manifest.displayName ? { displayName: manifest.displayName } : {}),
      version: manifest.version || entry.version || "unversioned",
      description: manifest.description || entry.description || "",
      ...(entry.category ? { category: entry.category } : {}),
      tags: [...new Set([...parseTags(entry.tags), ...parseTags(manifest.keywords), ...parseTags(entry.keywords)])],
      ...(manifest.license || entry.license ? { license: manifest.license || entry.license } : {}),
      path: dir ? toPosix(path.relative(root, dir)) : "",
      counts: Object.fromEntries(TYPES.map((t) => [t, 0])),
    };
    plugins.push(plugin);
    if (!isLocal || !fs.existsSync(dir)) continue;

    const ctx = {
      plugin: entry.name,
      dir,
      manifest,
      error: (msg) => errors.push(msg),
      add(item) {
        const id = `${entry.name}:${item.type}:${item.name}`;
        const where = toPosix(path.relative(root, item.mainFile));
        if (!item.description || !String(item.description).trim()) {
          errors.push(`${id}: missing description (${where})`);
          return;
        }
        if (ids.has(id)) {
          errors.push(`${id}: duplicate artifact id (${where})`);
          return;
        }
        ids.add(id);
        let slug = slugify(item.name);
        for (let i = 2; slugs.has(`${entry.name}/${item.type}/${slug}`); i++) slug = `${slugify(item.name)}-${i}`;
        slugs.add(`${entry.name}/${item.type}/${slug}`);
        plugin.counts[item.type]++;
        artifacts.push({
          id,
          type: item.type,
          name: item.name,
          slug,
          plugin: entry.name,
          description: String(item.description).replace(/\s+/g, " ").trim(),
          ...(item.invocation ? { invocation: item.invocation } : {}),
          tags: [...new Set([...plugin.tags, ...parseTags(item.frontmatter?.tags)])],
          frontmatter: JSON.parse(JSON.stringify(item.frontmatter ?? {})),
          body: item.body.trim(),
          files: item.files.map((f) => toPosix(path.relative(dir, f))),
          sourceUrl: blob(item.mainFile),
          url: `a/${entry.name}/${item.type}/${slug}/`,
        });
      },
    };

    collectSkills(ctx);
    collectMarkdownComponents(ctx, "command", "commands", "commands");
    collectMarkdownComponents(ctx, "agent", "agents", "agents");
    collectHooks(ctx);
    collectMcp(ctx);
  }

  if (errors.length) throw new IndexError(errors);

  plugins.sort((a, b) => a.name.localeCompare(b.name));
  artifacts.sort((a, b) => a.id.localeCompare(b.id));

  return {
    schemaVersion: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    commit: commit ?? detectCommit(root),
    marketplace: {
      name: catalog.name,
      description: catalog.description || catalog.metadata?.description || "",
      repo,
      owner: catalog.owner ?? { name: "" },
    },
    plugins,
    artifacts,
  };
}

/** Client copy: plain-text body capped for size (spec section 4). */
export function toPublicIndex(index) {
  return {
    ...index,
    artifacts: index.artifacts.map((a) => ({ ...a, body: plainText(a.body).slice(0, PUBLIC_BODY_LIMIT) })),
  };
}

function main() {
  const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const root = path.resolve(siteDir, "..");
  let index;
  try {
    index = buildIndex(root);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const write = (file, data) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  };
  write(path.join(siteDir, "src/data/index.json"), index);
  write(path.join(siteDir, "public/index.json"), toPublicIndex(index));
  console.log(`Indexed ${index.plugins.length} plugin(s), ${index.artifacts.length} artifact(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
