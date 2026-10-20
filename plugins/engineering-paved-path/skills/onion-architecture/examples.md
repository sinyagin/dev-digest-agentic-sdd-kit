# Onion Architecture — examples

Illustrative snippets for a Fastify + Drizzle backend with feature modules
under `src/modules/<name>/`, good and bad, plus the DI and row-sharing
patterns referenced in [SKILL.md](SKILL.md). Adapt names to the project.

## Good: routes → service → repository

`routes.ts` is framework-only — it resolves tenancy and delegates:

```ts
// src/modules/projects/routes.ts
app.get(
  '/projects/:id/status',
  { schema: { params: IdParams } },
  async (req): Promise<ProjectStatus> => {
    await getContext(container, req);
    return container.projects.getStatus(req.params.id);
  },
);
```

`service.ts` owns orchestration and takes only the `Container` in its
constructor — no direct adapter imports:

```ts
// src/modules/projects/service.ts
export class ProjectsService implements Projects {
  constructor(private container: Container) {}
  // ...delegates to this.repository (Drizzle) and container adapters
}
```

`repository.ts` is Drizzle-only, with typed row interfaces local to the
query shapes it needs:

```ts
// src/modules/projects/repository.ts
export interface ProjectBasics {
  id: string;
  owner: string;
  // ...
}
```

`routes.ts` never imports `drizzle-orm` or `db/schema.js`.

## Bad: DB access inline in a route handler

The route imports the schema directly and runs Drizzle queries inside the
HTTP handler — this is the anti-pattern the skill flags:

```ts
// src/modules/orders/routes.ts
import * as t from '../../db/schema.js';
// ...
app.get('/customers/:id/orders', { schema: { params: IdParams } }, async (req): Promise<OrderDto[]> => {
  const { tenantId } = await getContext(container, req);
  const [customer] = await container.db
    .select()
    .from(t.customers)
    .where(and(eq(t.customers.tenantId, tenantId), eq(t.customers.id, req.params.id)));
  // ...more inline `container.db.select/insert/update` calls follow,
  // including third-party sync logic, backfill, and cross-table
  // aggregation — all inside the route handler.
});
```

The fix: extract `OrdersService` (orchestration: sync, backfill policy) and
`OrdersRepository` (the `t.customers`/`t.orders` queries), leaving
`routes.ts` to resolve tenancy and call
`service.listForCustomer(tenantId, customerId)`.

## DTO mapping at the boundary (helpers.ts)

ORM rows are mapped to shared-contract DTOs once, in a pure helper — never
leaked raw across a module boundary:

```ts
// src/modules/orders/helpers.ts
export function orderRowToDto(row: OrderRow): OrderDto {
  return {
    id: row.id,
    status: row.status as OrderDto['status'],
    // ...
    customer_id: row.customerId,
    shipped_at: row.shippedAt?.toISOString() ?? null,
    cancelled_at: row.cancelledAt?.toISOString() ?? null,
  };
}
```

## Row types centralized, not duplicated (db/rows.ts)

```ts
// src/db/rows.ts
/**
 * Row types live here — next to the schema — rather than inside a module's
 * `repository.ts`, so cross-cutting consumers can reference a row shape
 * WITHOUT importing another module's data layer.
 */
export type OrderRow = typeof t.orders.$inferSelect;
export type CustomerRow = typeof t.customers.$inferSelect;
export type InvoiceRow = typeof t.invoices.$inferSelect;
```

Each owning repository re-exports its row type from here rather than
redefining it.

## Composition root: shared repositories and adapters (platform/container.ts)

```ts
// src/platform/container.ts
export class Container {
  // Shared repositories for cross-cutting entities. Constructed here, in the
  // composition root, so consuming modules use `container.customersRepo`
  // instead of reaching into another module's folder.
  private _customersRepo?: CustomersRepository;
  private _ordersRepo?: OrdersRepository;

  get customersRepo(): CustomersRepository {
    return (this._customersRepo ??= new CustomersRepository(this.db));
  }

  get ordersRepo(): OrdersRepository {
    return (this._ordersRepo ??= new OrdersRepository(this.db));
  }

  async payments(): Promise<PaymentsClient> {
    if (this.overrides.payments) return this.overrides.payments; // test override
    // ...lazily constructs the concrete client from a secret
  }
}
```

Services receive dependencies through `container`, never `new` them
directly — this is what lets tests inject overrides (mock LLM, mock payment
API) and stay hermetic.

## Domain core with zero framework imports

A framework-free core package whose one dependency is an injected
interface:

```ts
// core/src/index.ts
export interface LLMProvider {
  complete(prompt: string): Promise<string>;
}

// Pure logic only — the only side effect is the injected provider, which is
// what makes this mock-testable. No DB / HTTP / FS calls here.
export async function summarize(input: Input, llm: LLMProvider): Promise<Summary> {
  // ...
}
```

This is the onion's innermost ring taken to its logical conclusion: no
HTTP framework, no ORM, no filesystem — dependencies are inverted through a
single interface, and the package is consumed by the backend as a library.
