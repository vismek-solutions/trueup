const INDENT = "   ";

export const treeLines = (names: readonly string[], depth = 0): readonly string[] => {
  const pad = INDENT.repeat(depth);
  const heads = [...new Set(names.map((name) => name.split("/")[0] ?? name))];
  return heads.flatMap((head) => {
    const grouped = names.filter((name) => name === head || name.startsWith(`${head}/`));
    // a head that is itself a zone stays unsplit, so a group label never reads as a zone
    if (grouped.includes(head)) return grouped.map((name) => `${pad}* ${name}`);
    return [`${pad}* ${head}`, ...treeLines(grouped.map((name) => name.slice(head.length + 1)), depth + 1)];
  });
};
