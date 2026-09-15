// @ts-check
import { satteri } from "@astrojs/markdown-satteri";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { baseLinks } from "./base-links.mjs";

const base = "/trueup";

export default defineConfig({
  site: "https://vismek-solutions.github.io",
  base,
  markdown: { processor: satteri({ hastPlugins: [baseLinks({ base })] }) },
  integrations: [
    starlight({
      title: "trueup",
      description:
        "Keeps a TypeScript codebase in the shape you meant it to have, and stops a coding agent from quietly changing it.",
      customCss: ["./src/styles/custom.css"],
      lastUpdated: true,
      social: [
        {
          icon: "github",
          label: "Source on GitHub",
          href: "https://github.com/vismek-solutions/trueup",
        },
        {
          icon: "npm",
          label: "Package on npm",
          href: "https://www.npmjs.com/package/@vismek-solutions/trueup",
        },
      ],
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
            { label: "Where files belong", link: "/checks/placement/" },
            { label: "The same thing twice", link: "/checks/duplication/" },
            { label: "Rules you write", link: "/checks/custom-rules/" },
          ],
        },
        {
          label: "Working with an agent",
          items: [
            { label: "Blocking a bad edit", link: "/agents/guard/" },
            { label: "Teaching the agent", link: "/agents/instructions/" },
            { label: "Starting on existing code", link: "/agents/baseline/" },
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
