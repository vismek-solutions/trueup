---
title: Placement
description: Where a file belongs, judged by who uses it, and when a directory has turned into a drawer.
claims:
  - no-directory-holds-too-many-files
  - no-value-is-declared-away-from-its-only-consumer
  - no-export-exists-only-for-a-test
  - no-file-serves-two-readerships
  - no-test-reaches-an-internal
---

A zone is a name you give to a group of files, chosen by where the files sit. A boundary is a note saying which zones a zone is allowed to reach.

These checks ask a different question. Not what a file may reach, but whether the file is sitting in the right place at all.

## Colocation: code with only one customer

Say exactly one other zone uses a value. Then that value is not shared code. It is that zone's code, sitting on the wrong side of a boundary.

```ts
colocation: true,
```

Turn it on in the shop project from [getting started](/start/getting-started/) and three findings come back:

```
no-value-is-declared-away-from-its-only-consumer  3 errors
    src/api/money.ts  declares 2 exports, all used only by src/components/CartRow.tsx, so the file is in the wrong directory rather than the declarations
    src/components/CartRow.tsx  declares CartRow, used only by src/hooks/useCart.ts
    src/domain/order.ts  declares isSettled, used only by server/routes.ts
```

There are three shapes this check prints, and which one you get decides what to move. A finding that counts the exports means nothing outside that one consumer reads the file at all, its own zone included, so the file is what moves and all of them close together. A finding that names one declaration means something else still reads the file, so the file stays and only that declaration is in question.

The third shape is the one worth slowing down for. Both lines below name a reader that stays behind:

```
no-value-is-declared-away-from-its-only-consumer  2 errors
    src/domain/order.ts  declares isSettled, used outside its zone only by server/routes.ts, and inside its zone as well
    src/domain/receipt.ts  declares lineFor, used only by server/routes.ts, and by this file as well
```

Moving isSettled into the server would leave its neighbour in the domain zone reaching across a boundary, which is a second finding rather than a fix. Check what the declaring zone is allowed to reach before moving anything. Often the better answer is to dissolve the value into its one outside consumer, and then there is nothing left to place.

The reader that stays behind for lineFor is closer to home still. Another declaration in the same file uses it, so moving it alone means the file it leaves has to import it straight back. Move that declaration along with it, or leave both where they are.

The two clauses are independent, and a declaration read by a neighbour in its file and by another file in its zone carries both. Read that pair closely, because the neighbour is often how the zone reads it. Moving the two together does not help then, since the zone is left reaching across the boundary for the neighbour instead.

That saves you the reading. Working out which case you are in by opening the file is the step that goes wrong most often, and the check already knows the answer.

The words about its own zone are doing real work. A file can have every reported export pointing one way and still be read by a neighbour in the same zone, through an export that was never reported because a reader inside the zone is not a finding. Moving that file would leave the neighbour reaching across a boundary, so the check does not ask you to.

Take the last one. isSettled sits in the domain zone, where shared business rules go, and the server is the only thing that ever asks for it. Move it into the server. A second customer arriving later is a reason to move it back then, and not a reason to have guessed now.

### Two things the check does not count

A zone with a role is never counted as the only customer. Composition roots and test suites use other zones' code without ever being where that code belongs. A root wires each collaborator exactly once. A test imports whatever it exercises. Left in, they bury the real findings.

```ts
{ name: "spec", patterns: ["**/*.test.ts", "**/*.fixture.ts"], role: "tests" },
{ name: "app",  patterns: ["src/**"], role: "wiring" },
```

Those two lines are what keeps the badge component and the cart hook off the list above. src/main.ts imports each of them exactly once, and wiring is all it does.

A type's own readers are left out as well. A type can be used constantly without ever being imported, because reading a field off a value uses that field's type and names nothing:

```ts
record.exports[0].form
```

Counting imports tells the truth about values and lies about types, so counting a type's readers would name one customer where there are several.

A type import does count in the other direction, as a reader of the value the type is built from:

```ts
export const currencySchema = z.enum(["eur", "usd"]);

export type Currency = z.infer<typeof currencySchema>;
```

The server parses its input with currencySchema, and the web only ever names Currency. Counting that type import is what keeps the check from calling the server the schema's only customer and asking you to move a file the web depends on. Currency cannot be declared anywhere currencySchema is not, so the web pins the schema where it sits.

