# Engineering Paved Path

The "paved path" for a TypeScript full-stack: 13 focused skills for React, Next.js, Fastify,
Drizzle, PostgreSQL, Zod, TypeScript, architecture, testing, security and diagrams.

Agents preload these skills through the `skills:` frontmatter field. Claude also loads them on
demand when a task matches a skill's description. Other plugins depend on this plugin rather than
copying the skills: [`sdd-engineering`](../sdd-engineering) and
[`architecture-review`](../architecture-review).

## Install

```
/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit
/plugin install engineering-paved-path@dev-digest-agentic-sdd-kit
```

The plugin has no dependencies.

## Skills

| Skill | Area | Use it for |
| --- | --- | --- |
| [`react-best-practices`](skills/react-best-practices/SKILL.md) | Frontend | Component design, state, hooks rules, anti-pattern catalog |
| [`next-best-practices`](skills/next-best-practices/SKILL.md) | Frontend | App Router file conventions, RSC boundaries, data patterns, metadata, route handlers |
| [`frontend-architecture`](skills/frontend-architecture/SKILL.md) | Frontend | Where components, constants, hooks, helpers and business logic live |
| [`react-testing-library`](skills/react-testing-library/SKILL.md) | Frontend | Integration-style RTL + Vitest tests that follow user flows |
| [`fastify-best-practices`](skills/fastify-best-practices/SKILL.md) | Backend | Routes, plugins, schema validation, hooks, errors, performance |
| [`drizzle-orm-patterns`](skills/drizzle-orm-patterns/SKILL.md) | Backend | Drizzle schema, queries, relations, transactions, migrations |
| [`postgresql-table-design`](skills/postgresql-table-design/SKILL.md) | Backend | PostgreSQL types, indexes, constraints, schema design |
| [`onion-architecture`](skills/onion-architecture/SKILL.md) | Backend | Layering: routes → service → repository, DTO boundaries, composition root |
| [`zod`](skills/zod/SKILL.md) | Full-stack | Schema definition, parsing, error handling, type inference |
| [`typescript-expert`](skills/typescript-expert/SKILL.md) | Full-stack | Type-level programming, tooling, performance, migrations |
| [`security`](skills/security/SKILL.md) | Full-stack | OWASP Top 10:2025, auth, injection, uploads, secrets |
| [`mermaid-diagram`](skills/mermaid-diagram/SKILL.md) | Shared | Flowcharts, sequence, class, ER and state diagrams in Markdown |
| [`engineering-insights`](skills/engineering-insights/SKILL.md) | Shared | Dated gotchas, decisions and conventions appended to `<package>/INSIGHTS.md` |

## Usage

**Automatically.** Describe the work ("add a Drizzle migration for…", "where should this hook
live?"). Claude loads the matching skill.

**Explicitly.** Name the skill with its namespace:

```
/engineering-paved-path:engineering-insights
Use engineering-paved-path:onion-architecture to review src/modules/orders/
```

**From your own agents.** Preload skills in an agent's frontmatter, and declare this plugin as a
dependency in your `plugin.json`:

```yaml
skills:
  - engineering-paved-path:react-best-practices
  - engineering-paved-path:security
```

```json
"dependencies": [{ "name": "engineering-paved-path", "version": "^1.0.0" }]
```

## Project conventions win

The skills describe sensible defaults. The architecture skills (`onion-architecture`,
`frontend-architecture`) tell Claude to read the project's own `CLAUDE.md` and architecture docs
first. Where the project documents a different convention, the project wins.

## Evals

`skills/onion-architecture/evals/` holds three planted-violation cases in the `skill-creator` eval
format (`evals.json` plus fixture modules). See its README for how to run them.

## Sources and licenses

Several skills are adapted from community repositories. Each keeps the license of its upstream
source:

| Skill | Upstream |
| --- | --- |
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) |
| `next-best-practices` | [vercel-labs/next-skills](https://github.com/vercel-labs/next-skills) |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) |

The other skills were written for this kit. Their research sources are listed in each skill's
`references.md`.

## Versioning

See [CHANGELOG.md](CHANGELOG.md). Releases are tagged `engineering-paved-path--v<version>`.
