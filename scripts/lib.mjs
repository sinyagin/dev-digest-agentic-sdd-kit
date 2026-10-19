// Shared helpers for the marketplace maintenance scripts. Node >= 20, no dependencies.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MARKETPLACE_PATH = join(ROOT, '.claude-plugin', 'marketplace.json');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, data) {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

// Runs git and returns trimmed stdout. Throws on a non-zero exit.
export function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function gitOk(...args) {
  return spawnSync('git', args, { cwd: ROOT, stdio: 'ignore' }).status === 0;
}

export function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

export function hasCommand(cmd) {
  const res = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
  return !res.error && res.status === 0;
}

export function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// Splits argv into positionals and --flags. `--key value` or `--key=value` set a string; a bare `--key` sets true.
export function parseArgs(argv, valueFlags = []) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [key, inline] = arg.slice(2).split(/=(.*)/s);
    if (inline !== undefined) flags[key] = inline;
    else if (valueFlags.includes(key)) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { positionals, flags };
}

// --- semver -----------------------------------------------------------------

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function isSemver(v) {
  return typeof v === 'string' && SEMVER.test(v);
}

export function compareSemver(a, b) {
  const [, a1, a2, a3, aPre] = a.match(SEMVER);
  const [, b1, b2, b3, bPre] = b.match(SEMVER);
  for (const [x, y] of [[a1, b1], [a2, b2], [a3, b3]]) {
    if (Number(x) !== Number(y)) return Number(x) - Number(y);
  }
  if (aPre === bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  return aPre < bPre ? -1 : 1;
}

export function bumpSemver(version, kind) {
  if (isSemver(kind)) return kind;
  const [, major, minor, patch] = version.match(SEMVER).map(Number);
  switch (kind) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    default: throw new Error(`unknown bump "${kind}"; use patch, minor, major, or an explicit x.y.z`);
  }
}

// --- marketplace ------------------------------------------------------------

export function tagName(plugin, version) {
  return `${plugin}--v${version}`;
}

// Resolves an entry's relative source to an absolute directory, or null for remote sources.
export function resolveSource(marketplace, source) {
  if (typeof source !== 'string') return null;
  if (source.startsWith('./') || source === '.') return resolve(ROOT, source);
  const pluginRoot = marketplace.metadata?.pluginRoot;
  if (pluginRoot && !source.includes('/')) return resolve(ROOT, pluginRoot, source);
  return resolve(ROOT, source);
}

// Returns the marketplace and one record per plugin entry with a local (relative-path) source.
export function loadMarketplace() {
  const marketplace = readJson(MARKETPLACE_PATH);
  const plugins = (marketplace.plugins ?? []).map((entry) => {
    const dir = resolveSource(marketplace, entry.source);
    const manifestPath = dir && join(dir, '.claude-plugin', 'plugin.json');
    const manifest = manifestPath && existsSync(manifestPath) ? readJson(manifestPath) : null;
    return { entry, dir, manifestPath, manifest };
  });
  return { marketplace, plugins };
}

export function findPlugin(name) {
  const { plugins } = loadMarketplace();
  const plugin = plugins.find((p) => p.entry.name === name);
  if (!plugin) fail(`plugin "${name}" is not listed in .claude-plugin/marketplace.json`);
  if (!plugin.dir) fail(`plugin "${name}" has a remote source; release it from its own repository`);
  if (!plugin.manifest) fail(`plugin "${name}" has no .claude-plugin/plugin.json`);
  return plugin;
}

// --- changelog --------------------------------------------------------------

const UNRELEASED = /^## Unreleased[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

export function changelogPath(pluginDir) {
  return join(pluginDir, 'CHANGELOG.md');
}

export function readChangelog(pluginDir) {
  const path = changelogPath(pluginDir);
  return existsSync(path) ? readFileSync(path, 'utf8') : '# Changelog\n\n## Unreleased\n';
}

export function unreleasedNotes(text) {
  return text.match(UNRELEASED)?.[1].trim() ?? '';
}

// Writes `## <version> - <date>` with `body` right below an emptied `## Unreleased` section.
export function addChangelogSection(text, version, body) {
  const date = new Date().toISOString().slice(0, 10);
  const section = `## ${version} - ${date}\n\n${body.trim()}\n\n`;
  if (UNRELEASED.test(text)) return text.replace(UNRELEASED, `## Unreleased\n\n${section}`);
  return text.replace(/^(# .*\n+)/, `$1## Unreleased\n\n${section}`);
}

export function changelogSection(text, version) {
  const escaped = version.replace(/\./g, '\\.');
  const re = new RegExp(`^## ${escaped}(?:\\s.*)?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm');
  return text.match(re)?.[1].trim() ?? null;
}
