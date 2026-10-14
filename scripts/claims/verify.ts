// Compares what a command did with what the page says it does, and reports
// each broken claim in the shape an agent can act on. No process or file access:
// the CLI injects a runner so this logic stays testable with literal outcomes.
import { createHash } from "node:crypto";
import type { ClaimSite, ClaimSpec } from "./scan.ts";

export interface Outcome {
  exit: number | null;
  stdout: string;
  timedOut: boolean;
}

export interface ClaimRecord {
  run: string;
  cwd: string;
  tool: string;
  version: string;
  exit: number;
  stdout: string;
  ok: boolean;
}

export interface BrokenClaim {
  at: string;
  evidence: string;
  because: string;
  do: string;
}

export type Runner = (spec: ClaimSpec) => Outcome;

export function claimKey(spec: ClaimSpec): string {
  const material = JSON.stringify([spec.tool, spec.run, spec.cwd, spec.exit, spec.includes]);
  return createHash("sha256").update(material).digest("hex").slice(0, 12);
}

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

export function normalizeOutput(raw: string, roots: readonly string[]): string {
  let text = raw.replace(ANSI, "");
  // Longest root first, and only at a path boundary, so /repo-old is not read as /repo plus "-old".
  for (const root of [...roots].sort((a, b) => b.length - a.length)) {
    text = text.replace(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`, "g"), ".");
  }
  return text.trimEnd();
}

export function problems(spec: ClaimSpec, outcome: Outcome): string[] {
  if (outcome.timedOut) return ["the command timed out"];
  const found: string[] = [];
  if (outcome.exit !== spec.exit) found.push(`exit ${outcome.exit} (expected ${spec.exit})`);
  for (const text of spec.includes) if (!outcome.stdout.includes(text)) found.push(`missing ${JSON.stringify(text)} in output`);
  return found;
}

export interface Verification {
  records: Record<string, ClaimRecord>;
  broken: BrokenClaim[];
}

export function verifyAll(sites: readonly ClaimSite[], runner: Runner, versionOf: (tool: string) => string): Verification {
  const records: Record<string, ClaimRecord> = {};
  const failures = new Map<string, string[]>();
  for (const site of sites) {
    const key = claimKey(site);
    if (key in records) continue;
    const outcome = runner(site);
    const found = problems(site, outcome);
    failures.set(key, found);
    records[key] = {
      run: site.run,
      cwd: site.cwd,
      tool: site.tool,
      version: versionOf(site.tool),
      exit: site.exit,
      stdout: outcome.stdout,
      ok: found.length === 0,
    };
  }
  const broken: BrokenClaim[] = [];
  for (const site of sites) {
    const key = claimKey(site);
    const found = failures.get(key) ?? [];
    if (found.length === 0) continue;
    const version = (records[key] as ClaimRecord).version;
    broken.push({
      at: `${site.file}:${site.line}:${site.col}`,
      evidence: found.join("; "),
      because:
        site.element === "Claim"
          ? `the sentence next to this claim is no longer true for ${site.tool} ${version}`
          : `the output shown by this demo no longer matches what the page expects from ${site.tool} ${version}`,
      do: "fix the sentence or its expectation, then run npm run claims",
    });
  }
  return { records, broken };
}

export function formatBroken(broken: readonly BrokenClaim[]): string {
  return broken
    .map((b) => `claim-broken ${b.at}\n  evidence: ${b.evidence}\n  because: ${b.because}\n  do: ${b.do}`)
    .join("\n");
}
