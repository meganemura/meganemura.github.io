import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

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
      sidebar: [
        {
          label: "Tools",
          translations: { ja: "ツール" },
          items: [{ autogenerate: { directory: "tools" } }],
        },
      ],
      customCss: ["./src/styles/site.css"],
      pagefind: false,
      components: { Header: "./src/components/Header.astro" },
    }),
  ],
});
