// Typed access to the generated files that pages render from.
// Boundary: read-only; nothing here fetches or runs a command.
import { claimKey, type ClaimRecord, type ClaimSpec } from "../../scripts/claims/index.ts";
import type { ToolFact } from "../../scripts/facts/index.ts";
import claimsJson from "../generated/claims.json" with { type: "json" };
import toolsJson from "../generated/tools.json" with { type: "json" };

export type Lang = "en" | "ja";

export const toolFacts = toolsJson as ToolFact[];

export function factFor(slug: string): ToolFact {
  const fact = toolFacts.find((candidate) => candidate.slug === slug);
  if (!fact) throw new Error(`unknown tool "${slug}"\ndo: add it to tools.config.ts, then run npm run facts`);
  return fact;
}

export function toolHref(slug: string, lang: Lang): string {
  return lang === "ja" ? `/ja/tools/${slug}/` : `/tools/${slug}/`;
}

export function installCommand(fact: ToolFact): string {
  return `npm install ${fact.name}`;
}

export function claimFor(spec: ClaimSpec): ClaimRecord {
  const record = (claimsJson as Record<string, ClaimRecord>)[claimKey(spec)];
  if (!record) {
    throw new Error(`no recorded result for \`${spec.run}\` in ${spec.cwd} (key ${claimKey(spec)})\ndo: npm run claims`);
  }
  if (!record.ok) throw new Error(`the recorded result for \`${spec.run}\` is broken\ndo: npm run claims`);
  return record;
}

const TEXT = {
  en: {
    install: "Install",
    repo: "Source on GitHub",
    uses: "Uses",
    usedBy: "Used by",
    none: "no other tool here",
    checkedWith: "checked with",
    ran: "ran in",
    exitCode: "exit",
    graphLabel: "Which tool uses which",
    graphCaption:
      "An arrow points from a tool to a tool it depends on. The edges come from each package's dependencies and devDependencies on npm, and the most used tools sit at the top.",
  },
  ja: {
    install: "インストール",
    repo: "GitHub のソース",
    uses: "使うツール",
    usedBy: "使われるツール",
    none: "ほかのツールは使っていません",
    checkedWith: "確認に使用",
    ran: "実行場所",
    exitCode: "終了コード",
    graphLabel: "どのツールがどのツールを使うか",
    graphCaption:
      "矢印は、使う側のツールから使われる側のツールに向かいます。辺は各パッケージの dependencies と devDependencies を npm から読んで作っています。よく使われるツールほど上に並びます。",
  },
} as const;

export function t(lang: Lang) {
  return TEXT[lang];
}

export function usersOf(slug: string): string[] {
  return toolFacts.filter((fact) => fact.uses.includes(slug)).map((fact) => fact.slug);
}

export const graphEdges = toolFacts.flatMap((fact) => fact.uses.map((to) => ({ from: fact.slug, to })));
