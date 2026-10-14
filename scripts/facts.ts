// CLI for the facts: `facts` writes src/generated/tools.json from npm, RubyGems, and the
// plugin and skill repositories; `facts --check` fails when the committed file differs.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { tools } from "../tools.config.ts";
import { diffFacts, fetchFacts, formatChanges, serializeFacts, type ToolFact } from "./facts/index.ts";

const run = promisify(execFile);

async function resolveHead(repo: string): Promise<string> {
  const { stdout } = await run("git", ["ls-remote", repo, "HEAD"]);
  const commit = stdout.split(/\s/)[0] ?? "";
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`git ls-remote ${repo} HEAD printed no commit`);
  return commit;
}

const target = new URL("../src/generated/tools.json", import.meta.url);
const fresh = await fetchFacts(tools, { fetch, resolveHead });

if (process.argv.includes("--check")) {
  const committed = JSON.parse(readFileSync(target, "utf8")) as ToolFact[];
  const changes = diffFacts(committed, fresh);
  if (changes.length > 0) {
    console.error(formatChanges(changes));
    process.exit(1);
  }
  console.log(`facts ok: ${fresh.length} tools match npm, RubyGems, and GitHub`);
} else {
  writeFileSync(target, serializeFacts(fresh));
  console.log(`wrote src/generated/tools.json (${fresh.length} tools)`);
}
