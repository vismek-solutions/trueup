---
title: Seams
description: Domain knowledge that leaks into reusable code with no import to show it.
---

Some of your code is meant to be reused anywhere. Other code knows your business. The line between the two is a seam.

A bad import across a seam is caught by a boundary, which is a note saying which groups of files may reach which others. Domain knowledge has another way across, and that one leaves no import behind.

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

This is the part people find surprising, so here it is slowly. Nothing links these two files. There is no import between them and no shared type, so a boundary has nothing to object to. The day awaiting_payment is renamed, the badge still compiles and it is wrong.

A seam rule is what catches it. You name the group of files that is meant to be generic, and the groups whose words it may not borrow. Those groups are zones, and a zone is a name you give to a group of files, chosen by where the files sit.

```ts
seams: [{ generic: "components", domain: ["domain"] }]
```

Now the run says so:

```
generic-code-names-no-domain-concept        1 error
    src/components/StatusBadge.tsx:2:14  is components and names the value "awaiting_payment", which domain owns
```

## Where the vocabulary comes from

You never list the words yourself. A domain zone owns two things: the names its files export, and the string values its sources contain. The rule is worked out from those on every run, so a new type is covered from the moment it exists, and a deleted one stops being covered.

The explain command prints what a file may not name:

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

There is a tempting shortcut here that we would ask you to avoid. Renaming the local status variable hides the leak, and the two files stay exactly as coupled as they were.

Have the badge component take a tone instead, warning or neutral, and let the domain side of the call decide which one to pass. The component then knows about badges and the domain keeps its states, which is what splitting the two zones was for.

## When to turn it on

Turn it on when you have a layer meant to be reusable, such as an engine, a renderer or a design system, and a domain it is meant not to know about. If every zone in your project is domain code, there is no seam to guard.

Two settings tune it. Use allow for words the two sides genuinely share, and minLiteralLength for short strings that match by accident.

```ts
seams: [{ generic: "components", domain: ["domain"], allow: ["status"], minLiteralLength: 5 }]
```
