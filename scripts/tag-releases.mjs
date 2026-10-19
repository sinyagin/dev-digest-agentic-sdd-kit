#!/usr/bin/env node
// Creates the <plugin>--v<version> tag (and a GitHub Release) for every plugin whose current version is untagged.
// Runs in .github/workflows/release.yml after a merge to main; safe to re-run.
//
// Usage: node scripts/tag-releases.mjs [--push] [--github-release] [--dry-run]
import { changelogSection, git, gitOk, loadMarketplace, parseArgs, readChangelog, run, tagName } from './lib.mjs';

const { flags } = parseArgs(process.argv.slice(2));
const { plugins } = loadMarketplace();
let failed = false;

for (const { entry, dir, manifest } of plugins) {
  if (!dir || !manifest?.version) continue;
  const tag = tagName(entry.name, manifest.version);
  if (gitOk('rev-parse', '-q', '--verify', `refs/tags/${tag}`)) {
    console.log(`= ${tag} already exists`);
    continue;
  }
  const notes = changelogSection(readChangelog(dir), manifest.version) ?? `Release ${manifest.version}`;
  if (flags['dry-run']) {
    console.log(`+ would create ${tag}\n${notes}\n`);
    continue;
  }
  git('tag', '-a', tag, '-m', `${entry.name} v${manifest.version}`);
  console.log(`+ created ${tag}`);
  if (flags.push && run('git', ['push', 'origin', `refs/tags/${tag}`]) !== 0) {
    failed = true;
    continue;
  }
  if (flags['github-release'] &&
      run('gh', ['release', 'create', tag, '--title', `${entry.name} v${manifest.version}`, '--notes', notes, '--verify-tag']) !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
