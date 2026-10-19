import { describe, expect, it } from "vitest";
import { installCommands, projectSettings } from "./generate";

const m = { name: "dev-digest-agentic-sdd-kit", repo: "sinyagin/dev-digest-agentic-sdd-kit" };

describe("install builder output (IB3)", () => {
  it("generates commands for the selected plugins", () => {
    expect(installCommands(m, ["sdd-kit", "other"])).toBe(
      [
        "/plugin marketplace add sinyagin/dev-digest-agentic-sdd-kit",
        "/plugin install sdd-kit@dev-digest-agentic-sdd-kit",
        "/plugin install other@dev-digest-agentic-sdd-kit",
      ].join("\n"),
    );
  });

  it("generates valid settings JSON with only the selected plugins", () => {
    expect(JSON.parse(projectSettings(m, ["sdd-kit"]))).toEqual({
      extraKnownMarketplaces: {
        "dev-digest-agentic-sdd-kit": { source: { source: "github", repo: "sinyagin/dev-digest-agentic-sdd-kit" } },
      },
      enabledPlugins: { "sdd-kit@dev-digest-agentic-sdd-kit": true },
    });
  });
});
