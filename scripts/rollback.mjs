#!/usr/bin/env node
// Rolls a plugin back by rolling forward: restores the plugin files from a released tag and publishes
// them under a new patch version, so users' cached copies are replaced on their next update.
// (Re-publishing an older version string is unreliable: Claude Code caches plugins by version.)
//
// Usage: node scripts/rollback.mjs <plugin> <good-version> [--reason "text"] [--pr]
//   <good-version>  a released version with an existing <plugin>--v<version> tag
//   --reason        why the rollback is needed; recorded in the CHANGELOG
//   --pr            push the branch and open a pull request with gh
import { writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import {
  addChangelogSection, bumpSemver, changelogPath, fail, findPlugin, git, gitOk,
  parseArgs, readChangelog, readJson, ROOT, run, tagName, writeJson,
} from './lib.mjs';

const { positionals, flags } = parseArgs(process.argv.slice(2), ['reason']);
const [name, good] = positionals;
if (!name || !good) fail('usage: node scripts/rollback.mjs <plugin> <good-version> [--reason "text"] [--pr]');

if (git('status', '--porcelain')) fail('working tree is not clean; commit or stash your changes first');

const { dir, manifest, manifestPath } = findPlugin(name);
const goodTag = tagName(name, good);
if (!gitOk('rev-parse', '-q', '--verify', `refs/tags/${goodTag}`)) {
  fail(`tag ${goodTag} not found; run "git fetch --tags" or pick one of: ` +
    (git('tag', '--list', `${name}--v*`) || '(no tags yet)').split('\n').join(', '));
}

const current = manifest.version;
const next = bumpSemver(current, 'patch');
const branch = `rollback/${name}-v${next}`;
const changelog = readChangelog(dir); // keep history; the restored tree has the old changelog
const pluginPath = relative(ROOT, dir);

git('switch', '-c', branch);
// Remove first so files added after the good release are deleted, then restore the tagged tree.
git('rm', '-r', '-q', '--ignore-unmatch', pluginPath);
git('checkout', goodTag, '--', pluginPath);

writeJson(manifestPath, { ...readJson(manifestPath), version: next });
const body = `- Roll back to ${good}: restores the plugin contents released as ${good}.` +
  (flags.reason ? `\n- Reason: ${flags.reason}` : '');
writeFileSync(changelogPath(dir), addChangelogSection(changelog, next, body));

if (run('node', ['scripts/validate-marketplace.mjs']) !== 0) {
  fail(`validation failed; fix the problems on branch ${branch} and commit them yourself`);
}

git('add', '-A', pluginPath);
git('commit', '-m', `rollback(${name}): v${next} restores v${good}`);
console.log(`\n✔ ${name} ${current} -> ${next} (contents of ${good}) committed on ${branch}`);

if (flags.pr) {
  if (run('git', ['push', '-u', 'origin', branch]) !== 0) fail('git push failed');
  const prBody = `Roll back \`${name}\` to the contents of v${good}, published as v${next}.\n\n${body}`;
  if (run('gh', ['pr', 'create', '--title', `rollback(${name}): v${next} restores v${good}`, '--body', prBody]) !== 0) {
    fail('gh pr create failed');
  }
} else {
  console.log(`Next: git push -u origin ${branch}, open a pull request, and merge it.`);
}
console.log('Users receive the rollback through auto-update or /plugin marketplace update.');
