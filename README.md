# dev-digest-agentic-sdd-kit

A Claude Code plugin marketplace with tooling for agentic spec-driven development.

## Usage

Add the marketplace and install a plugin:

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install sdd-kit@dev-digest-agentic-sdd-kit
```

To get updates automatically, enable auto-update for this marketplace in `/plugin` → **Marketplaces**.
Otherwise run `/plugin marketplace update dev-digest-agentic-sdd-kit`.

To register the marketplace for everyone working in a project, run this once in that project and commit `.claude/settings.json`:

```
claude plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit --scope project
```

## Plugins

| Plugin | Description |
| --- | --- |
| [`sdd-kit`](plugins/sdd-kit) | Spec-driven development skills, agents and commands |

## Repository layout

```
.claude-plugin/marketplace.json   # marketplace catalog
plugins/<name>/                   # one directory per plugin
  .claude-plugin/plugin.json      # plugin manifest (only file in .claude-plugin/)
  skills/ agents/ commands/ hooks/
  CHANGELOG.md
scripts/                          # validation, release, and rollback scripts
docs/                             # guidelines, release process, security policy
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [plugin guidelines](docs/PLUGIN-GUIDELINES.md), [releases and rollbacks](docs/RELEASES.md), and [security](docs/SECURITY.md).
