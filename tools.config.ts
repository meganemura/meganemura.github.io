// The registry of tools the site shows, and the sections it groups them in.
// Everything else about a tool (version, description, license, dependencies)
// comes from its source: the npm registry, RubyGems, or the GitHub repository itself.
export type Section = "cli" | "gems" | "skills" | "mods";

export interface NpmEntry {
  readonly source: "npm";
  readonly slug: string;
  readonly npm: string;
  readonly repo: string;
}

export interface GemEntry {
  readonly source: "rubygems";
  readonly slug: string;
  readonly gem: string;
  readonly repo: string;
}

// A plugin or skill repository has no registry, so the facts read files at its default branch.
// `manifest` names the plugin manifest to read, when the repository has one; without it the
// description is the README's first paragraph. A new skill directory needs a line in `skills`,
// because raw file URLs cannot list a directory. Each `install` line must appear in the README
// as written, and the facts fail when it no longer does.
export interface RepoEntry {
  readonly source: "github";
  readonly section: "skills" | "mods";
  readonly slug: string;
  readonly repo: string;
  readonly manifest?: string;
  readonly skills: readonly string[];
  readonly install: readonly string[];
}

export type ToolEntry = NpmEntry | GemEntry | RepoEntry;

export const sections: readonly { readonly id: Section; readonly label: { readonly en: string; readonly ja: string } }[] = [
  { id: "cli", label: { en: "Command-line tools on npm", ja: "npm のコマンドラインツール" } },
  { id: "gems", label: { en: "Ruby gems", ja: "Ruby の gem" } },
  { id: "skills", label: { en: "Agent plugins and skills", ja: "エージェント向けのプラグインとスキル" } },
  { id: "mods", label: { en: "Claude Code mods", ja: "Claude Code の mod" } },
];

export function sectionOf(item: { readonly source: "npm" } | { readonly source: "rubygems" } | { readonly source: "github"; readonly section: "skills" | "mods" }): Section {
  switch (item.source) {
    case "npm":
      return "cli";
    case "rubygems":
      return "gems";
    case "github":
      return item.section;
  }
}

const repoOf = (slug: string) => `https://github.com/meganemura/${slug}`;

const npm = (slug: string, name: string = slug): NpmEntry => ({ source: "npm", slug, npm: name, repo: repoOf(slug) });

const gem = (slug: string, name: string = slug): GemEntry => ({ source: "rubygems", slug, gem: name, repo: repoOf(slug) });

const github = (slug: string, fields: Omit<RepoEntry, "source" | "slug" | "repo">): RepoEntry => ({
  source: "github",
  slug,
  repo: repoOf(slug),
  ...fields,
});

const mod = (slug: string, skills: readonly string[] = []): RepoEntry =>
  github(slug, {
    section: "mods",
    manifest: "plugin/.claude-plugin/plugin.json",
    skills,
    install: [`claude plugin marketplace add meganemura/${slug}`, `claude plugin install ${slug}@${slug}`],
  });

export const tools: readonly ToolEntry[] = [
  npm("polylinedb"),
  npm("solarsql"),
  npm("spacequery"),
  npm("archstrict"),
  npm("stryker-agent-reporter"),
  npm("stow", "@meganemura/stow"),
  npm("finderscope"),
  npm("nukadoko"),
  npm("depug", "@meganemura/depug"),
  npm("firstlight"),
  npm("runtag"),
  npm("autospawn"),
  npm("portful"),
  gem("bulldogger"),
  gem("archspec_diagram"),
  gem("hegel-ruby", "hegeltest"),
  github("headsign", {
    section: "skills",
    skills: ["skills/create-project-skill/SKILL.md", "skills/improve-project-skill/SKILL.md"],
    install: ["gh skill install meganemura/headsign --all --agent codex --scope user"],
  }),
  github("steerhook", {
    section: "skills",
    manifest: "plugin/.claude-plugin/plugin.json",
    skills: ["plugin/skills/writing-rules/SKILL.md"],
    install: ["/plugin marketplace add meganemura/steerhook", "/plugin install steerhook@steerhook"],
  }),
  github("mutation-testing-skills", {
    section: "skills",
    skills: ["skills/stryker/SKILL.md", "skills/mutineer-practice/SKILL.md"],
    install: ["npx skills add meganemura/mutation-testing-skills --skill stryker -g -a claude-code"],
  }),
  mod("grilling-pane", ["plugin/skills/grilling/SKILL.md"]),
  mod("buffer-pane"),
  mod("draft-pane", ["plugin/skills/draft/SKILL.md"]),
  mod("jira-ticket-pane"),
  mod("pull-request-pane"),
];

// A public repository that is archived leaves the tools above: it gets no facts, no page, and no
// node in the graph, because nothing about it changes any more. The home page still names it,
// with one line in each language written from the archive notice at the top of its README.
export interface ArchivedEntry {
  readonly slug: string;
  readonly repo: string;
  readonly line: { readonly en: string; readonly ja: string };
}

export const archived: readonly ArchivedEntry[] = [
  {
    slug: "pstack-portable",
    repo: repoOf("pstack-portable"),
    line: {
      en: "Ran upstream pstack in Claude Code and Codex. Upstream pstack now supports Claude Code, and the last release is v0.4.5.",
      ja: "上流の pstack を Claude Code と Codex で動かすラッパーでした。上流が Claude Code に対応したため、最後のリリースは v0.4.5 です。",
    },
  },
];
