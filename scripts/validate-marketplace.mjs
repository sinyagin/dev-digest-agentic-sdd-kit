#!/usr/bin/env node
// Checks the marketplace for problems `claude plugin validate` doesn't catch, then runs it too.
//
// Usage: node scripts/validate-marketplace.mjs [--base <git-ref>] [--skip-cli]
//   --base      also require a version bump and CHANGELOG entry for every plugin changed since <git-ref>
//   --skip-cli  don't run `claude plugin validate --strict`
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  ROOT, changelogSection, compareSemver, git, gitOk, hasCommand, isSemver,
  loadMarketplace, parseArgs, readChangelog, run,
} from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2), ['base']);
const errors = [];
const error = (msg) => errors.push(msg);
const rel = (p) => relative(ROOT, p);

const { marketplace, plugins } = loadMarketplace();

// --- marketplace entries ----------------------------------------------------

for (const { entry, dir, manifestPath, manifest } of plugins) {
  const where = `plugin entry "${entry.name}"`;
  if (!dir) continue; // remote sources are fetched at install time; nothing local to check
  if (!existsSync(dir)) {
    error(`${where}: source ${entry.source} does not exist`);
    continue;
  }
  if (!manifest) {
    error(`${where}: ${rel(manifestPath)} is missing`);
    continue;
  }
  if (manifest.name !== entry.name) {
    error(`${where}: entry name differs from plugin.json name "${manifest.name}"; keep them equal`);
  }
  if ('version' in entry) {
    error(`${where}: set "version" only in plugin.json, not in marketplace.json`);
  }
  if (!isSemver(manifest.version)) {
    error(`${where}: plugin.json version "${manifest.version}" is not semver (x.y.z)`);
  }
  if (!existsSync(join(dir, 'CHANGELOG.md'))) {
    error(`${where}: ${rel(join(dir, 'CHANGELOG.md'))} is missing`);
  }
  if (existsSync(join(dir, 'bin'))) {
    error(`${where}: move executables out of top-level bin/ (claude.ai org sync rejects it); use scripts/`);
  }
  if (existsSync(join(dir, '.claude-plugin')) &&
      readdirSync(join(dir, '.claude-plugin')).some((f) => f !== 'plugin.json')) {
    error(`${where}: only plugin.json belongs in .claude-plugin/; put components at the plugin root`);
  }
  checkFrontmatter(dir);
}

const names = plugins.map((p) => p.entry.name);
for (const dup of new Set(names.filter((n, i) => names.indexOf(n) !== i))) {
  error(`duplicate plugin name "${dup}" in marketplace.json`);
}

function checkFrontmatter(dir) {
  const files = [];
  const skills = join(dir, 'skills');
  if (existsSync(skills)) {
    for (const name of readdirSync(skills)) {
      const skill = join(skills, name, 'SKILL.md');
      if (statSync(join(skills, name)).isDirectory()) {
        if (existsSync(skill)) files.push(skill);
        else error(`${rel(join(skills, name))}: missing SKILL.md`);
      }
    }
  }
  const agents = join(dir, 'agents');
  if (existsSync(agents)) files.push(...walk(agents).filter((f) => f.endsWith('.md')));

  for (const file of files) {
    const match = readFileSync(file, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) {
      error(`${rel(file)}: missing YAML frontmatter`);
      continue;
    }
    for (const key of ['name', 'description']) {
      if (!new RegExp(`^${key}:[ \\t]*\\S`, 'm').test(match[1])) {
        error(`${rel(file)}: frontmatter needs a non-empty "${key}"`);
      }
    }
  }
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}

// --- English-only guard -----------------------------------------------------

const CYRILLIC = /[\u0400-\u04FF]/; // written as escapes so this file passes its own check
const repoFiles = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n').filter(Boolean);
for (const file of repoFiles) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  const buf = readFileSync(path);
  if (buf.includes(0)) continue; // binary
  buf.toString('utf8').split('\n').forEach((line, i) => {
    if (CYRILLIC.test(line)) error(`${file}:${i + 1}: non-English (Cyrillic) text; repository content must be in English`);
  });
}

// --- version bump since base ------------------------------------------------

if (flags.base) {
  if (!gitOk('rev-parse', '--verify', `${flags.base}^{commit}`)) {
    error(`--base ${flags.base} is not a known commit (fetch it first)`);
  } else {
    const mergeBase = git('merge-base', flags.base, 'HEAD');
    const changed = git('diff', '--name-only', mergeBase).split('\n').filter(Boolean);
    const untracked = git('ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
    const touched = [...changed, ...untracked].filter((f) => !f.endsWith('README.md'));

    for (const { entry, dir, manifest, manifestPath } of plugins) {
      if (!dir || !manifest || !isSemver(manifest.version)) continue;
      const prefix = `${rel(dir)}/`;
      if (!touched.some((f) => f.startsWith(prefix))) continue;

      let baseVersion = null;
      try {
        baseVersion = JSON.parse(git('show', `${mergeBase}:${rel(manifestPath)}`)).version;
      } catch {
        // plugin is new on this branch
      }
      if (baseVersion && isSemver(baseVersion) && compareSemver(manifest.version, baseVersion) <= 0) {
        error(`plugin "${entry.name}" changed but its version is still ${manifest.version}; ` +
          `run: node scripts/release.mjs ${entry.name} patch|minor|major`);
      }
      if (changelogSection(readChangelog(dir), manifest.version) === null) {
        error(`plugin "${entry.name}": CHANGELOG.md has no "## ${manifest.version}" section`);
      }
    }
  }
}

// --- report -----------------------------------------------------------------

if (errors.length) {
  console.error(`✘ ${errors.length} problem(s) in marketplace "${marketplace.name}":`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✔ Marketplace checks passed (${plugins.length} plugin(s))`);

if (flags['skip-cli']) process.exit(0);
if (!hasCommand('claude')) {
  console.warn('! claude CLI not found; skipping `claude plugin validate` (install @anthropic-ai/claude-code)');
  process.exit(0);
}
let status = run('claude', ['plugin', 'validate', ROOT, '--strict']);
for (const { dir } of plugins) {
  if (dir && existsSync(dir)) status = run('claude', ['plugin', 'validate', dir, '--strict']) || status;
}
process.exit(status);
