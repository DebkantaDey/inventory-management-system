ARCHITECTURE.md

1. Overview

This document explains the architectural decisions behind the multi-tenant SaaS Inventory Management Platform. The system is designed to support multiple independent businesses (tenants) with strict data isolation, high concurrency, and real-world inventory complexity while maintaining performance and scalability.


2. Multi-Tenancy Approach

Chosen Approach: **Row-Level Multi-Tenancy (Single Database, Shared Collections)**

Each document in tenant-specific collections includes a `tenantId` field. All queries are automatically scoped by `tenantId` using middleware.

Why this approach?

* Easier to manage and deploy compared to multiple databases
* Efficient resource utilization
* Works well with MongoDB indexing and sharding
* Scales to thousands of tenants with predictable costs

Alternatives Considered

| Approach                              | Pros                                   | Cons                                   |
| ------------------------------------- | -------------------------------------- | -------------------------------------- |
| Separate DB per Tenant                | Strong isolation, easy tenant deletion | High operational cost, complex scaling |
| Schema-based (per tenant collections) | Moderate isolation                     | Hard to manage indexes, migrations     |
| **Row-level (chosen)**                | Best balance of cost, scalability      | Requires strict query enforcement      |

Enforcement

* JWT contains `tenantId` and `role`
* Express middleware injects `tenantId` into every query
* Compound indexes ensure tenant-level query performance


3. Data Modeling Decisions (MongoDB)

3.1 Product & Variant Modeling

Approach: Product with Embedded Variants**

```js
Product {
  _id,
  tenantId,
  name,
  category,
  variants: [
    {
      sku,
      attributes: { size, color },
      price,
      stock
    }
  ]
}
```

Why?

* Variants are tightly coupled with products
* Atomic updates on stock using positional operators
* Faster reads for product listings

Trade-off

* Variant-heavy products may grow document size (mitigated by SKU limits)


3.2 Stock Movement Ledger

All stock changes are immutable records.

```js
StockMovement {
  tenantId,
  sku,
  type: 'purchase' | 'sale' | 'return' | 'adjustment',
  quantity,
  timestamp,
  referenceId
}
```

Why?

* Full audit trail
* Supports analytics and reconciliation
* Prevents silent stock manipulation


4. Concurrency & Data Integrity

Problem: Two users ordering the last item

Solution: **MongoDB Transactions + Atomic Updates**

* Each order runs inside a transaction
* Stock deduction uses `$inc` with condition `stock >= quantity`
* If condition fails → transaction aborts

```js
updateOne(
  { sku, stock: { $gte: qty } },
  { $inc: { stock: -qty } }
)
```

Why?

* Guarantees stock never goes negative
* Handles concurrent users safely
* Works across multiple SKUs in one order


5. Orders & Fulfillment Handling

* Orders can be **Pending / Partially Fulfilled / Completed / Cancelled**
* Partial fulfillment supported when some SKUs are unavailable
* Cancelled orders trigger stock rollback via transaction


6. Suppliers & Purchase Orders

Purchase Order Lifecycle

`Draft → Sent → Confirmed → Received`

Design Highlights

* Purchase orders support partial delivery
* Price variance captured per received item
* Stock updated only on `Received` status

```js
PurchaseOrderItem {
  sku,
  orderedQty,
  receivedQty,
  unitPrice
}
```


7. Smart Low-Stock Alerts

Logic

* Alert only if:
  `availableStock + pendingPOQuantity < reorderThreshold`

Why?

* Prevents false alerts
* Reflects real-world procurement workflow


8. Performance Optimization Strategy

Techniques Used

* Compound indexes: `{ tenantId, sku }`, `{ tenantId, createdAt }`
* Pre-aggregated dashboard metrics
* MongoDB aggregation pipelines
* Pagination and projection
* Caching frequent dashboard queries

Result

* Dashboard loads < 2 seconds with 10,000+ products


9. Real-Time Updates

* Socket.io scoped by `tenantId`
* Emits events on stock change, order updates
* Prevents cross-tenant data leakage


10. Security & Access Control

* JWT-based authentication
* Role-based authorization (Owner / Manager / Staff)
* Route-level permission checks
* Tenant isolation enforced at API level


11. Scalability Considerations

* Stateless backend (horizontal scaling)
* MongoDB ready for sharding on `tenantId`
* Read-heavy operations optimized via caching
* Background jobs for alerts & analytics


12. Trade-Offs Summary

| Decision          | Benefit        | Trade-Off                  |
| ----------------- | -------------- | -------------------------- |
| Row-level tenancy | Cost-efficient | Requires strict discipline |
| Embedded variants | Fast reads     | Document growth            |
| Transactions      | Data safety    | Slight performance cost    |
| Real-time sockets | UX improvement | Infra complexity           |


13. Future Improvements

* Move analytics to read replicas
* Event-driven architecture (Kafka / RabbitMQ)
* Per-tenant rate limiting
* Full TypeScript adoption

---

Author: Debkanta Dey
