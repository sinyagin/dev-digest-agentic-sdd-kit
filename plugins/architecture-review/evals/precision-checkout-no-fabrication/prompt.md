---
description: Does not invent out-of-scope findings for the checkout diff.
tags: [precision]
max_turns: 15
allowed_tools: [Agent, Read, Glob, Grep]
---

Run an architecture review of the diff below against our documented structural contracts and give me the reviewer's report.

The project documents these structural contracts in `docs/architecture.md` (rule id — rule):

- `inward-only-dependencies` — layers are Presentation (`routes.ts`) → Application (`service.ts`) → Infrastructure (`repository.ts`) → Domain (`domain/`, `@app/shared`). An inner layer never imports an outer one; domain code imports no HTTP framework, ORM, or adapter.
- `business-logic-in-routes` — a route handler only validates input, calls one service method, and sends the reply.
- `di-discipline` — concrete adapters, repositories and services are constructed only in the composition root `server/src/platform/container.ts`; everything else receives them from the container.
- `config-access-through-provider` — only `server/src/platform/localSecretsProvider.ts` reads `process.env`.
- `pure-package-isolation` — the `core/` package does no I/O except through the injected `LLMProvider`.
- `mandatory-pipeline-gate` — every `core/` pipeline result passes through `groundFindings()` before it is returned.
- `shared-contract-not-duplicated` — `@app/shared` is the single source of truth for cross-package Zod contracts.

```diff
diff --git a/server/src/modules/checkout/domain/checkout.ts b/server/src/modules/checkout/domain/checkout.ts
index 1111111..2222222 100644
--- a/server/src/modules/checkout/domain/checkout.ts
+++ b/server/src/modules/checkout/domain/checkout.ts
@@ -1,5 +1,6 @@
+import type { FastifyReply } from "fastify";
 export interface CheckoutOrder {
   id: string;
   total: number;
 }

-export function priceOrder(order: CheckoutOrder): number {
+export function priceOrder(order: CheckoutOrder, reply?: FastifyReply): number {
   return order.total;
 }

diff --git a/server/src/modules/checkout/service.ts b/server/src/modules/checkout/service.ts
index 3333333..4444444 100644
--- a/server/src/modules/checkout/service.ts
+++ b/server/src/modules/checkout/service.ts
@@ -1,10 +1,14 @@
 import { priceOrder } from "./domain/checkout.js";
+import { PgCheckoutRepository } from "./repository.js";

 export class CheckoutService {
+  private repo = new PgCheckoutRepository();
+
   async checkout(order: { id: string; total: number }) {
     const price = priceOrder(order);
+    await this.repo.save(order.id, price);
     return { price };
   }
 }
```
