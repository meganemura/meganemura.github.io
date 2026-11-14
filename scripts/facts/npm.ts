// Turns an npm registry manifest into an NpmFact.
import type { NpmEntry, ToolEntry } from "../../tools.config.ts";
import type { NpmFact } from "./types.ts";

export interface RegistryManifest {
  name: string;
  version: string;
  description?: string;
  bin?: string | Record<string, string>;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// A string `bin` means the command carries the package name without its scope.
function binNames(manifest: RegistryManifest): string[] {
  const { bin } = manifest;
  if (bin === undefined) return [];
  if (typeof bin === "string") return [manifest.name.replace(/^@[^/]+\//, "")];
  return Object.keys(bin).sort();
}

export function toNpmFact(entry: NpmEntry, manifest: RegistryManifest, registry: readonly ToolEntry[]): NpmFact {
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
  const uses = registry
    .filter((other) => other.source === "npm" && other.slug !== entry.slug && other.npm in dependencies)
    .map((other) => other.slug)
    .sort();
  return {
    source: "npm",
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

export async function fetchNpmManifest(name: string, fetchFn: typeof fetch): Promise<RegistryManifest> {
  const response = await fetchFn(`https://registry.npmjs.org/${name}/latest`);
  if (!response.ok) throw new Error(`npm registry returned ${response.status} for ${name}`);
  return (await response.json()) as RegistryManifest;
}