This is worth a moment, because it looks like the same evidence being trusted in one place and not the other. What makes a type edge unsafe is that it undercounts, and a count that is too low is what produces a wrong finding here. Evidence that adds a reader can only ever silence one.

A reader counted that way never writes the name, so the number can look wrong to anyone who searches for it. When the count holds one, the finding lists what each reader imports:

```
no-value-is-declared-away-from-its-only-consumer  2 errors
    src/domain/money.ts  declares currencySchema, used only by server (2 files), and by this file as well:
        - currencySchema in src/server/routes.ts
        - Currency in src/server/checkout.ts
```

Two files read currencySchema and only one writes that name. The other holds Currency, which is built from it. Where every reader imports the value by its own name the list is left off, because the count can already be checked as it stands.

Measured on a 911-file monorepo: 758 findings with neither exclusion, 47 with both. Ten of the 47 were values in a shared package that only one app used, which is the case that counting files per symbol misses entirely.

### When no move closes it

A role keeps a reader out of the count, and that changes what you can do about the finding. The check says so when it sees one:

```
no-value-is-declared-away-from-its-only-consumer  1 error
    src/domain/vetting.ts  declares judgeVet, used only by server/routes.ts, while app reads it too but is wiring, so it does not count
```

Two zones read judgeVet. The server is one, the app root is the other, and the app root wears the wiring role so it never counts. That leaves the server as the only counted reader wherever the file sits, so moving judgeVet elsewhere in the same package closes nothing.

Either the value belongs to the consumer named, or the role is wrong for what that reader does. The second is worth checking first. A composition root that owns a loop of its own is doing more than wiring, and the loop is what should move. Give it a home in a zone that counts and it becomes a second reader, with the value staying where it is.

Dropping the role instead closes findings like this one and opens far more, because a root reads nearly everything. The role is usually right, and the logic sitting behind it is what is in the wrong place.

Giving the value a zone of its own, or a package sitting under the ones that read it, closes nothing by itself. The count asks who reads the value, not where it sits. The zone that does close it is one for the silenced reader's own logic, which is the same move as above seen from the other end.

Reach for the shared home anyway when the consumer named must not own the value, a test harness or a downstream app for instance. The finding stands after that move, and standing is the right answer: [accept it into the baseline](/agents/baseline/) rather than working it a second time.

### A layer that serves one layer

Some projects split by kind rather than by feature. Components sit in one folder, routes in another, and every component is there so that a route can use it. Counting zones then says each component has a single customer, which is true and useless:

```
no-value-is-declared-away-from-its-only-consumer  6 errors
    src/components/badge.ts  declares renderBadge, used only by src/routes/home/page.ts
    src/components/button.ts  declares renderButton, used only by routes (2 files)
    src/components/chip.ts  declares renderChip, used only by routes (2 files)
    src/components/layout.ts  declares renderLayout, used only by routes (3 files)
    src/components/pair.ts  declares 2 exports, all used only by routes (2 files), so the file is in the wrong directory rather than the declarations
    src/components/user-card.ts  declares renderUserCard, used only by routes (2 files)
```

No role fits here. The routes zone owns real code, so calling it wiring or tests would be untrue, and it would stop that zone counting as a customer of everything else as well.

The zone that declares them says it instead:

```ts
{ name: "components", patterns: ["src/components/**"], shared: true },
```

That does not switch the check off for the zone. It moves the count down one level, from zones of the consumer to parts of the consumer, and a part is whatever the rest of the rulebook already makes one. Where [sibling isolation](/checks/isolation/) keeps each route directory apart, a route is a part:

```ts
isolate: [{ siblings: "src/routes/*" }],
```

```
no-value-is-declared-away-from-its-only-consumer  3 errors
    src/components/badge.ts  declares renderBadge, used only by src/routes/home/page.ts
    src/components/pair.ts  declares 2 exports, all used only by src/routes/users (2 files), so the file is in the wrong directory rather than the declarations
    src/components/user-card.ts  declares renderUserCard, used only by src/routes/users (2 files)
```

