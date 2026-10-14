import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { expect, test } from "vitest";
import {
  diffFacts,
  formatChanges,
  licenseId,
  parseFrontmatter,
  readManifest,
  readmeLead,
  serializeFacts,
  sortFacts,
  toGemFact,
  toNpmFact,
  toRepoFact,
  type RepoFact,
  type ToolFact,
} from "../scripts/facts/index.ts";
import type { GemEntry, NpmEntry, RepoEntry, ToolEntry } from "../tools.config.ts";

const alpha: NpmEntry = { source: "npm", slug: "alpha", npm: "alpha", repo: "https://github.com/o/alpha" };
const beta: NpmEntry = { source: "npm", slug: "beta", npm: "@o/beta", repo: "https://github.com/o/beta" };
const ruby: GemEntry = { source: "rubygems", slug: "ruby_tool", gem: "ruby_tool", repo: "https://github.com/o/ruby_tool" };
const gemma: GemEntry = { source: "rubygems", slug: "gemma", gem: "gemma", repo: "https://github.com/o/gemma" };
const pane: RepoEntry = {
  source: "github",
  section: "mods",
  slug: "pane",
  repo: "https://github.com/o/pane",
  manifest: "plugin/.claude-plugin/plugin.json",
  skills: ["plugin/skills/ask/SKILL.md"],
  install: ["claude plugin install pane@pane"],
};
const registry: ToolEntry[] = [alpha, beta, ruby, gemma, pane];

test("npm uses lists sibling npm tools from dependencies and devDependencies, sorted, excluding itself", () => {
  const fact = toNpmFact(
    alpha,
    { name: "alpha", version: "1.2.3", dependencies: { "@o/beta": "1.0.0", alpha: "0.0.1", gemma: "1" }, devDependencies: { vitest: "1" } },
    registry,
  );
  expect(fact).toEqual({
    source: "npm",
    slug: "alpha",
    name: "alpha",
    version: "1.2.3",
    description: "",
    bins: [],
    license: null,
    repo: "https://github.com/o/alpha",
    uses: ["beta"],
  });
});

test("a string bin takes the unscoped package name", () => {
  const fact = toNpmFact(beta, { name: "@o/beta", version: "1.0.0", bin: "dist/cli.js" }, registry);
  expect(fact.bins).toEqual(["beta"]);
});

test("a RubyGems payload gives version, info, licenses, and sibling gems from runtime and development dependencies", () => {
  const fact = toGemFact(
    ruby,
    {
      name: "ruby_tool",
      version: "0.3.1",
      info: "Evidence for agents.",
      licenses: ["MIT"],
      dependencies: { runtime: [{ name: "archspec" }], development: [{ name: "gemma" }, { name: "alpha" }, { name: "rake" }] },
    },
    registry,
  );
  expect(fact).toEqual({
    source: "rubygems",
    slug: "ruby_tool",
    name: "ruby_tool",
    version: "0.3.1",
    description: "Evidence for agents.",
    license: "MIT",
    repo: "https://github.com/o/ruby_tool",
    uses: ["gemma"],
  });
  expect(toGemFact(gemma, { name: "gemma", version: "1.0.0", info: null, licenses: null }, registry)).toMatchObject({
    description: "",
    license: null,
    uses: [],
  });
});

test("a marketplace manifest gives the plugin that shares the repository's name", () => {
  const text = JSON.stringify({
    name: "kit",
    plugins: [
      { name: "upstream", version: "9.9.9" },
      { name: "kit", version: "0.4.3", description: "The wrapper.", license: "MIT" },
    ],
  });
  expect(readManifest(".claude-plugin/marketplace.json", text, "kit")).toEqual({
    name: "kit",
    version: "0.4.3",
    description: "The wrapper.",
    license: "MIT",
  });
  expect(() => readManifest(".claude-plugin/marketplace.json", text, "other")).toThrow(
    '.claude-plugin/marketplace.json lists no plugin named "other"',
  );
  expect(readManifest("plugin/.claude-plugin/plugin.json", '{"name":"pane","description":"A pane."}', "pane")).toEqual({
    name: "pane",
    description: "A pane.",
  });
});

