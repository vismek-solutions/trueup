---
title: Seams
description: Domain knowledge that leaks with no import to explain it.
---

A boundary catches a bad import. Domain knowledge also leaks with no import at all, and a boundary cannot see that.

Here the domain owns a set of order states:

```ts
// src/domain/order.ts
export type OrderStatus = "awaiting_payment" | "shipped" | "refunded";
```

And a component decides what an unpaid order looks like, importing nothing:

```tsx
// src/components/StatusBadge.tsx
export const StatusBadge = ({ status }: { status: string }): string =>
  status === "awaiting_payment" ? "amber" : "grey";
```

Nothing links the two files. The day `awaiting_payment` is renamed, this compiles and is wrong.

```ts
seams: [{ generic: "components", domain: ["domain"] }]
```

```
generic-code-names-no-domain-concept        1 error
    src/components/StatusBadge.tsx:2:14  is components and names the value "awaiting_payment", which domain owns
```

## Where the vocabulary comes from

You do not list the words. A domain zone owns the names its files export and the string values its sources contain, and the rule is derived from that every run — so a new type is covered from the moment it exists, and a deleted one stops being covered.

`explain` prints what a file may not name:

```
src/components/StatusBadge.tsx

zone        components
may reach   components · hooks · api
may not     spec · domain · app · server

vocabulary  domain owns names this file may not use:
            Order · OrderStatus · isSettled
            and values it may not repeat:
            awaiting_payment · refunded · shipped
```

## Fixing one

The fix is not to rename the local `status` variable. That hides the leak and leaves the two files just as coupled.

`StatusBadge` should take `tone: "warning" | "neutral"`, and the domain side of the call should decide which. The component then knows about badges, and the domain keeps its states — which is what the two zones were split up for.

## When to turn it on

Turn it on when you have a layer meant to be reusable — an engine, a renderer, a design system — and a domain it is meant not to know. If every zone in the project is domain code, there is no seam to guard.

Tune it with `allow` for words the two genuinely share, and `minLiteralLength` for short incidental strings.

```ts
seams: [{ generic: "components", domain: ["domain"], allow: ["status"], minLiteralLength: 5 }]
```
