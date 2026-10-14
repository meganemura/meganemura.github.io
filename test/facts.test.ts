import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { expect, test } from "vitest";
import { diffFacts, formatChanges, serializeFacts, sortFacts, toFact, type ToolFact } from "../scripts/facts/index.ts";
import type { ToolEntry } from "../tools.config.ts";

const registry: ToolEntry[] = [
  { slug: "alpha", npm: "alpha", repo: "https://github.com/o/alpha" },
  { slug: "beta", npm: "@o/beta", repo: "https://github.com/o/beta" },
];

test("uses lists sibling tools from dependencies and devDependencies, sorted, excluding itself", () => {
  const fact = toFact(
    registry[0] as ToolEntry,
    { name: "alpha", version: "1.2.3", dependencies: { "@o/beta": "1.0.0", alpha: "0.0.1" }, devDependencies: { vitest: "1" } },
    registry,
  );
  expect(fact).toEqual({
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
  const fact = toFact(registry[1] as ToolEntry, { name: "@o/beta", version: "1.0.0", bin: "dist/cli.js" }, registry);
  expect(fact.bins).toEqual(["beta"]);
});

test("a change names the tool, the field, and the fix", () => {
  const base = toFact(registry[0] as ToolEntry, { name: "alpha", version: "1.0.0" }, registry);
  const changes = diffFacts([base], [{ ...base, version: "1.1.0" }]);
  expect(formatChanges(changes)).toBe(
    'facts-drift alpha.version: committed "1.0.0", registry "1.1.0"\ndo: npm run facts',
  );
});

const factGen = gs.composite<ToolFact>((tc) => ({
  slug: tc.draw(gs.text({ minSize: 1, maxSize: 8 })),
  name: tc.draw(gs.text({ maxSize: 8 })),
  version: tc.draw(gs.text({ maxSize: 8 })),
  description: tc.draw(gs.text({ maxSize: 20 })),
  bins: tc.draw(gs.arrays(gs.text({ maxSize: 5 }), { maxSize: 3 })),
  license: tc.draw(gs.optional(gs.text({ maxSize: 5 }))),
  repo: tc.draw(gs.text({ maxSize: 12 })),
  uses: tc.draw(gs.arrays(gs.text({ maxSize: 5 }), { maxSize: 3 })),
}));

test("serialized facts parse back to the sorted facts", () =>
  hegel.test((tc) => {
    const facts = tc.draw(gs.arrays(factGen, { maxSize: 6 }));
    expect(JSON.parse(serializeFacts(facts))).toEqual(sortFacts(facts));
  }));

test("identical facts never drift, and any changed version does", () =>
  hegel.test((tc) => {
    const drawn = tc.draw(gs.arrays(factGen, { minSize: 1, maxSize: 6 }));
    const facts = [...new Map(drawn.map((fact) => [fact.slug, fact])).values()];
    expect(diffFacts(facts, facts)).toEqual([]);
    const first = facts[0] as ToolFact;
    const bumped = [{ ...first, version: `${first.version}x` }, ...facts.slice(1)];
    expect(diffFacts(facts, bumped).length).toBeGreaterThan(0);
  }));
