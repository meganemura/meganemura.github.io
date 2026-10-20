// Typed access to the generated files that pages render from.
// Boundary: read-only; nothing here fetches or runs a command.
import { claimKey, type ClaimRecord, type ClaimSpec } from "../../scripts/claims/index.ts";
import type { PackageFact, RepoFact, ToolFact } from "../../scripts/facts/index.ts";
import { sectionOf, sections, type Section } from "../../tools.config.ts";
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

// npm and RubyGems install by package name. A repository has no package, so its lines
// are the ones its README gives, which the facts check against that README.
export function installLines(fact: ToolFact): readonly string[] {
  switch (fact.source) {
    case "npm":
      return [`npm install ${fact.name}`];
    case "rubygems":
      return [`gem install ${fact.name}`];
    case "github":
      return fact.install;
  }
}

export function sectionLabel(section: Section, lang: Lang): string {
  const found = sections.find((candidate) => candidate.id === section);
  if (!found) throw new Error(`unknown section "${section}"`);
  return found.label[lang];
}

export function factsIn(section: Section): ToolFact[] {
  return toolFacts.filter((fact) => sectionOf(fact) === section);
}

// Only packages have dependencies to read, so plugins and mods stay off the graph.
export const packageFacts = toolFacts.filter((fact): fact is PackageFact => fact.source !== "github");

export function commitHref(fact: RepoFact): string {
  return `${fact.repo}/tree/${fact.commit}`;
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
    skills: "Skills",
    readAt: "Read from the default branch at",
    checked: (tool: string) => `checked with ${tool}`,
    ran: "ran in",
    exitCode: "exit",
    graphLabel: "Which tool uses which",
    graphCaption:
      "An arrow points from a tool to a tool it depends on. The edges come from each package's runtime and development dependencies on npm and RubyGems, archstrict, nukadoko, solarsql, and polylinedb sit inside the ring, and a two-headed colored line marks two tools that use each other.",
  },
  ja: {
    install: "インストール",
    repo: "GitHub のソースコード",
    uses: "使っているツール",
    usedBy: "このツールを使っているツール",
    none: "ほかのツールは使っていません",
    skills: "スキル",
    readAt: "デフォルトブランチから読み込んだコミット",
    checked: (tool: string) => `${tool} で確認済み`,
    ran: "実行ディレクトリ",
    exitCode: "終了コード",
    graphLabel: "どのツールがどのツールを使っているか",
    graphCaption:
      "矢印は、あるツールから、そのツールが依存するツールに向かいます。依存の情報は、npm と RubyGems にある各パッケージの実行時と開発時の依存関係から読み込んでいます。archstrict、nukadoko、solarsql、polylinedb の 4 つを輪の内側に置き、互いに使い合う 2 つのツールは両端に矢印の付いた色付きの線で結んでいます。",
  },
} as const;

export function t(lang: Lang) {
  return TEXT[lang];
}

export function usersOf(slug: string): string[] {
  return packageFacts.filter((fact) => fact.uses.includes(slug)).map((fact) => fact.slug);
}

export const graphEdges = packageFacts.flatMap((fact) => fact.uses.map((to) => ({ from: fact.slug, to })));
