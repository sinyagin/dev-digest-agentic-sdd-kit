// Install builder output (spec section 8).
import type { SiteIndex } from "../lib/types";

type Marketplace = Pick<SiteIndex["marketplace"], "name" | "repo">;

export function installCommands(m: Marketplace, plugins: string[]): string {
  return [`/plugin marketplace add ${m.repo}`, ...plugins.map((p) => `/plugin install ${p}@${m.name}`)].join("\n");
}

export function projectSettings(m: Marketplace, plugins: string[]): string {
  const settings = {
    extraKnownMarketplaces: {
      [m.name]: { source: { source: "github", repo: m.repo } },
    },
    enabledPlugins: Object.fromEntries(plugins.map((p) => [`${p}@${m.name}`, true])),
  };
  return JSON.stringify(settings, null, 2);
}
