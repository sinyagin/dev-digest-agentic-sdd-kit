#!/usr/bin/env node
// Prepares a plugin release on a new branch: bumps the version, moves CHANGELOG notes under it, validates, commits.
// The release tag and GitHub Release are created by .github/workflows/release.yml after the PR merges.
//
// Usage: node scripts/release.mjs <plugin> <patch|minor|major|x.y.z> [--notes "text"] [--pr]
//   --notes  release notes; added to whatever is already under "## Unreleased" in the plugin's CHANGELOG.md
//   --pr     push the branch and open a pull request with gh
import { writeFileSync } from 'node:fs';
import {
  addChangelogSection, bumpSemver, changelogPath, compareSemver, fail, findPlugin, git, gitOk,
  parseArgs, readChangelog, run, tagName, unreleasedNotes, writeJson,
} from './lib.mjs';

const { positionals, flags } = parseArgs(process.argv.slice(2), ['notes']);
const [name, bump] = positionals;
if (!name || !bump) fail('usage: node scripts/release.mjs <plugin> <patch|minor|major|x.y.z> [--notes "text"] [--pr]');

if (git('status', '--porcelain')) fail('working tree is not clean; commit or stash your changes first');

const { dir, manifest, manifestPath } = findPlugin(name);
const current = manifest.version;
let next;
try {
  next = bumpSemver(current, bump);
} catch (e) {
  fail(e.message);
}
if (compareSemver(next, current) <= 0) fail(`new version ${next} must be greater than ${current}`);

const tag = tagName(name, next);
if (gitOk('rev-parse', '-q', '--verify', `refs/tags/${tag}`)) fail(`tag ${tag} already exists`);

const changelog = readChangelog(dir);
const notes = [unreleasedNotes(changelog), flags.notes ? `- ${flags.notes}` : ''].filter(Boolean).join('\n');
if (!notes) fail(`no release notes: add entries under "## Unreleased" in ${changelogPath(dir)} or pass --notes`);

const branch = `release/${name}-v${next}`;
git('switch', '-c', branch);

writeJson(manifestPath, { ...manifest, version: next });
writeFileSync(changelogPath(dir), addChangelogSection(changelog, next, notes));

if (run('node', ['scripts/validate-marketplace.mjs']) !== 0) {
  fail(`validation failed; fix the problems on branch ${branch} and commit them yourself`);
}

git('add', dir);
git('commit', '-m', `release(${name}): v${next}`);
console.log(`\n✔ ${name} ${current} -> ${next} committed on ${branch}`);

if (flags.pr) {
  if (run('git', ['push', '-u', 'origin', branch]) !== 0) fail('git push failed');
  const body = `Release \`${name}\` v${next}.\n\n${notes}\n\nAfter merge, CI tags \`${tag}\` and creates the GitHub Release.`;
  if (run('gh', ['pr', 'create', '--title', `release(${name}): v${next}`, '--body', body]) !== 0) fail('gh pr create failed');
} else {
  console.log(`Next: git push -u origin ${branch} and open a pull request.`);
  console.log(`After merge, CI creates tag ${tag} and the GitHub Release.`);
}
