---
name: onion-architecture
version: 1.0.0
description: "Layered, dependency-inward architecture for Fastify/Drizzle
  (or similar Node.js) backend modules — routes (HTTP only) → service
  (business logic) → repository (ORM only), with shared schema contracts as
  the boundary DTOs. Use when adding or reviewing a backend module, deciding
  where a query/business rule/mapping belongs, or wiring a new adapter into
  the DI container. Flags routes that call the DB directly as a violation.
  Complements fastify-best-practices (route/plugin mechanics),
  drizzle-orm-patterns (query syntax) and postgresql-table-design (schema)
  without duplicating them."
---

# Onion Architecture (Backend)

Where backend code lives relative to the HTTP framework and the ORM, not how
routes or queries are written. This skill assumes `fastify-best-practices`
and `drizzle-orm-patterns` for mechanics and only adds *layering*: which file
a piece of logic belongs in, and which direction its imports may point. For
code examples, see [examples.md](examples.md); for sources, see
[references.md](references.md).

The file names below (`routes.ts`, `service.ts`, `repository.ts`,
`helpers.ts`, `container.ts`) are the conventional layout. If the project
documents different names (controllers, use-cases, gateways), map the rules
onto those — the dependency direction is what matters. Always read the
project's own architecture docs first; where they disagree with this skill,
the project's docs win.

**See also, and don't duplicate:**
- [fastify-best-practices](../fastify-best-practices/SKILL.md) — route
  definition, plugin registration, JSON-schema validation, error handling.
  This skill assumes those mechanics and only adds *where* the handler is
  allowed to reach.
- [drizzle-orm-patterns](../drizzle-orm-patterns/SKILL.md) — schema
  definition, query/relation syntax, transactions, migrations. This skill
  only says *which file* may import the ORM and the DB schema.
- [postgresql-table-design](../postgresql-table-design/SKILL.md) — table
  design itself (types, indexes, constraints).
- [zod](../zod/SKILL.md) — schema mechanics. This skill only covers *where*
  a Zod contract sits (boundary DTO vs. internal shape).
- [frontend-architecture](../frontend-architecture/SKILL.md) — the same
  "where things live" question, one layer up in the web client.

## Severity Levels

- **CRITICAL** — breaks the dependency-inward rule outright (an inner layer
  reaching into an outer one), or skips a layer entirely
- **HIGH** — will cause real friction as the module grows or gets tested
- **MEDIUM** — hurts consistency/testability but is cheap to fix later

---

## Layering Overview (CRITICAL)

Four rings, mapped onto a typical feature-module layout such as
`src/modules/<name>/`:

```
routes.ts         — Presentation: HTTP framework only. Parses/validates via a
                     Zod (or JSON) schema, calls ONE service method, returns
                     its result (or maps it to a shared contract DTO).
service.ts        — Application: orchestration + business rules. Talks to
                     repository methods and container-injected adapters
                     (git, HTTP APIs, LLMs, queues). Never imports
                     framework request/reply types.
repository.ts     — Infrastructure: ORM only. One repository per
                     module/aggregate; typed rows come from a central rows
                     file. No business rules beyond query shaping.
shared contracts  — Domain contracts: the Zod DTOs that cross the boundary
                     (HTTP response shapes, cross-package types), usually a
                     shared package. Routes and services map to/from these;
                     repositories never see them.
```

The dependency rule: `routes.ts → service.ts → repository.ts → db`, and
never the reverse. Concretely:
- `repository.ts` must never import the HTTP framework or a route file.
- `service.ts` must never import the HTTP framework, its type provider, or
  request/reply types.
- `routes.ts` must never import the ORM or the DB schema module.

A framework-free core package (pure TypeScript, zero DB/HTTP/FS imports,
side effects only through injected interfaces such as an `LLMProvider`) is
the innermost ring taken to its extreme. If the project has one, cite it as
the reference: new cross-cutting business/reasoning logic that doesn't need
the framework or the ORM should be able to live — and be unit-tested — the
same way.

## Route Layer Rules (CRITICAL)

- A `routes.ts` file may import the HTTP framework, its schema type
  provider, the module's own `service.ts`, request-context helpers (tenancy,
  auth), and shared contracts for request/response typing. It must **not**
  import the ORM or the DB schema.
