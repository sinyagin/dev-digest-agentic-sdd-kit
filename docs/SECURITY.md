# Security

Plugins run with the user's permissions. Hooks, MCP servers, and scripts execute code on every machine that installs them, so they get the strictest review.

## Rules for contributors

- **No secrets in the repository.** No tokens, keys, internal URLs with credentials, or personal paths. Ask for credentials through `userConfig` with `"sensitive": true`; Claude Code stores those in the system credential store.
- **Hooks and scripts**
  - Do only what the plugin's description promises; no network calls or file access beyond that.
  - Quote `${CLAUDE_PLUGIN_ROOT}` and every variable; treat hook input on stdin as untrusted.
  - Never pipe downloaded content into a shell (`curl … | sh`).
  - Write only to `${CLAUDE_PLUGIN_DATA}` or the project the user is working in.
- **MCP servers**: use `https://` for remote servers; don't put literal credentials in headers.
- **External sources**: a plugin entry that points at another repository must pin a full commit `sha`, so a compromised upstream branch can't change what users install.
- **Dependencies**: commit a lockfile with exact versions; Claude Code installs them with lifecycle scripts disabled.

## Review

`CODEOWNERS` review is required for every pull request. Reviewers check the security items in the pull request template and read every changed hook, MCP config, and script line by line.

## Reporting a vulnerability

Don't open a public issue. Report it privately through GitHub: **Security** → **Report a vulnerability** on this repository, or contact the owner listed in `CODEOWNERS`.

If a released plugin is affected, roll it back first (see [RELEASES.md](RELEASES.md#roll-back-a-plugin)), then fix forward.
