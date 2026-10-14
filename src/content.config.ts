// Registers the Starlight docs collection; all content lives in src/content/docs.
import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";

export const collections = { docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }) };
