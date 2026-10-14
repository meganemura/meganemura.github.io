// Turns npm registry metadata into the facts the site renders.
// Boundary: no file or process access here; the CLI in scripts/facts.ts does the I/O.
import type { ToolEntry } from "../../tools.config.ts";

export interface ToolFact {
  slug: string;
  name: string;
  version: string;
  description: string;
  bins: string[];
  license: string | null;
  repo: string;
  uses: string[];
}

export interface RegistryManifest {
  name: string;
  version: string;
  description?: string;
  bin?: string | Record<string, string>;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface FactChange {
  slug: string;
  field: string;
  committed: string;
  fresh: string;
}

const FIELDS = ["name", "version", "description", "bins", "license", "repo", "uses"] as const;

// A string `bin` means the command carries the package name without its scope.
function binNames(manifest: RegistryManifest): string[] {
  const { bin } = manifest;
  if (bin === undefined) return [];
  if (typeof bin === "string") return [manifest.name.replace(/^@[^/]+\//, "")];
  return Object.keys(bin).sort();
}

export function toFact(entry: ToolEntry, manifest: RegistryManifest, registry: readonly ToolEntry[]): ToolFact {
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const uses = registry
    .filter((other) => other.slug !== entry.slug && other.npm in dependencies)
    .map((other) => other.slug)
    .sort();
  return {
    slug: entry.slug,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description ?? "",
    bins: binNames(manifest),
    license: manifest.license ?? null,
    repo: entry.repo,
    uses,
  };
}

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
      changes.push({ slug, field: "(tool)", committed: old ? "present" : "missing", fresh: next ? "present" : "missing" });
      continue;
    }
    for (const field of FIELDS) {
      const a = JSON.stringify(old[field]);
      const b = JSON.stringify(next[field]);
      if (a !== b) changes.push({ slug, field, committed: a, fresh: b });
    }
  }
  return changes;
}

export function formatChanges(changes: readonly FactChange[]): string {
  const lines = changes.map((c) => `facts-drift ${c.slug}.${c.field}: committed ${c.committed}, registry ${c.fresh}`);
  return [...lines, "do: npm run facts"].join("\n");
}

export async function fetchManifest(name: string, fetchFn: typeof fetch = fetch): Promise<RegistryManifest> {
  const response = await fetchFn(`https://registry.npmjs.org/${name}/latest`);
  if (!response.ok) throw new Error(`registry returned ${response.status} for ${name}`);
  return (await response.json()) as RegistryManifest;
}

export async function fetchFacts(registry: readonly ToolEntry[], fetchFn: typeof fetch = fetch): Promise<ToolFact[]> {
  const manifests = await Promise.all(registry.map((entry) => fetchManifest(entry.npm, fetchFn)));
  return sortFacts(registry.map((entry, i) => toFact(entry, manifests[i] as RegistryManifest, registry)));
}
