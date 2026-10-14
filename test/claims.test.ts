import * as hegel from "@hegeldev/hegel";
import * as gs from "@hegeldev/hegel/generators";
import { expect, test } from "vitest";
import {
  claimKey,
  formatBroken,
  normalizeOutput,
  problems,
  scanSource,
  verifyAll,
  type ClaimSite,
  type ClaimSpec,
  type Outcome,
} from "../scripts/claims/index.ts";

const source = `---
title: x
---
import Claim from "../c.astro";

Some text.

<Claim tool="archstrict" run="archstrict check" cwd="fixtures/a" exit={1} includes={["one", 'two']}>
  The sentence.
</Claim>

  <Demo
    tool="archstrict"
    run={"archstrict rules a\\tb"}
  />
`;

test("scanner reads literal attributes with file, line, and column", () => {
  expect(scanSource("page.mdx", source)).toEqual([
    {
      element: "Claim",
      file: "page.mdx",
      line: 8,
      col: 1,
      tool: "archstrict",
      run: "archstrict check",
      cwd: "fixtures/a",
      exit: 1,
      includes: ["one", "two"],
    },
    {
      element: "Demo",
      file: "page.mdx",
      line: 12,
      col: 3,
      tool: "archstrict",
      run: "archstrict rules a\tb",
      cwd: ".",
      exit: 0,
      includes: [],
    },
  ]);
});

test.each([
  ['<Claim tool="a" run={cmd}>x</Claim>', 'expected a string, number, or array-of-string literal'],
  ['<Claim tool="a" run="b" exit={1 + 1}>x</Claim>', "expected closing }"],
  ['<Claim tool="a" run="b" includes={[x]}>x</Claim>', "an array may hold only string literals"],
  ['<Claim tool="a" run="b" {...props}>x</Claim>', "spreads and expressions are not allowed"],
  ['<Claim tool="a" run="b" exit="1">x</Claim>', 'attribute "exit" must be a number'],
  ['<Claim tool="a" run="b" color="red">x</Claim>', 'unknown attribute "color"'],
  ['<Claim tool="a">x</Claim>', 'missing attribute "run"'],
  ['<Claim tool="a" run>x</Claim>', 'attribute "run" needs a literal value'],
])("scanner rejects %s", (text, message) => {
  expect(() => scanSource("p.mdx", `intro\n${text}`)).toThrow(`p.mdx:2:1: `);
  expect(() => scanSource("p.mdx", `intro\n${text}`)).toThrow(message);
});

const spec: ClaimSpec = { tool: "archstrict", run: "archstrict check", cwd: "fixtures/a", exit: 1, includes: ["bypass"] };

test("a claim passes when exit code and included text match", () => {
  expect(problems(spec, { exit: 1, stdout: "public-surface-bypass found", timedOut: false })).toEqual([]);
});

test("a claim reports the exit code and each missing text", () => {
  expect(problems({ ...spec, includes: ["a", "b"] }, { exit: 0, stdout: "b", timedOut: false })).toEqual([
    "exit 0 (expected 1)",
    'missing "a" in output',
  ]);
});

test("a timeout is its own evidence", () => {
  expect(problems(spec, { exit: null, stdout: "", timedOut: true })).toEqual(["the command timed out"]);
});

test("the key ignores attribute order, wording, and file, but not the expectation", () => {
  const same = { ...spec };
  expect(claimKey(same)).toBe(claimKey(spec));
  expect(claimKey({ ...spec, exit: 0 })).not.toBe(claimKey(spec));
  expect(claimKey({ ...spec, includes: ["bypass", "x"] })).not.toBe(claimKey(spec));
});

test("equal specs share one key and differing specs never do", () =>
  hegel.test((tc) => {
    const draw = (): ClaimSpec => ({
      tool: tc.draw(gs.text({ maxSize: 6 })),
      run: tc.draw(gs.text({ maxSize: 6 })),
      cwd: tc.draw(gs.text({ maxSize: 6 })),
      exit: tc.draw(gs.integers({ minValue: 0, maxValue: 3 })),
      includes: tc.draw(gs.arrays(gs.text({ maxSize: 4 }), { maxSize: 2 })),
    });
    const a = draw();
    const b = draw();
    expect(claimKey({ ...a })).toBe(claimKey(a));
    if (JSON.stringify(a) !== JSON.stringify(b)) expect(claimKey(a)).not.toBe(claimKey(b));
  }));

test("normalizing strips ANSI codes and replaces the repository path", () => {
  expect(normalizeOutput("\u001b[31mred\u001b[0m /repo/fixtures/x/a.ts:1:2  \n", ["/repo"])).toBe("red ./fixtures/x/a.ts:1:2");
});

test("normalizing keeps the text after the root and drops escape codes", () =>
  hegel.test((tc) => {
    const root = `/${tc.draw(gs.fromRegex("[a-z0-9]{1,8}", { fullmatch: true }))}`;
    const text = tc.draw(gs.fromRegex("[a-z0-9.]{0,12}", { fullmatch: true }));
    const out = normalizeOutput(`\u001b[1m${root}/#${text}\u001b[0m`, [root]);
    expect(out.includes("\u001b")).toBe(false);
    expect(out).toBe(`./#${text}`);
  }));

const site = (over: Partial<ClaimSite>): ClaimSite => ({ ...spec, element: "Claim", file: "a.mdx", line: 3, col: 1, ...over });

test("a shared claim runs once and every page that states it is reported when broken", () => {
  let runs = 0;
  const runner = (): Outcome => {
    runs++;
    return { exit: 0, stdout: "clean", timedOut: false };
  };
  const result = verifyAll([site({ file: "en.mdx", line: 12 }), site({ file: "ja.mdx", line: 12 })], runner, () => "0.2.1");
  expect(runs).toBe(1);
  expect(Object.values(result.records)).toEqual([
    { run: "archstrict check", cwd: "fixtures/a", tool: "archstrict", version: "0.2.1", exit: 1, stdout: "clean", ok: false },
  ]);
  expect(formatBroken(result.broken)).toBe(
    [
      "claim-broken en.mdx:12:1",
      '  evidence: exit 0 (expected 1); missing "bypass" in output',
      "  because: the sentence next to this claim is no longer true for archstrict 0.2.1",
      "  do: fix the sentence or its expectation, then run npm run claims",
      "claim-broken ja.mdx:12:1",
      '  evidence: exit 0 (expected 1); missing "bypass" in output',
      "  because: the sentence next to this claim is no longer true for archstrict 0.2.1",
      "  do: fix the sentence or its expectation, then run npm run claims",
    ].join("\n"),
  );
});

test("a passing claim records ok and reports nothing", () => {
  const result = verifyAll([site({})], () => ({ exit: 1, stdout: "a bypass", timedOut: false }), () => "0.2.1");
  expect(result.broken).toEqual([]);
  expect(Object.values(result.records)[0]?.ok).toBe(true);
});
