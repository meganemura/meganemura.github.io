// The facts the site renders, one shape per source. `source` is the discriminant every
// consumer switches on, so a new source is a compile error wherever it is not handled yet.

export interface NpmFact {
  source: "npm";
  slug: string;
  name: string;
  version: string;
  description: string;
  bins: string[];
  license: string | null;
  repo: string;
  uses: string[];
}

export interface GemFact {
  source: "rubygems";
  slug: string;
  name: string;
  version: string;
  description: string;
  license: string | null;
  repo: string;
  uses: string[];
}

export interface RepoFact {
  source: "github";
  section: "skills" | "mods";
  slug: string;
  name: string;
  version: string | null;
  description: string;
  license: string | null;
  repo: string;
  skills: string[];
  install: string[];
  commit: string;
}

export type ToolFact = NpmFact | GemFact | RepoFact;
export type PackageFact = NpmFact | GemFact;
