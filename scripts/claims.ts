// CLI for claim checks: finds <Claim>/<Demo> in the docs, runs each distinct
// command once, and writes src/generated/claims.json. Exit 1 on any mismatch.
import { spawnSync } from "node:child_process";
import { existsSync, globSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { delimiter, relative, resolve, sep } from "node:path";
import { tools } from "../tools.config.ts";
import { formatBroken, normalizeOutput, ScanError, scanSource, verifyAll, type ClaimSite, type ClaimSpec, type Outcome } from "./claims/index.ts";

const root = resolve(import.meta.dirname, "..");
const TIMEOUT_MS = 60_000;

function versionOf(tool: string): string {
  const entry = tools.find((candidate) => candidate.slug === tool);
  if (!entry) throw new ScanError(`unknown tool "${tool}": add it to tools.config.ts`);
  const manifest = resolve(root, "node_modules", entry.npm, "package.json");
  if (!existsSync(manifest)) throw new ScanError(`${tool} is not installed: ${entry.npm} is missing from node_modules`);
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string }).version;
}

function run(spec: ClaimSpec): Outcome {
  const cwd = resolve(root, spec.cwd);
  const inside = relative(root, cwd);
  if (inside.startsWith("..") || inside.startsWith(sep) || !existsSync(cwd)) {
    throw new ScanError(`cwd "${spec.cwd}" must be an existing directory inside the repository`);
  }
  const result = spawnSync("sh", ["-c", spec.run], {
    cwd,
    encoding: "utf8",
    timeout: TIMEOUT_MS,
    env: { ...process.env, PATH: `${resolve(root, "node_modules/.bin")}${delimiter}${process.env.PATH ?? ""}`, NO_COLOR: "1" },
  });
  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return {
    exit: result.status,
    stdout: normalizeOutput(raw, [root, realpathSync(root)]),
    timedOut: result.error !== undefined && "code" in result.error && result.error.code === "ETIMEDOUT",
  };
}

try {
  const files = globSync("src/content/docs/**/*.mdx", { cwd: root }).sort();
  const sites: ClaimSite[] = files.flatMap((file) => scanSource(file, readFileSync(resolve(root, file), "utf8")));
  const { records, broken } = verifyAll(sites, run, versionOf);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ok: broken.length === 0, claims: Object.keys(records).length, broken }));
  } else if (broken.length > 0) console.error(formatBroken(broken));
  else console.log(`claims ok: ${Object.keys(records).length} distinct commands across ${sites.length} claims and demos`);

  if (broken.length > 0) process.exit(1);
  const sorted = Object.fromEntries(Object.entries(records).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(resolve(root, "src/generated/claims.json"), `${JSON.stringify(sorted, null, 2)}\n`);
} catch (error) {
  if (!(error instanceof ScanError)) throw error;
  console.error(`claim-invalid ${error.message}\n  do: use only string, number, or array-of-string literals, and a registered tool`);
  process.exit(1);
}
