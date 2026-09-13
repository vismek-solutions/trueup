import { execFileSync } from "node:child_process";

const PACKAGE = "@vismek-solutions/trueup";

const [tag = "latest", ...rest] = process.argv.slice(2);

const listed = execFileSync("npm", ["stage", "list", PACKAGE, "--json"], { encoding: "utf8" });
const waiting = JSON.parse(listed).filter((entry) => entry.tag === tag && entry.status === "staged");

if (waiting.length === 0) {
  console.error(`nothing is staged under ${tag}`);
  process.exit(1);
}

if (waiting.length > 1) {
  console.error(`${waiting.length} builds are staged under ${tag}, so approve one by id:`);
  for (const entry of waiting) console.error(`  npm stage approve ${entry.id}  ${entry.version}`);
  process.exit(1);
}

const [only] = waiting;
console.log(`approving ${only.version} under ${tag}, staged by ${only.actor}`);
execFileSync("npm", ["stage", "approve", only.id, ...rest], { stdio: "inherit" });
