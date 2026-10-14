import type { Config } from "./archstrict.types.js";

export default {
  schemaVersion: 1,
  exclude: ["archstrict.config.ts", "archstrict.types.ts", ".*/**", "**/.*/**", "test/**", "fixtures/**"],
  declaredModules: [
    { name: "facts", glob: "scripts/facts/**" },
    { name: "claims", glob: "scripts/claims/**" },
    { name: "graph", glob: "scripts/graph/**" },
    { name: "facts-cli", glob: "scripts/facts.ts", surface: "facts.ts" },
    { name: "claims-cli", glob: "scripts/claims.ts", surface: "claims.ts" },
    { name: "tools-config", glob: "tools.config.ts", surface: "tools.config.ts" },
    { name: "lib", glob: "src/lib/**", surface: "data.ts" },
    { name: "content-config", glob: "src/content.config.ts", surface: "content.config.ts" },
  ],
  classify: [
    { glob: "scripts/facts/**", tags: ["layer:core"] },
    { glob: "scripts/claims/**", tags: ["layer:core"] },
    { glob: "scripts/graph/**", tags: ["layer:core"] },
    { glob: "tools.config.ts", tags: ["layer:core"] },
    { glob: "src/lib/**", tags: ["layer:site"] },
    { glob: "scripts/facts.ts", tags: ["layer:cli"] },
    { glob: "scripts/claims.ts", tags: ["layer:cli"] },
  ],
  edges: {
    order: [
      {
        tagNamespace: "layer",
        sequence: { "": ["core", "site", "cli"] },
        direction: "downward-only",
        because: "the scanner, the comparison, the facts, and the layout are pure; only a CLI touches files and processes, and page code reads core types but never calls a CLI",
      },
    ],
  },
  strict: ["facts", "claims", "graph", "facts-cli", "claims-cli", "tools-config", "lib", "content-config"],
  because: "Pure cores (facts, claims, graph) sit under thin CLIs and the page data module, so the logic stays testable without files or processes.",
} satisfies Config;
