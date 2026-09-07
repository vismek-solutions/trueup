---
title: Seams
description: Domain knowledge that leaks with no import to explain it.
---

A boundary catches a bad import. It cannot catch the other way domain knowledge leaks.

A value arrives as a function argument or a prop. The receiving file mirrors a shape it should not know about, and imports nothing at all.

```ts
seams: [{ generic: "engine", domain: ["domain"] }]
```

The vocabulary is derived rather than configured. A domain zone owns the names its files export, and the string values its sources contain.

Generic code that mentions one of those, with no import to explain why, is naming something it has no business naming. A new domain type is covered from the moment it exists. There is no list to keep in sync.

On a real app this found a component hardcoding `"stav"` where the domain exports `REQUISITION_STATUS = "stav"`, plus several hardcoding members of enums the domain declares.

Tune it with `allow` for words the two genuinely share, and `minLiteralLength` for short incidental strings.

```ts
seams: [{ generic: "engine", domain: ["domain"], allow: ["status"], minLiteralLength: 5 }]
```

## Why a derived vocabulary

A hand-written list of forbidden words is stale the day someone adds a type. Deriving it from the zone means the rule covers whatever the domain currently owns, and stops covering whatever it gave up.

This is also the only claim that reads identifiers rather than import edges. A run with no seam rule and no custom rule never builds a syntax tree at all.

## Fixing one

The finding names a term and the file that used it. The fix is almost never to rename the local variable — that hides the leak rather than closing it.

What the generic layer needs is a wider seam: ask the collaborator for the value instead of deriving it. If `engine` is branching on a domain status, the branch belongs on the other side of the call, and `engine` should receive the decision already made.