- Every handler body should read as: resolve context (tenant/user) → call
  one service method → return/shape the result. No query building, no
  looping over rows, no `try/catch` around a raw `db.insert(...)`.
- Look for existing thin route files in the project to use as templates,
  and recognize existing violations (handlers calling `db.select/insert/
  update/delete` directly, route files importing the DB schema). Fix those
  opportunistically when you touch them, not as a mandated rewrite, and
  treat them as the anti-pattern, not the template, when writing new code
  nearby.
- **Signal you've violated this**: `routes.ts` importing the ORM or the DB
  schema at all. That's the moment to extract a `service.ts` (and, if one
  doesn't exist yet, a `repository.ts`).

## Service Layer Rules (HIGH)

- `service.ts` holds orchestration and business rules: input validation
  beyond shape (e.g. "does this tenant own this resource"), multi-step
  workflows, retries/degradation policy, mapping between repository rows
  and shared contract DTOs.
- It talks to persistence through repository **methods**, never
  `db.select()`/`db.insert()` directly — if a service needs a new query,
  add a method to the repository, don't reach past it.
- External systems (git, third-party APIs, LLMs) are obtained through the
  container's typed accessors (e.g. `container.github()`, `container.llm(id)`)
  — never `new SomeApiClient(...)` inline in a service. This keeps services
  testable against container overrides/mocks.
- A service constructor takes the container (or explicit interfaces) — not
  concrete adapter instances — so it composes the same way in production
  and in tests.

## Repository/Infrastructure Layer Rules (HIGH)

- One `repository.ts` per module. When a module owns more than one
  aggregate, split by entity into `repository/<entity>.repo.ts` files
  rather than growing one file indefinitely or one aggregate's queries
  bleeding into another's file.
- Repositories are ORM-only: query building, filters, transactions. No
  business rules, no calls to other services/adapters.
- Row types are centralized (e.g. a `db/rows.ts` of `$inferSelect` types) —
  a module's repository re-exports its row type from there rather than
  redefining it, so other modules can reference the shape without importing
  that module's `repository.ts` directly.
- Cross-module reads/writes go through a **shared repository registered in
  the composition root**, never by importing another module's
  `repository.ts` file directly. If a repository needs to be shared this
  way, register it as a container getter.

## Boundary DTOs (CRITICAL)

- The shared contracts package holds the Zod contracts that cross the HTTP
  boundary and are shared with the client and other packages. Route
  handlers type their responses against these; row → DTO mapping happens
  once, in a `helpers.ts` next to the service (e.g. `toReviewDto`).
- Never let a raw ORM row cross a module boundary or reach the client
  directly — map it to a shared (or module-local `*Dto`) shape first.
- Repositories never import shared contract DTOs; services never expose the
  ORM's inferred insert/update types in their public signatures.

## Composition Root / Dependency Injection (HIGH)

- One file (e.g. `platform/container.ts`) is the single composition root.
  New adapters (LLM providers, git/API clients, search indexes, etc.) are
  added as lazily-constructed getters there, resolved through the
  configuration/secrets provider and swappable via overrides — this is what
  makes hermetic tests with mock adapters possible.
- New cross-cutting repositories are registered the same way (a getter on
  the container) rather than instantiated ad hoc inside a service.
- A service or route must never construct an adapter or repository with
  `new X(...)` itself (aside from a module's own `repository.ts` being
  constructed once, inside its own `service.ts` constructor) — it should
  come from the container.

## Growth & Refactoring Triggers (MEDIUM)

Concrete signals it's time to reorganize, not vibes:

- A `routes.ts` gaining its **first** direct DB call → extract a
  `service.ts` (and a `repository.ts` if one doesn't exist), even if the
  query is "simple" — it never stays simple.
- A `repository.ts` mixing queries for two unrelated aggregates → split
  into `repository/<entity>.repo.ts` files, one per aggregate.
- A row-to-DTO mapping copy-pasted in a second place → promote it to that
  module's `helpers.ts`, imported by both.
- A service reaching for a new external system → add it to the composition
  root as a typed getter/method instead of importing the concrete adapter
  class into the service.
- A new piece of pure reasoning/business logic with no framework/ORM need →
  consider whether it belongs in a framework-free core package rather than
  a module's `service.ts`.
