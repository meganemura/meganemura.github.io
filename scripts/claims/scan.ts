// Finds <Claim> and <Demo> elements in MDX source and reads their attributes.
// Only string, number, and array-of-string literals are accepted: a claim must
// be readable without evaluating any code, so anything else fails loudly.

export interface ClaimSpec {
  tool: string;
  run: string;
  cwd: string;
  exit: number;
  includes: string[];
}

export interface ClaimSite extends ClaimSpec {
  element: "Claim" | "Demo";
  file: string;
  line: number;
  col: number;
}

export class ScanError extends Error {}

type Value = string | number | string[];

const ALLOWED: Record<string, "string" | "number" | "strings"> = {
  tool: "string",
  run: "string",
  cwd: "string",
  exit: "number",
  includes: "strings",
};

const ESCAPES: Record<string, string> = { n: "\n", t: "\t", r: "\r" };

class Cursor {
  pos: number;
  readonly source: string;
  readonly fail: (message: string) => never;

  constructor(source: string, pos: number, fail: (message: string) => never) {
    this.source = source;
    this.pos = pos;
    this.fail = fail;
  }

  skipSpace(): void {
    while (/\s/.test(this.source[this.pos] ?? "")) this.pos++;
  }

  peek(): string {
    return this.source[this.pos] ?? "";
  }

  expect(char: string, what: string): void {
    if (this.peek() !== char) this.fail(`expected ${what}`);
    this.pos++;
  }

  // Inside {...} a string follows JS escapes; as a bare JSX attribute it is raw.
  string(escapes: boolean): string {
    const quote = this.peek();
    this.pos++;
    let out = "";
    for (;;) {
      const char = this.source[this.pos++];
      if (char === undefined) this.fail("unterminated string");
      if (char === quote) return out;
      if (escapes && char === "\\") {
        const next = this.source[this.pos++] ?? "";
        out += ESCAPES[next] ?? next;
      } else out += char;
    }
  }

  expression(): Value {
    this.skipSpace();
    const char = this.peek();
    let value: Value;
    if (char === '"' || char === "'") value = this.string(true);
    else if (/[-\d]/.test(char)) {
      const match = /^-?\d+(\.\d+)?/.exec(this.source.slice(this.pos));
      if (!match) this.fail("expected a number literal");
      value = Number(match[0]);
      this.pos += match[0].length;
    } else if (char === "[") {
      this.pos++;
      const items: string[] = [];
      for (;;) {
        this.skipSpace();
        if (this.peek() === "]") break;
        const quote = this.peek();
        if (quote !== '"' && quote !== "'") this.fail("an array may hold only string literals");
        items.push(this.string(true));
        this.skipSpace();
        if (this.peek() === ",") this.pos++;
        else if (this.peek() !== "]") this.fail("expected , or ] in the array");
      }
      this.pos++;
      value = items;
    } else this.fail("expected a string, number, or array-of-string literal");
    this.skipSpace();
    this.expect("}", "closing }");
    return value;
  }
}

function position(source: string, index: number): { line: number; col: number } {
  const before = source.slice(0, index);
  const line = before.split("\n").length;
  return { line, col: index - (before.lastIndexOf("\n") + 1) + 1 };
}

export function scanSource(file: string, source: string): ClaimSite[] {
  const sites: ClaimSite[] = [];
  for (const match of source.matchAll(/<(Claim|Demo)(?=[\s/>])/g)) {
    const start = match.index;
    const { line, col } = position(source, start);
    const fail: (message: string) => never = (message) => {
      throw new ScanError(`${file}:${line}:${col}: ${message}`);
    };
    const cursor = new Cursor(source, start + match[0].length, fail);
    const attributes = new Map<string, Value>();
    for (;;) {
      cursor.skipSpace();
      if (cursor.peek() === ">" || source.startsWith("/>", cursor.pos)) break;
      const name = /^[A-Za-z_][\w-]*/.exec(source.slice(cursor.pos))?.[0];
      if (name === undefined) fail("expected an attribute name; spreads and expressions are not allowed");
      cursor.pos += name.length;
      if (!(name in ALLOWED)) fail(`unknown attribute "${name}"`);
      if (cursor.peek() !== "=") fail(`attribute "${name}" needs a literal value`);
      cursor.pos++;
      const quote = cursor.peek();
      if (quote === '"' || quote === "'") attributes.set(name, cursor.string(false));
      else if (quote === "{") {
        cursor.pos++;
        attributes.set(name, cursor.expression());
      } else fail(`attribute "${name}" needs a literal value`);
    }
    for (const [name, value] of attributes) {
      const kind = ALLOWED[name];
      const ok = kind === "string" ? typeof value === "string" : kind === "number" ? typeof value === "number" : Array.isArray(value);
      if (!ok) fail(`attribute "${name}" must be ${kind === "strings" ? "an array of strings" : `a ${kind}`}`);
    }
    for (const required of ["tool", "run"]) if (!attributes.has(required)) fail(`missing attribute "${required}"`);
    sites.push({
      element: match[1] as "Claim" | "Demo",
      file,
      line,
      col,
      tool: attributes.get("tool") as string,
      run: attributes.get("run") as string,
      cwd: (attributes.get("cwd") as string | undefined) ?? ".",
      exit: (attributes.get("exit") as number | undefined) ?? 0,
      includes: (attributes.get("includes") as string[] | undefined) ?? [],
    });
  }
  return sites;
}
