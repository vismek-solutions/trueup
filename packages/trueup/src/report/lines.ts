export interface MessageLines {
  readonly message: string;
  readonly head: string;
  readonly indent: string;
}

export const messageLines = ({ message, head, indent }: MessageLines): string[] => {
  const [first = "", ...rest] = message.split("\n");

  return [`${head}${first}`, ...rest.map((line) => `${indent}${line}`)];
};

const flowed = (line: string, width: number): string[] => {
  const hang = line.startsWith("- ") ? "  " : "";
  const lines: string[] = [];

  for (const word of line.split(" ")) {
    const last = lines[lines.length - 1];
    if (last === undefined) lines.push(word);
    else if (`${last} ${word}`.length > width) lines.push(`${hang}${word}`);
    else lines[lines.length - 1] = `${last} ${word}`;
  }

  return lines;
};

export const wrapped = (text: string, width: number): string[] =>
  text.split("\n").flatMap((line) => (line === "" ? [""] : flowed(line, width)));
