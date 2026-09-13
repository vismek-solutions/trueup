import { execFileSync } from "node:child_process";

const PACKAGE = "@vismek-solutions/trueup";

const [tag = "latest"] = process.argv.slice(2);

const listed = execFileSync("npm", ["stage", "list", PACKAGE, "--json"], { encoding: "utf8" });
const waiting = JSON.parse(listed).filter((entry) => entry.tag === tag && entry.status === "staged");

if (waiting.length === 0) {
  process.stderr.write(`nothing is staged under ${tag}\n`);
  process.exit(1);
}

const [newest, ...older] = waiting.toSorted((left, right) =>
  right.createdAt.localeCompare(left.createdAt),
);

process.stdout.write(`npm stage approve ${newest.id}  # ${newest.version} under ${tag}\n`);

for (const entry of older) {
  process.stdout.write(`npm stage reject ${entry.id}  # ${entry.version}, superseded\n`);
}