The components that more than one part reads have dropped off, and what stands is worth reading. renderUserCard is read twice and never leaves the users route, so it belongs inside it. Both exports of the pair file go the same way, so the file moves rather than its declarations.

renderChip dropped off for a different reason. Its two readers sit directly in the routes folder rather than in any route, so no rule groups them and each counts as a part of its own.

When nothing groups the readers, the floor is the file. The same project without the isolation rule counts each reading file as a part:

```
no-value-is-declared-away-from-its-only-consumer  3 errors
    src/components/badge.ts  declares renderBadge, used only by src/routes/home/page.ts
    src/components/pair.ts  declares renderPairFoot, used only by src/routes/users/detail/row.ts
    src/components/pair.ts  declares renderPairHead, used only by src/routes/users/list/page.ts
```

The pair file is what changed. Its two exports are read by two different files, so no single move holds them both, and each declaration is named on its own.

Say this about a layer written to serve the layer above it. A package that several products share is a different thing, and declaring that one shared hides the finding you most want from it: one product's code sitting in the shared package.

### Exports that exist only for a test

This second check needs two things: the colocation switch above, and at least one zone carrying the tests role. Once the tool knows which files are tests, it can turn the question around.

Something that only the tests import is not shared code with one customer. It is private code that was made public so a test could reach in.

```
no-export-exists-only-for-a-test          3 errors
    src/case/anchor.ts   exports EPOCH_START, which only tests use
    src/case/prompt.ts   exports CAST_RULES, which only tests use
    src/access/gate.ts   exports resourceAccess, which only tests use
```

The fix is to test the behaviour through the surface that production code actually calls.

A helper that genuinely exists to serve tests belongs in the tests zone. On that same monorepo, putting the fixture files in that zone removed a quarter of this check's findings. Fixtures are test code, and zoning them as such is the honest fix, rather than an exception inside the rule.

An export is left alone where production reaches the whole module it sits in rather than a name inside it, which is what a lazy import does. Nothing in that reach says which export is taken, so the tests cannot be called the only ones taking it.

:::caution
One fix here we would ask you to avoid: adding a caller in production code so the export has a real consumer. That satisfies the check and leaves the codebase worse than the finding did. The guidance printed with the finding says so too.
:::

## One file answering to two audiences

Some files are two files wearing one name. Every export has plenty of readers, and still no reader ever wants both halves.

```ts
readerships: true,
```

Off by default, and a separate switch again. It sorts a file's exports by who reads them, and reports the file when more than one group is left standing.

```
no-file-serves-two-readerships              1 error
    src/shared/format.ts  serves 2 readerships that never meet, and only renderBadge can leave without taking anything else with it:
        - parseAmount from src/billing
        - renderBadge from src/inbox
```

The clause after the count is the direction, and it appears when exactly one group reaches nothing else in the file. That group is the one that lifts out on its own. Here parseAmount goes through a private rate table while renderBadge goes through nothing, so renderBadge is the half that leaves and the table stays where it is.

When no group is named, either every group reaches something private the file holds, or none of them does and either half may go first.

This is the companion to colocation, and it asks something colocation cannot. Colocation works one symbol at a time and fires when a symbol has a single customer. A file whose every export is widely used passes that check and is still two files. Split it, and each half goes to live with its own readers.

When a group turns out to have one member, a new file is usually not the answer. A value that one caller works out from what it already holds belongs inside that caller, and dissolving it leaves nothing to place. Reaching for a new home first is the common mistake.

### What keeps two exports together

Two exports stay in one group when they share a reader. They also stay together when one of them names the other in the same file. A type built from the type beside it cannot be moved away from it, so counting the two apart would report every carved out type as a split. The same holds for a value built from a sibling.

Two exports that merely reach the same private third thing do not join. Sharing a helper is not the same as being one thing, and promoting that helper is exactly the cost the split would carry.

### The shape it reports most often

A module holding one private object that every export goes through: a context, a client, a connection, a table. Each export is built from that object, so each is joined to it. None of them is joined to any other, because the object is private, and a private declaration is not one of the groups being sorted.

Files like that are reported whenever their exports serve separate audiences, which is often. What the check sees is true, because the audiences really do differ. For this shape it names no direction, because every export reaches that private object and any cut would have to promote it.

