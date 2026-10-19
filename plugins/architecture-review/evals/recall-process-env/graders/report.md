---
type: llm
---

PASS only if the final report satisfies every point below:

- flags `process.env.DIGEST_MODEL` read in digests/service.ts as a violation of `config-access-through-provider`
- quotes the offending line verbatim as evidence
- does not flag `this.container.github()` / `this.container.llm(model)` as DI violations — they are container-resolved, which is the documented pattern

FAIL if any point is not satisfied.
