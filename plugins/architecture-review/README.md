# Architecture Review

A read-only architecture reviewer for Claude Code. It audits a diff or a set of files against the
structural contracts **your project documents**:

- Layering and dependency direction.
- Dependency-injection discipline.
- Access to configuration and secrets.
- Isolation of pure packages.
- Mandatory pipeline gates.
- Shared-contract usage.

Every finding cites the rule it breaks, with verbatim evidence. The report ends with a PASS/FAIL
gate.

## Install

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install architecture-review@dev-digest-agentic-sdd-kit
```

| Dependency | Version | Used for |
| --- | --- | --- |
| [`engineering-paved-path`](../engineering-paved-path) | `^1.0.0` | 8 preloaded skills: onion-architecture, frontend-architecture, fastify-best-practices, drizzle-orm-patterns, react-best-practices, next-best-practices, typescript-expert, security |

Claude Code installs the dependency automatically. [`sdd-engineering`](../sdd-engineering) depends
on this plugin and uses the reviewer as the structural gate in `/sdd-engineering:run-plan`.

## Components

| Component | Type | Model | Tools |
| --- | --- | --- | --- |
| `architecture-review:architecture-reviewer` | agent | opus | Read, Glob, Grep (no Edit, Write or Bash) |

## Usage

Pass the changed files or the diff. The agent has no `Bash`, so it can't compute a diff itself:

```
Use the architecture-reviewer agent on the files changed in this branch:
src/modules/orders/routes.ts, src/modules/orders/service.ts
```

Or give it the output of `git diff main...HEAD`.

## How it works

1. **File set.** It audits exactly the files you pass. If you pass none, it says that it is
   auditing a guessed set.
2. **Docs.** It reads the root `CLAUDE.md` or README, plus the docs of each package it touches:
   `CLAUDE.md`, README, `docs/architecture.md` and ADRs. You can also pass contract documents
   directly.
3. **Rules.** It builds the rule list from those docs. The common checks apply only when the
   project documents an equivalent contract:

   | Rule id | Checks |
   | --- | --- |
   | `inward-only-dependencies` | inner layers never import outer ones |
   | `business-logic-in-routes` | handlers only validate, call one service and reply |
   | `di-discipline` | concrete adapters are constructed only in the composition root |
   | `config-access-through-provider` | only the config provider reads the environment |
   | `pure-package-isolation` | a pure or core package does no direct I/O |
   | `mandatory-pipeline-gate` | no code path skips a documented gate |
   | `shared-contract-not-duplicated` | cross-package schemas come from the shared package |

4. **Report.** It returns a findings table (file, line, severity, rule, verbatim evidence,
   one-sentence recommendation) and a severity count. The gate is **PASS** only when there are
   zero critical and zero high findings.

**Out of scope:** style, naming, runtime bugs, test quality, performance and security injection.
A security issue it notices is noted as out of scope, not reported as an architecture finding.

## Evals

[`evals/`](evals) holds 8 cases in `claude plugin eval` format: 4 recall and 4 precision. Each case
has an LLM rubric grader and an agent-dispatch grader.

```
claude plugin eval plugins/architecture-review
```

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `architecture-review--v<version>`.
