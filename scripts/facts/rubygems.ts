// Turns a RubyGems API payload into a GemFact.
import type { GemEntry, ToolEntry } from "../../tools.config.ts";
import type { GemFact } from "./types.ts";

export interface GemPayload {
  name: string;
  version: string;
  info?: string | null;
  licenses?: string[] | null;
  dependencies?: {
    runtime?: { name: string }[];
    development?: { name: string }[];
  };
}

export function toGemFact(entry: GemEntry, payload: GemPayload, registry: readonly ToolEntry[]): GemFact {
  const dependencies = new Set(
    [...(payload.dependencies?.runtime ?? []), ...(payload.dependencies?.development ?? [])].map((dependency) => dependency.name),
  );
  const uses = registry
    .filter((other) => other.source === "rubygems" && other.slug !== entry.slug && dependencies.has(other.gem))
    .map((other) => other.slug)
    .sort();
  const licenses = payload.licenses ?? [];
  return {
    source: "rubygems",
    slug: entry.slug,
    name: payload.name,
    version: payload.version,
    description: payload.info ?? "",
    license: licenses.length > 0 ? licenses.join(" OR ") : null,
    repo: entry.repo,
    uses,
  };
}

export async function fetchGemPayload(name: string, fetchFn: typeof fetch): Promise<GemPayload> {
  const response = await fetchFn(`https://rubygems.org/api/v1/gems/${name}.json`);
  if (!response.ok) throw new Error(`RubyGems returned ${response.status} for ${name}`);
  return (await response.json()) as GemPayload;
}
