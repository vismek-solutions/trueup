// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [
    starlight({
      title: "trueline",
      description:
        "Keeps a TypeScript codebase in the shape you meant it to have, and stops a coding agent from quietly changing it.",
      customCss: ["./src/styles/custom.css"],
      lastUpdated: true,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What this is", link: "/" },
            { label: "Getting started", link: "/start/getting-started/" },
            { label: "Reading a report", link: "/start/reports/" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Zones", link: "/concepts/zones/" },
            { label: "Boundaries", link: "/concepts/boundaries/" },
            { label: "Monorepos", link: "/concepts/monorepos/" },
          ],
        },
        {
          label: "Checks",
          items: [
            { label: "The full list", link: "/checks/" },
            { label: "Sibling directories", link: "/checks/isolation/" },
            { label: "Seams", link: "/checks/seams/" },
            { label: "Placement", link: "/checks/placement/" },
            { label: "Written twice", link: "/checks/duplication/" },
            { label: "Rules you write", link: "/checks/custom-rules/" },
          ],
        },
        {
          label: "Working with an agent",
          items: [
            { label: "Blocking a bad edit", link: "/agents/guard/" },
            { label: "Teaching it up front", link: "/agents/instructions/" },
            { label: "Adopting on real code", link: "/agents/baseline/" },
          ],
        },
        {
          label: "Alongside other tools",
          items: [
            { label: "Your existing linter", link: "/integrations/linters/" },
            { label: "Compared to fallow", link: "/integrations/fallow/" },
          ],
        },
        {
          label: "Reference",
          items: [{ label: "Configuration", link: "/reference/config/" }],
        },
      ],
    }),
  ],
});
