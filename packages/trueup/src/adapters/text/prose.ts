import { parseSync } from "oxc-parser";
import type { JoinedProse, ReadProse } from "../../ports/module-record.ts";
import type { Span } from "../../ports/span.ts";

type Node = Record<string, unknown>;
type Hole = readonly [number, number];

const POSITIONS = new Set(["type", "start", "end"]);

const walk = (node: unknown, visit: (found: Node) => void): void => {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const one of node) walk(one, visit);
    return;
  }

  const current = node as Node;
  visit(current);
  for (const [key, value] of Object.entries(current)) {
    if (!POSITIONS.has(key)) walk(value, visit);
  }
};

const blanked = (source: string, from: number, holes: readonly Hole[]): string => {
  const marked = source.split("");
  for (const [start, end] of holes) {
    for (let at = start - from; at < end - from; at += 1) {
      if (at >= 0 && at < marked.length) marked[at] = " ";
    }
  }

  return marked.join("");
};

const bounds = (node: Node): Hole | null => {
  const { start, end } = node;
  return typeof start === "number" && typeof end === "number" ? [start, end] : null;
};

const quoted = (node: Node, text: string): Span | null => {
  const at = bounds(node);
  if (at === null || typeof node.value !== "string") return null;

  const [start, end] = at;
  const holes: Hole[] = [
    [start, start + 1],
    [end - 1, end],
  ];

  return { text: blanked(text.slice(start, end), start, holes), start, end };
};

const templated = (node: Node, text: string): Span | null => {
  const at = bounds(node);
  if (at === null) return null;

  const [start, end] = at;
  const holes: Hole[] = [
    [start, start + 1],
    [end - 1, end],
  ];
  for (const one of (node.expressions ?? []) as Node[]) {
    const held = bounds(one);
    if (held !== null) holes.push([held[0] - 2, held[1] + 1]);
  }

  return { text: blanked(text.slice(start, end), start, holes), start, end };
};

const joinedArrayOf = (node: Node, text: string): JoinedProse | null => {
  const callee = node.callee as Node | undefined;
  if (callee?.type !== "MemberExpression") return null;

  const array = callee.object as Node | undefined;
  const property = callee.property as Node | undefined;
  if (array?.type !== "ArrayExpression" || property?.name !== "join") return null;

  const parts = ((array.elements ?? []) as Node[])
    .map((element) => (element?.type === "Literal" ? quoted(element, text) : null))
    .filter((part): part is Span => part !== null);

  return parts.length === 0 || typeof array.start !== "number" ? null : { parts, start: array.start };
};

const spanOf = (node: Node, text: string): Span | null => {
  if (node.type === "Literal") return quoted(node, text);
  return node.type === "TemplateLiteral" ? templated(node, text) : null;
};

export const readProse: ReadProse = (path, text) => {
  const strings: Span[] = [];
  const joined: JoinedProse[] = [];

  walk(parseSync(path, text).program, (node) => {
    const group = node.type === "CallExpression" ? joinedArrayOf(node, text) : null;
    if (group !== null) joined.push(group);

    const span = spanOf(node, text);
    if (span !== null) strings.push(span);
  });

  const assembled = new Set(joined.flatMap((group) => group.parts.map((part) => part.start)));
  return { strings: strings.filter((span) => !assembled.has(span.start)), joined };
};
