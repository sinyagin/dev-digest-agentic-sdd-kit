---
type: llm
---

PASS only if the final report satisfies every point below:

- flags labels/routes.ts importing drizzle-orm / db/schema.js and querying `app.container.db` inside the GET /labels handler
- flags the branching (seed defaults when empty, filtering archived rows) inside the handler as business logic that belongs in the service
- names a rule identifier from the contract (e.g. `business-logic-in-routes`, `inward-only-dependencies`) for EVERY finding
- ends with a FAIL gate verdict

FAIL if any point is not satisfied.