So the question here is about the private object rather than about the exports. If it is a real module, something you would be content to name and let another file import, promote it on purpose and let each audience become a file that reads it. If it is not, these exports are one unit and this is a finding to accept rather than act on.

### What is left out of the count

Readers in a zone with a role do not count, for the reverse of the reason they are not counted as a lone customer. A composition root wires both halves, so counting it would join every group it touches and hide the split. A file in a zone with a role is not reported either, because a barrel answers to readers this analysis cannot see. An export nothing reads at all is left out rather than forming a group of its own.

Readers are grouped by directory. Grouping by zone would be too coarse to see a split inside one zone, and grouping by file too loud, because two exports imported by two different files describes most files rather than a defect.

A reader is a file that imports the export, not a file that could arrive at it by importing something else. Following the chain further would make the check quieter rather than stricter, because each step widens the set of things a file counts as reading, and wider sets overlap into one group.

## Tests that reach an internal

```ts
testInternals: true,
```

This is a separate switch from colocation, and it is off by default. It reports a test importing a symbol that nothing outside that symbol's own directory calls.

```
no-test-reaches-an-internal                 1 error
    test/checkout.test.ts  reaches priceWithTax, an internal of src/checkout/tax.ts that only src/checkout/total.ts calls
```

priceWithTax exists because orderTotal needed it. Fold it back into total.ts and nothing about the checkout behaves any differently. The test, though, breaks. That is what it means for a test to be pinned to a decomposition rather than to behaviour. An agent is a coding assistant that writes code in your project, and one that refactors the checkout later reads the red suite as a regression.

The fix is to drive the same cases through orderTotal, which is what production calls. When that is genuinely too expensive, the symbol is asking to become a module with a caller of its own, rather than a wider surface on the one it sits in.

Nothing is reported for orderTotal or toCents in that run. Both have a consumer in src/web, so their surface already reaches past the directory, and a test is welcome there too.

Three kinds of symbol are never reported. One that a zone with the wiring role declares, because a composition root has no internals to protect. One that a zone with the api role re-exports, which is surface wherever it happens to be declared. A re-export leaves no import edge behind, so that one is read from the api zone's exports rather than from its imports. And one that no test reaches at all, which is nobody's business but its own.

This check is the mirror of the test-only export above. That one asks whether production uses a symbol. This one asks whether production uses it from far enough away to call it a surface.

:::caution
Two moves here look like fixes and are not. Widening the surface so the direct test becomes legitimate, and adding a production caller to justify it, both leave the codebase worse than the finding did.
:::

With no zone carrying the tests role, the check warns rather than passing. There is nothing to hold to a surface, and silence would read as a pass.

## Directory size

```ts
maxFilesPerDirectory: 12
```

A directory that keeps growing has stopped being one idea. An agent adding the twenty-first file to a folder has no way to notice that from inside the file it is writing.

```
no-directory-holds-too-many-files           2 errors
    src/adapters  holds 12 files, more than the 8 allowed
    src/claims  holds 11 files, more than the 8 allowed
    ────────
    A directory holds more files than the limit, which is how a folder stops being one idea and
    turns into a drawer.

    Do this:
    - Group the related files into a subdirectory that names what they share.
    - Move out the ones that never belonged here.

    Not the fix: raising the limit. The number exists to force the question of what this directory
    is for.
```

The count includes every file the analysis read, unclassified ones included. A directory nothing has claimed is the likeliest dumping ground.

There is no exemption list. A limit with exceptions is a limit nobody has to meet, so the number is the only lever here.

### Picking the number

There is no default, and the right value depends on how you group files. A repository that gives each unit its own directory sits comfortably around 12. A flat components folder with one file per component will not: 40 files in there is ordinary, and the check is reporting a shape you may already be happy with.

If that is your shape, you have two honest answers. Set the number where it catches genuine drawers for you, at 30 or at 50, so it still fires when a folder doubles. Or group the folder into subdirectories by feature, which is what the check is nudging you toward, and keep a low number.

Please do not add an exception for the one directory that failed. The number is the whole point of the check, and an exception list quietly turns it off. Start with a limit high enough that the first run shows you a handful of real cases instead of a wall of them. Then lower it as you fix them.

Line and function length are a linter's job, not this one's. [Delegate them](/integrations/linters/).
