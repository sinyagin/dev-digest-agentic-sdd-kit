# Plugin guidelines

Rules for every plugin in this marketplace. `node scripts/validate-marketplace.mjs` enforces the ones marked ✓.

## Layout

```
plugins/<name>/
├── .claude-plugin/plugin.json   # the only file inside .claude-plugin/ ✓
├── skills/<skill>/SKILL.md
├── agents/<agent>.md
├── commands/<command>.md        # prefer skills for new work
├── hooks/hooks.json
├── scripts/                     # executables called by hooks or MCP servers
├── .mcp.json
├── CHANGELOG.md                 # ✓
└── README.md
```

- Put every component at the plugin root, never inside `.claude-plugin/`.
- Don't add a top-level `bin/` directory; claude.ai organization sync rejects plugins that have one. Use `scripts/`. ✓
- A `CLAUDE.md` in a plugin is not loaded. Put instructions in a skill.
- Don't track plugin files with Git LFS; installs receive pointer files instead of content.

## Naming

- Use kebab-case for plugin, skill, and agent names.
- The entry `name` in `marketplace.json` must equal `name` in `plugin.json`. ✓
- Don't start a name with `claude-`, `anthropic-`, or `cc-plugin-`; these are reserved.
- Never rename a published plugin's `name`. Change `displayName` instead. If a rename is unavoidable, add the old name to `renames` in `marketplace.json`.
- Refer to skills with their namespace, e.g. `/sdd-kit:hello`, in docs and in other skills.

## Manifest

- Set `name`, `version`, `description`, `author`, and `license` in `plugin.json`.
- Set `version` only in `plugin.json`, never in the marketplace entry. ✓
- Use semantic versioning. ✓ See [RELEASES.md](RELEASES.md).

## Skills and agents

- Every `SKILL.md` and agent file starts with YAML frontmatter that has a non-empty `name` and `description`. ✓
- Write the `description` so Claude knows when to use it: what it does and when to trigger it.
- Keep each skill focused on one task.

## Hooks, MCP servers, and scripts

- Reference bundled files with `${CLAUDE_PLUGIN_ROOT}`; quote it in shell-form commands: `"${CLAUDE_PLUGIN_ROOT}"/scripts/run.sh`.
- Write state, caches, and installed dependencies to `${CLAUDE_PLUGIN_DATA}`. `${CLAUDE_PLUGIN_ROOT}` changes on every update.
- Never use absolute paths or `~/`.
- `hooks/hooks.json` wraps the event map in a top-level `"hooks"` key.
- Hook scripts read the event payload as JSON on stdin.
- Ask users for configuration with `userConfig`; mark credentials `"sensitive": true`.

## Language

All content is in English: docs, skills, agents, comments, and commit messages. ✓

## Testing

- Validate: `node scripts/validate-marketplace.mjs`.
- Load the plugin from another project: `claude --plugin-dir /path/to/plugins/<name>`.
- Install through the marketplace: `claude plugin marketplace add ./` then `claude plugin install <name>@dev-digest-agentic-sdd-kit`.