test("SKILL.md frontmatter reads plain, quoted, and folded scalars", () => {
  const text = [
    "---",
    "name: create-project-skill",
    "license: MIT",
    "description: >-",
    "  Create a project-local skill",
    "  from repository evidence.",
    'version: "0.2.0"',
    "---",
    "",
    "# Body",
    "name: not-frontmatter",
  ].join("\n");
  expect(parseFrontmatter(text)).toEqual({
    name: "create-project-skill",
    license: "MIT",
    description: "Create a project-local skill from repository evidence.",
    version: "0.2.0",
  });
  expect(parseFrontmatter("# No frontmatter\n")).toEqual({});
});

test("the README lead is the first paragraph under the title, past badges", () => {
  const readme = [
    "# tool",
    "",
    "[![test](https://example.com/badge.svg)](https://example.com)",
    "",
    "Skills that help a coding agent",
    "improve a project.",
    "",
    "More text.",
  ].join("\n");
  expect(readmeLead(readme)).toBe("Skills that help a coding agent improve a project.");
});

test("a license is named by its standard heading, and an unknown text by nothing", () => {
  expect(licenseId("MIT License\n\nCopyright (c) 2026 o\n")).toBe("MIT");
  expect(licenseId("\n                                 Apache License\n                           Version 2.0, January 2004\n")).toBe(
    "Apache-2.0",
  );
  expect(licenseId("All rights reserved.\n")).toBeNull();
});

const paneReadme = "# pane\n\nA pane beside the transcript.\n\n## Install\n\n```sh\nclaude plugin install pane@pane\n```\n";

test("a repository fact takes the manifest first and the README and LICENSE after it", () => {
  const fromManifest = toRepoFact(
    pane,
    {
      readme: paneReadme,
      license: "MIT License\n",
      manifest: { name: "pane", version: "0.4.2", description: "From the manifest." },
      skills: [{ name: "ask", description: "Ask questions." }],
    },
    "0be0da8",
  );
  expect(fromManifest).toEqual({
    source: "github",
    section: "mods",
    slug: "pane",
    name: "pane",
    version: "0.4.2",
    description: "From the manifest.",
    license: "MIT",
    repo: "https://github.com/o/pane",
    skills: ["ask"],
    install: ["claude plugin install pane@pane"],
    commit: "0be0da8",
  });
  const fromReadme = toRepoFact(pane, { readme: paneReadme, license: "MIT License\n", manifest: null, skills: [{ name: "ask" }] }, "0be0da8");
  expect([fromReadme.description, fromReadme.version, fromReadme.name]).toEqual(["A pane beside the transcript.", null, "pane"]);
});

test("an install line the README no longer gives fails and names the tool, the field, and the commit", () => {
  expect(() =>
    toRepoFact(pane, { readme: "# pane\n\nA pane.\n", license: "MIT License\n", manifest: null, skills: [{ name: "ask" }] }, "abc1234"),
  ).toThrow('facts-error github pane.install: README.md at abc1234 has no line "claude plugin install pane@pane"');
});

const repoFact: RepoFact = {
  source: "github",
  section: "skills",
  slug: "kit",
  name: "kit",
  version: null,
  description: "Skills.",
  license: "MIT",
  repo: "https://github.com/o/kit",
  skills: ["one"],
  install: ["gh skill install o/kit"],
  commit: "1111111",
};

test("a change names the source, the tool, the field, and the fix", () => {
  const base = toNpmFact(alpha, { name: "alpha", version: "1.0.0" }, registry);
  expect(formatChanges(diffFacts([base], [{ ...base, version: "1.1.0" }]))).toBe(
    'facts-drift npm alpha.version: committed "1.0.0", fresh "1.1.0"\ndo: npm run facts',
  );
  expect(formatChanges(diffFacts([repoFact], [{ ...repoFact, description: "New." }]))).toBe(
    'facts-drift github kit.description: committed "Skills.", fresh "New."\ndo: npm run facts',
  );
});

