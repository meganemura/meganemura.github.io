# AGENTS.md

Context for agents that work in this repository.

## What this is

The source of https://meganemura.github.io/, a showcase of the tools in github.com/meganemura.
It is an Astro and Starlight site, English at `/` and Japanese at `/ja/`.
Tool pages live at `/tools/<slug>/` and `/ja/tools/<slug>/`.
Never add a top-level `/<slug>/` page: a tool repository may publish its own GitHub Pages project site at `meganemura.github.io/<slug>/`.

Facts and prose have different sources.
A tool's version, description, bins, license, and dependencies come from the npm registry (`src/generated/tools.json`).
The hand-written prose on a tool page describes the tool from its own README, docs, and skills, and every statement must be traceable to one of them.
A tool page keeps this order: the `ToolFacts` box, a lead paragraph on the problem the tool solves and for whom, `## Features` with four to six bullets that each name the command, flag, or output that delivers the capability, `## How an agent uses it`, `## Getting started` with the README's first commands, and `## Works with` only when the tool's README names another tool on this site.
The Japanese page carries the same content under `## 特徴`, `## エージェントでの使い方`, `## はじめかた`, and `## 組み合わせ`.
Each tool page has a one-sentence frontmatter `description` in its own language. The Japanese tool cards on `/ja/` show that description, and the English cards show the npm description.
Describe what the published npm version does, and leave out a feature that exists only on a tool's main branch.
A sentence that states what a tool does can be tied to a command with `<Claim>`, and a command's real output can be embedded with `<Demo>`.
`npm run claims` runs those commands and fails when a sentence stops being true.

## Commands

- `npm run dev` starts the dev server. `npm run build` writes `dist/`.
- `npm run facts` rewrites `src/generated/tools.json` from the registry. `node scripts/facts.ts --check` fails when the committed file is stale.
- `npm run claims` runs every `<Claim>` and `<Demo>` and rewrites `src/generated/claims.json`. It exits 1 and prints `claim-broken` blocks when a claim fails.
- `npm test` runs vitest. `npm run typecheck` runs `tsc --noEmit`. `npm run archstrict` checks module boundaries.
- `npm run check` runs all of the above except the build. CI runs it before `npm run build`.

## Layout

- `tools.config.ts` is the registry of tools: slug, npm name, repository.
- `scripts/facts/`, `scripts/claims/`, `scripts/graph/` are pure cores. `scripts/facts.ts` and `scripts/claims.ts` are thin CLIs.
- `src/lib/data.ts` reads the generated files for the pages. `src/components/` holds the Astro components.
- `src/content/docs/` holds the pages. `ja/` holds the Japanese pages.
- `fixtures/` holds the small projects that claims run against. They are excluded from tsc, vitest, and the root archstrict check.

## Rules

- This repository is public. Write all committed text in English, except the Japanese pages. Keep personal paths, credentials, and internal working notes out of it.
- Only public tools appear on the site.
- Japanese text is natural Japanese with one sentence per line. Neither language uses an em dash.
- Pin dependencies exactly, each at least 7 days past its release. Ask the owner before adding one.
- Scripts are `.ts` files run directly by Node type stripping, so use erasable syntax only (no `enum`, `namespace`, or parameter properties).
- Write property tests with Hegel where a property exists. Example tests assert literal values.
- Comments say why. Each module starts with its responsibility and its boundary.
- Never write a claim's expected text from memory. Run the tool and copy what it prints.
- `main` is pushed directly. The Deploy workflow publishes the site on every push to `main`.
- Never put a pd issue id into a commit message or a tracked file.
