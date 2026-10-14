// The registry of tools the site shows. Everything else about a tool
// (version, description, bins, dependencies) comes from the npm registry.
export interface ToolEntry {
  readonly slug: string;
  readonly npm: string;
  readonly repo: string;
}

const entry = (slug: string, npm: string = slug): ToolEntry => ({
  slug,
  npm,
  repo: `https://github.com/meganemura/${slug}`,
});

export const tools: readonly ToolEntry[] = [
  entry("polylinedb"),
  entry("solarsql"),
  entry("spacequery"),
  entry("archstrict"),
  entry("stryker-agent-reporter"),
  entry("stow", "@meganemura/stow"),
  entry("finderscope"),
  entry("nukadoko"),
  entry("depug", "@meganemura/depug"),
  entry("firstlight"),
];
