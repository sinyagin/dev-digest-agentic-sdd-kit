# Changelog

## Unreleased

## 1.0.0 - 2026-10-18

- Initial release.
- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skills: `run-plan` (executes an approved plan with a bounded review/fix loop) and `workflow-retro` (retrospective of a multi-agent run).
- Depends on `engineering-paved-path`, `research-tools` and `architecture-review` (`^1.0.0`).
- Specs, plans and the retro log take explicit `spec:`, `plan:` and `out:` inputs with documented defaults; no project-specific paths.
