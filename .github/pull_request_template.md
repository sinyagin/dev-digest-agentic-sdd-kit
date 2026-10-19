## Summary

<!-- What changes and why. -->

## Affected plugins

<!-- e.g. sdd-kit -->

## Checklist

- [ ] `node scripts/validate-marketplace.mjs` passes locally
- [ ] Every changed plugin has a version bump in `plugin.json` (`node scripts/release.mjs <plugin> <bump>`)
- [ ] `CHANGELOG.md` of every changed plugin describes the change
- [ ] Tested locally with `claude --plugin-dir ./plugins/<plugin>` from another project
- [ ] All content is in English

## Security

- [ ] No secrets, tokens, or personal paths committed
- [ ] New or changed hooks, MCP servers, and scripts are reviewed (see `docs/SECURITY.md`)
- [ ] External plugin sources are pinned to a `sha`
