// Turns the files of a plugin or skill repository, read at one commit, into a RepoFact.
// The parsers are pure; fetchRepoFact reads the files through an injected fetch and takes
// the commit from its caller, because resolving a branch needs git, which only the CLI runs.
import type { RepoEntry } from "../../tools.config.ts";
import type { RepoFact } from "./types.ts";

export interface PluginManifest {
  name?: string;
  version?: string;
  description?: string;
  license?: string;
}

interface Marketplace {
  plugins?: (PluginManifest & { name: string })[];
}

// A marketplace lists several plugins; the one that shares the repository's name is the tool.
export function readManifest(path: string, text: string, slug: string): PluginManifest {
  const json = JSON.parse(text) as PluginManifest & Marketplace;
  if (!path.endsWith("marketplace.json")) return json;
  const plugin = json.plugins?.find((candidate) => candidate.name === slug);
  if (!plugin) throw new Error(`${path} lists no plugin named "${slug}"`);
  return plugin;
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1).replace(/\\"/g, '"');
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

// Reads the top-level scalars of a SKILL.md frontmatter, including `>` and `|` block scalars.
// Nested maps and lists are skipped: no skill field the site reads uses them.
export function parseFrontmatter(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return {};
  const end = lines.indexOf("---", 1);
  const body = lines.slice(1, end === -1 ? lines.length : end);
  const fields: Record<string, string> = {};
  for (let i = 0; i < body.length; i++) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(body[i] as string);
    if (!match) continue;
    const key = match[1] as string;
    const value = (match[2] as string).trim();
    const block = /^([>|])[-+]?$/.exec(value);
    if (!block) {
      fields[key] = unquote(value);
      continue;
    }
    const collected: string[] = [];
    while (i + 1 < body.length && (/^\s/.test(body[i + 1] as string) || (body[i + 1] as string).trim() === "")) {
      collected.push((body[++i] as string).trim());
    }
    while (collected.at(-1) === "") collected.pop();
    fields[key] = block[1] === ">" ? collected.filter((line) => line !== "").join(" ") : collected.join("\n");
  }
  return fields;
}

// The first paragraph under the title, past badges and images.
export function readmeLead(text: string): string {
  const lines = text.split(/\r?\n/);
  const title = lines.findIndex((line) => line.startsWith("# "));
  const paragraph: string[] = [];
  for (const raw of lines.slice(title + 1)) {
    const line = raw.trim();
    const decoration = line.startsWith("[![") || line.startsWith("![");
    if (paragraph.length === 0 && (line === "" || decoration)) continue;
    if (line === "" || line.startsWith("#")) break;
    paragraph.push(line);
  }
  return paragraph.join(" ");
}

// Names the license by its standard heading; an unknown text is reported as no license
// rather than guessed at.
export function licenseId(text: string): string | null {
  const first = text.split(/\r?\n/).find((line) => line.trim() !== "")?.trim();
  if (first === "MIT License") return "MIT";
  if (first === "Apache License" && /Version 2\.0/.test(text)) return "Apache-2.0";
  return null;
}

export interface RepoFiles {
  readme: string;
  license: string;
  manifest: PluginManifest | null;
  skills: Record<string, string>[];
}

export function toRepoFact(entry: RepoEntry, files: RepoFiles, commit: string): RepoFact {
  const readmeLines = new Set(files.readme.split(/\r?\n/).map((line) => line.trim()));
  for (const line of entry.install) {
    if (!readmeLines.has(line)) {
      throw new Error(
        `facts-error github ${entry.slug}.install: README.md at ${commit} has no line "${line}"\ndo: copy the install lines from that README into tools.config.ts`,
      );
    }
  }
  const skills = files.skills.map((frontmatter, i) => {
    const name = frontmatter["name"];
    if (!name) throw new Error(`facts-error github ${entry.slug}.skills: ${entry.skills[i]} at ${commit} has no name in its frontmatter`);
    return name;
  });
  return {
    source: "github",
    section: entry.section,
    slug: entry.slug,
    name: files.manifest?.name ?? entry.slug,
    version: files.manifest?.version ?? null,
    description: files.manifest?.description ?? readmeLead(files.readme),
    license: files.manifest?.license ?? licenseId(files.license),
    repo: entry.repo,
    skills,
    install: [...entry.install],
    commit,
  };
}

export async function fetchRepoFact(entry: RepoEntry, commit: string, fetchFn: typeof fetch): Promise<RepoFact> {
  const base = `${entry.repo.replace("https://github.com/", "https://raw.githubusercontent.com/")}/${commit}`;
  const read = async (path: string) => {
    const response = await fetchFn(`${base}/${path}`);
    if (!response.ok) throw new Error(`facts-error github ${entry.slug}: ${path} at ${commit} returned ${response.status}`);
    return response.text();
  };
  const [readme, license, manifestText, ...skillTexts] = await Promise.all([
    read("README.md"),
    read("LICENSE"),
    entry.manifest === undefined ? Promise.resolve(null) : read(entry.manifest),
    ...entry.skills.map(read),
  ]);
  const manifest = manifestText === null || entry.manifest === undefined ? null : readManifest(entry.manifest, manifestText, entry.slug);
  return toRepoFact(entry, { readme, license, manifest, skills: skillTexts.map(parseFrontmatter) }, commit.slice(0, 7));
}
