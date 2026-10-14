# meganemura.github.io

The source of [meganemura.github.io](https://meganemura.github.io/), a showcase of the command-line tools in [github.com/meganemura](https://github.com/meganemura).
It is built with Astro and Starlight, in English and Japanese.

## Facts come from npm

`tools.config.ts` lists each tool's slug, npm name, and repository, and nothing else.
`npm run facts` reads the latest version of each package from the npm registry and writes `src/generated/tools.json`.
The pages render version, description, install command, and repository from that file.
A daily workflow runs `node scripts/facts.ts --check`, which fails when a tool has a newer release than the committed file.

## Claims that run

A sentence on a page can be tied to a command:

```mdx
<Claim tool="archstrict" run="archstrict check" cwd="fixtures/archstrict-bypass" exit={1} includes={["public-surface-bypass"]}>
  archstrict reports that import as `public-surface-bypass`.
</Claim>

<Demo tool="archstrict" run="archstrict check" cwd="fixtures/archstrict-bypass" exit={1} />
```

Only string, number, and array-of-string literals are allowed as attributes.
`npm run claims` finds every claim, runs each distinct command once in its `cwd` against the tools installed in `node_modules`, and compares the exit code and the `includes` text.
It records the result and the installed tool version in `src/generated/claims.json`.
`<Claim>` shows a small "checked with" mark and `<Demo>` shows the recorded output.
When a claim fails, the command exits 1 and prints the page, line, evidence, reason, and fix.

## Commands

```sh
npm ci
npm run dev       # dev server
npm run check     # typecheck, tests, archstrict, facts --check, claims
npm run build     # writes dist/
npm run facts     # refresh src/generated/tools.json
npm run claims    # refresh src/generated/claims.json
```

Node 24 or newer is required. See [AGENTS.md](AGENTS.md) for the repository rules.

## License

MIT
