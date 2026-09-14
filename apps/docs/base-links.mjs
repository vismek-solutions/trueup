export function baseLinks({ base }) {
  const prefix = base.replace(/\/$/, "");

  return {
    name: "base-links",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        const href = node.properties?.href;
        if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) {
          ctx.setProperty(node, "href", prefix + href);
        }
      },
    },
  };
}
