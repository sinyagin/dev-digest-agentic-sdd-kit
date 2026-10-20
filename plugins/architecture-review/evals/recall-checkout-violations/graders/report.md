---
type: llm
---

PASS only if the final report satisfies every point below:

- flags the domain file (checkout.ts) importing a type from 'fastify' as a violation of `inward-only-dependencies`
- flags `new PgCheckoutRepository()` inside service.ts as a violation of `di-discipline`
- names a rule identifier from the contract (e.g. `inward-only-dependencies`, `di-discipline`) for EVERY finding rather than describing it only in prose
- assigns a severity (critical/high/medium/low/info) to each finding
- quotes the offending line verbatim as evidence for each finding
- ends with an explicit PASS/FAIL gate verdict based on whether any critical or high findings exist

FAIL if any point is not satisfied.
