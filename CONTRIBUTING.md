# Contributing

## Requirements

- [Claude Code](https://code.claude.com) CLI
- Node.js 20 or later (for `scripts/`)
- `gh` CLI, optional, for `--pr` in the release scripts

## Development loop

1. Create a branch from `main`.
2. Edit a plugin under `plugins/<name>/` and add a line under `## Unreleased` in its `CHANGELOG.md`.
3. Try it from another project without installing:

   ```bash
   claude --plugin-dir /path/to/dev-digest-agentic-sdd-kit/plugins/<name>
   ```

   Or install it through the local marketplace. Edits then load on `/reload-plugins` without a version bump:

   ```bash
   claude plugin marketplace add ./
   claude plugin install <name>@dev-digest-agentic-sdd-kit
   ```

   Remove it afterwards with `claude plugin marketplace remove dev-digest-agentic-sdd-kit`, or it will clash with the GitHub-hosted marketplace of the same name.
4. Validate:

   ```bash
   node scripts/validate-marketplace.mjs --base main
   ```

5. Bump the version (see [docs/RELEASES.md](docs/RELEASES.md)) and open a pull request using the template.

## Add a new plugin

1. Create `plugins/<name>/` following [docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md), with `.claude-plugin/plugin.json` (`"version": "0.1.0"`), a `README.md`, and a `CHANGELOG.md`.
2. Add an entry to `.claude-plugin/marketplace.json`:

   ```json
   { "name": "<name>", "source": "./plugins/<name>", "description": "…", "category": "development" }
   ```

3. Add the plugin to the table in the root `README.md`.

## Scripts

| Script | Purpose |
| --- | --- |
| `scripts/validate-marketplace.mjs [--base <ref>]` | Checks repository invariants, then runs `claude plugin validate --strict` |
| `scripts/release.mjs <plugin> <bump>` | Prepares a release branch: version bump, CHANGELOG, commit |
| `scripts/rollback.mjs <plugin> <version>` | Restores a released version and publishes it as a new patch version |
| `scripts/tag-releases.mjs` | Creates missing release tags and GitHub Releases (used by CI) |

## Conventions

- All content is in English.
- Commit messages: `<type>(<plugin>): <summary>`, e.g. `feat(sdd-engineering): add spec-review skill`. Types: `feat`, `fix`, `docs`, `chore`, `release`, `rollback`.
- See [docs/SECURITY.md](docs/SECURITY.md) before adding hooks, MCP servers, or scripts.
