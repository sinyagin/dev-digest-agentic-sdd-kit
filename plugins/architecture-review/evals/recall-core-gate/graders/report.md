---
type: llm
---

PASS only if the final report satisfies every point below:

- flags `import { readFileSync } from "node:fs"` added to core/src/pipeline/run.ts as a violation (core must do no I/O except the injected LLMProvider)
- flags that runPipeline now returns `deduped` directly, skipping the mandatory `groundFindings()` gate
- names the rule identifier `pure-package-isolation` for the fs-import finding
- names the rule identifier `mandatory-pipeline-gate` for the skipped-gate finding
- quotes the offending line verbatim as evidence for each finding
- ends with an explicit PASS/FAIL gate verdict based on whether any critical or high findings exist

FAIL if any point is not satisfied.
