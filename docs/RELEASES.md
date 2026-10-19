# Releases

## How users receive updates

Claude Code caches each plugin by its version. Users get new plugin content **only when the `version` in `plugin.json` changes**. A merged change without a version bump never reaches anyone who already installed the plugin.

Users receive a new version when:

- auto-update is on for this marketplace (`/plugin` → **Marketplaces** → **Enable auto-update**; off by default for third-party marketplaces), or
- they run `/plugin marketplace update dev-digest-agentic-sdd-kit`, or `claude plugin update <plugin>@dev-digest-agentic-sdd-kit`.

After an update, `/reload-plugins` or a new session loads it.

## Versioning

- Semantic versioning, per plugin: `MAJOR.MINOR.PATCH`.
  - **MAJOR**: a skill, agent, or command removed or renamed, or behavior changed incompatibly.
  - **MINOR**: new skills, agents, commands, or options.
  - **PATCH**: fixes and wording changes.
- `version` lives only in `plugins/<plugin>/.claude-plugin/plugin.json`.
- Each plugin has a `CHANGELOG.md`. Collect notes under `## Unreleased` while you work.
- Each release is tagged `<plugin>--v<version>`, e.g. `sdd-kit--v1.2.0`. This is the convention Claude Code uses to resolve plugin dependency version ranges.

CI fails a pull request that changes a plugin without bumping its version and adding a matching CHANGELOG section. Changes to `README.md` files are exempt.

## Release a plugin

```bash
git switch main && git pull
node scripts/release.mjs sdd-kit minor --notes "Add the spec-review skill" --pr
```

The script:

1. Requires a clean working tree.
2. Creates branch `release/<plugin>-v<version>`.
3. Bumps `version` in `plugin.json`.
4. Moves the `## Unreleased` notes (plus `--notes`) under `## <version> - <date>` in `CHANGELOG.md`.
5. Runs `scripts/validate-marketplace.mjs` and commits.
6. With `--pr`, pushes the branch and opens a pull request. Without it, prints the commands to run.

You can also bump the version as part of a feature pull request instead of a separate release PR; CI only requires that the version is bumped.

After the pull request merges, `.github/workflows/release.yml` runs `scripts/tag-releases.mjs`, which creates the `<plugin>--v<version>` tag and a GitHub Release with the CHANGELOG section. Re-running it is safe; existing tags are skipped.

## Roll back a plugin

A rollback is published as a **new** version. Re-publishing an older version string doesn't reliably replace what users have cached.

```bash
git switch main && git pull && git fetch --tags
node scripts/rollback.mjs sdd-kit 1.1.0 --reason "1.2.0 breaks spec parsing" --pr
```

The script:

1. Checks that tag `<plugin>--v<good-version>` exists.
2. Creates branch `rollback/<plugin>-v<next-patch>`.
3. Replaces `plugins/<plugin>/` with its contents at that tag, deleting files added since.
4. Sets `version` to the next patch above the current version (e.g. 1.2.0 → 1.2.1) and keeps the full CHANGELOG history with a rollback entry.
5. Validates and commits; with `--pr`, opens a pull request.

Merge the pull request as soon as checks pass. Release CI tags the new version, and users receive it on their next update. To speed this up, ask users to run `/plugin marketplace update dev-digest-agentic-sdd-kit`.

The rollback restores only the plugin directory. If the bad release also changed the plugin's entry in `marketplace.json`, revert that entry in the same pull request.

## Remove a plugin

1. Delete its entry from `plugins` in `marketplace.json` and its directory.
2. Add `"<plugin>": null` to `renames` in `marketplace.json` so existing installs are cleaned up instead of reporting "not found".
