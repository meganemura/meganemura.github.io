import type { Config } from "./archstrict.types.js";

// Public surface: other modules may import a directory module only through
// its own surface file (named by `surface` below), or through the files its own
// package.json exports map names. An import that reaches any other file in
// the directory is a violation. A directory module with no such file is
// entirely private. A module whose glob names one file is that file, so its
// entry names the file itself as its surface.
export default {
  schemaVersion: 1,
  surface: ["index.ts", "index.tsx", "index.mts", "index.cts"],
  // Kept out of analysis entirely:
  // - archstrict's own two files, which are never module content;
  // - hidden directories at any depth (.git, tool state), which tsc's own
  //   default include also skips;
  exclude: [
    "archstrict.config.ts",
    "archstrict.types.ts",
    ".*/**",
    "**/.*/**",
  ],
  // init declared one module per directory that holds TypeScript source and
  // one per TypeScript source file, so every file that check analyzes
  // belongs to exactly one module. This inventory is not a target
  // architecture: group files that change together (glob may be an array of
  // file paths in one directory), split a directory that holds unrelated
  // seams, then add an edges rule. Merge, rename, or remove entries freely:
  // init never rewrites this file. After an edit, run archstrict init to
  // regenerate archstrict.types.ts.
  declaredModules: [
    // Each directory and TypeScript source file directly in src/.
    { name: "app", glob: "src/app/**" },
    { name: "billing", glob: "src/billing/**" },
  ],
  because: "archstrict init: one module per directory that holds TypeScript source and per TypeScript source file, so the first check covers every file it analyzes. This inventory is not a target architecture: name seams that change together, then add edges",
} satisfies Config;
