// Build-time access to the generated index (see scripts/build-index.mjs).
import raw from "../data/index.json";
import type { Plugin, SiteIndex } from "./types";

export const index = raw as unknown as SiteIndex;

export const pluginByName = (name: string): Plugin | undefined => index.plugins.find((p) => p.name === name);
