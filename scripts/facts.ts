// CLI for the npm-derived facts: `facts` writes src/generated/tools.json,
// `facts --check` fails when the committed file differs from the registry.
import { readFileSync, writeFileSync } from "node:fs";
import { tools } from "../tools.config.ts";
import { diffFacts, fetchFacts, formatChanges, serializeFacts, type ToolFact } from "./facts/index.ts";

const target = new URL("../src/generated/tools.json", import.meta.url);
const fresh = await fetchFacts(tools);

if (process.argv.includes("--check")) {
  const committed = JSON.parse(readFileSync(target, "utf8")) as ToolFact[];
  const changes = diffFacts(committed, fresh);
  if (changes.length > 0) {
    console.error(formatChanges(changes));
    process.exit(1);
  }
  console.log(`facts ok: ${fresh.length} tools match the npm registry`);
} else {
  writeFileSync(target, serializeFacts(fresh));
  console.log(`wrote src/generated/tools.json (${fresh.length} tools)`);
}
