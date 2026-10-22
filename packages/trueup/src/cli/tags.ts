export type Attributes = Readonly<Record<string, string>>;

const opening = (name: string, attributes: Attributes): string =>
  `<${name}${Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join("")}>`;

export const tagged = (name: string, body: string | readonly string[], attributes: Attributes = {}): readonly string[] =>
  typeof body === "string"
    ? [`${opening(name, attributes)}${body}</${name}>`]
    : [opening(name, attributes), ...body, `</${name}>`];

export const items = (values: readonly string[]): readonly string[] =>
  values.length === 0 ? ["none"] : values.map((value) => `* ${value}`);

export const spoken = (values: readonly string[]): string =>
  values.length < 2 ? values.join("") : `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;

export const listed = (name: string, values: readonly string[], attributes: Attributes = {}): readonly string[] =>
  tagged(name, values.length === 0 ? "none" : items(values), attributes);
