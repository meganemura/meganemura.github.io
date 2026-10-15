import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import { sectionOf, sections, tools } from "./tools.config.ts";

// One sidebar group per home page section, in the same order, with the pages sorted by slug.
// A section with no entries yet gets no group.
const toolGroups = sections.map((section) => ({
  label: section.label.en,
  translations: { ja: section.label.ja },
  items: tools
    .filter((tool) => sectionOf(tool) === section.id)
    .map((tool) => tool.slug)
    .sort()
    .map((slug) => `tools/${slug}`),
})).filter((group) => group.items.length > 0);

// The cross-use log sits above the tool groups, since it is about all of them.
const sidebar = ["dogfooding", ...toolGroups];

export default defineConfig({
  site: "https://meganemura.github.io",
  integrations: [
    starlight({
      title: "meganemura/*",
      defaultLocale: "root",
      locales: {
        root: { label: "English", lang: "en" },
        ja: { label: "日本語", lang: "ja" },
      },
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/meganemura" }],
      sidebar,
      customCss: ["./src/styles/site.css"],
      pagefind: false,
      components: { Header: "./src/components/Header.astro" },
    }),
  ],
});