test("a new commit on a repository alone is not drift, and a tool that moved to another source is", () => {
  expect(diffFacts([repoFact], [{ ...repoFact, commit: "2222222" }])).toEqual([]);
  const asNpm: ToolFact = { source: "npm", slug: "kit", name: "kit", version: "1.0.0", description: "", bins: [], license: null, repo: "r", uses: [] };
  expect(diffFacts([asNpm], [repoFact])).toEqual([{ source: "github", slug: "kit", field: "source", committed: "npm", fresh: "github" }]);
});

const text = (maxSize: number) => gs.text({ maxSize });

const factGen = gs.composite<ToolFact>((tc) => {
  const slug = tc.draw(gs.text({ minSize: 1, maxSize: 8 }));
  const common = {
    slug,
    name: tc.draw(text(8)),
    description: tc.draw(text(20)),
    license: tc.draw(gs.optional(text(5))),
    repo: tc.draw(text(12)),
  };
  const source = tc.draw(gs.sampledFrom(["npm", "rubygems", "github"] as const));
  if (source === "npm") {
    return { ...common, source, version: tc.draw(text(8)), bins: tc.draw(gs.arrays(text(5), { maxSize: 3 })), uses: tc.draw(gs.arrays(text(5), { maxSize: 3 })) };
  }
  if (source === "rubygems") return { ...common, source, version: tc.draw(text(8)), uses: tc.draw(gs.arrays(text(5), { maxSize: 3 })) };
  return {
    ...common,
    source,
    section: tc.draw(gs.sampledFrom(["skills", "mods"] as const)),
    version: tc.draw(gs.optional(text(8))),
    skills: tc.draw(gs.arrays(text(5), { maxSize: 3 })),
    install: tc.draw(gs.arrays(text(10), { maxSize: 3 })),
    commit: tc.draw(text(7)),
  };
});

const uniqueFacts = (drawn: ToolFact[]) => [...new Map(drawn.map((fact) => [fact.slug, fact])).values()];

test("serialized facts of every source parse back to the sorted facts", () =>
  hegel.test((tc) => {
    const facts = tc.draw(gs.arrays(factGen, { maxSize: 6 }));
    expect(JSON.parse(serializeFacts(facts))).toEqual(sortFacts(facts));
  }));

test("identical facts never drift, a changed description always does, and a changed commit never does", () =>
  hegel.test((tc) => {
    const facts = uniqueFacts(tc.draw(gs.arrays(factGen, { minSize: 1, maxSize: 6 })));
    expect(diffFacts(facts, facts)).toEqual([]);
    const first = facts[0] as ToolFact;
    const changed = [{ ...first, description: `${first.description}x` }, ...facts.slice(1)];
    expect(diffFacts(facts, changed).map((change) => [change.source, change.slug, change.field])).toEqual([[first.source, first.slug, "description"]]);
    const moved = facts.map((fact) => (fact.source === "github" ? { ...fact, commit: `${fact.commit}y` } : fact));
    expect(diffFacts(facts, moved)).toEqual([]);
  }));

test("a folded description parses back to its words joined by single spaces", () =>
  hegel.test((tc) => {
    const word = gs.text({ minSize: 1, maxSize: 8, alphabet: "abcdefghijklmnopqrstuvwxyz.,'" });
    const words = tc.draw(gs.arrays(word, { minSize: 1, maxSize: 12 }));
    const perLine = tc.draw(gs.integers({ minValue: 1, maxValue: 4 }));
    const lines: string[] = [];
    for (let i = 0; i < words.length; i += perLine) lines.push(`  ${words.slice(i, i + perLine).join(" ")}`);
    const frontmatter = ["---", "name: skill", "description: >-", ...lines, "license: MIT", "---", "body"].join("\n");
    expect(parseFrontmatter(frontmatter)).toEqual({ name: "skill", description: words.join(" "), license: "MIT" });
  }));
