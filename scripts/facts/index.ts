// Turns each tool's source (the npm registry, RubyGems, or the repository's own files)
// into the facts the site renders, and compares two sets of facts.
// Boundary: no file or process access here; the CLI in scripts/facts.ts does that I/O
// and passes in how to resolve a repository's default branch.
import type { ToolEntry } from "../../tools.config.ts";
import { fetchRepoFact } from "./github.ts";
import { fetchNpmManifest, toNpmFact } from "./npm.ts";
import { fetchGemPayload, toGemFact } from "./rubygems.ts";
import type { GemFact, NpmFact, RepoFact, ToolFact } from "./types.ts";

export type { GemFact, NpmFact, PackageFact, RepoFact, ToolFact } from "./types.ts";
export { licenseId, parseFrontmatter, readManifest, readmeLead, toRepoFact, type PluginManifest, type RepoFiles } from "./github.ts";
export { toNpmFact, type RegistryManifest } from "./npm.ts";
export { toGemFact, type GemPayload } from "./rubygems.ts";

export interface FactChange {
  source: string;
  slug: string;
  field: string;
  committed: string;
  fresh: string;
}

// The fields a drift check compares, per source. A repository fact leaves out `commit`:
// the default branch moves with every push, so comparing it would fail the daily check
// on commits that change nothing the site shows. The commit is kept for display only.
const COMPARED: { [S in ToolFact["source"]]: readonly (keyof Extract<ToolFact, { source: S }>)[] } = {
  npm: ["name", "version", "description", "bins", "license", "repo", "uses"] satisfies (keyof NpmFact)[],
  rubygems: ["name", "version", "description", "license", "repo", "uses"] satisfies (keyof GemFact)[],
  github: ["name", "version", "description", "license", "repo", "section", "skills", "install"] satisfies (keyof RepoFact)[],
};

export function sortFacts(facts: readonly ToolFact[]): ToolFact[] {
  return [...facts].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export function serializeFacts(facts: readonly ToolFact[]): string {
  return `${JSON.stringify(sortFacts(facts), null, 2)}\n`;
}

export function diffFacts(committed: readonly ToolFact[], fresh: readonly ToolFact[]): FactChange[] {
  const changes: FactChange[] = [];
  const before = new Map(committed.map((fact) => [fact.slug, fact]));
  const after = new Map(fresh.map((fact) => [fact.slug, fact]));
  for (const slug of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const old = before.get(slug);
    const next = after.get(slug);
    if (old === undefined || next === undefined) {
      const source = (next ?? old)?.source ?? "";
      changes.push({ source, slug, field: "(tool)", committed: old ? "present" : "missing", fresh: next ? "present" : "missing" });
      continue;
    }
    if (old.source !== next.source) {
      changes.push({ source: next.source, slug, field: "source", committed: old.source, fresh: next.source });
      continue;
    }
    const record = (fact: ToolFact) => fact as unknown as Record<string, unknown>;
    for (const field of COMPARED[next.source] as readonly string[]) {
      const a = JSON.stringify(record(old)[field]);
      const b = JSON.stringify(record(next)[field]);
      if (a !== b) changes.push({ source: next.source, slug, field, committed: a, fresh: b });
    }
  }
  return changes;
}

export function formatChanges(changes: readonly FactChange[]): string {
  const lines = changes.map((c) => `facts-drift ${c.source} ${c.slug}.${c.field}: committed ${c.committed}, fresh ${c.fresh}`);
  return [...lines, "do: npm run facts"].join("\n");
}

export interface FactSources {
  fetch: typeof fetch;
  // Resolves a repository URL to the full commit its default branch points at.
  resolveHead: (repo: string) => Promise<string>;
}

function fetchFact(entry: ToolEntry, registry: readonly ToolEntry[], io: FactSources): Promise<ToolFact> {
  switch (entry.source) {
    case "npm":
      return fetchNpmManifest(entry.npm, io.fetch).then((manifest) => toNpmFact(entry, manifest, registry));
    case "rubygems":
      return fetchGemPayload(entry.gem, io.fetch).then((payload) => toGemFact(entry, payload, registry));
    case "github":
      return io.resolveHead(entry.repo).then((commit) => fetchRepoFact(entry, commit, io.fetch));
  }
}

export async function fetchFacts(registry: readonly ToolEntry[], io: FactSources): Promise<ToolFact[]> {
  return sortFacts(await Promise.all(registry.map((entry) => fetchFact(entry, registry, io))));
}
