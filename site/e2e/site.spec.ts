import { expect, test } from "@playwright/test";

const firstCard = (page) => page.locator("#results .card").first();

test("S2: natural-language query finds run-plan first", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("searchbox").fill("I need a skill to run an implementation plan");
  await expect(firstCard(page).locator(".card-title")).toHaveText("run-plan");
  await expect(firstCard(page).locator("mark").first()).toBeVisible();
  await expect(page).toHaveURL(/\?q=/);
});

test("S4: empty state and recovery", async ({ page }) => {
  await page.goto("./?q=zzzqqq");
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator("#empty-text")).toContainText("zzzqqq");
  await page.getByRole("button", { name: "Show all artifacts" }).click();
  await expect(page.locator("#results .card")).not.toHaveCount(0);
  await expect(page).not.toHaveURL(/\?/);
});

test("URL state is restored and filters update it", async ({ page }) => {
  await page.goto("./?q=retrospective&type=skill");
  await expect(page.getByRole("searchbox")).toHaveValue("retrospective");
  await expect(page.locator('[data-type="skill"]')).toHaveAttribute("aria-pressed", "true");
  await expect(firstCard(page).locator(".card-title")).toHaveText("workflow-retro");
  await page.locator('[data-type=""]').click();
  await expect(page).toHaveURL(/\?q=retrospective$/);
});

test("keyboard: / focuses search, Escape clears it", async ({ page }) => {
  await page.goto("./");
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.keyboard.type("hello");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("searchbox")).toHaveValue("");
});

test("IB1: add plugin updates the counter and the install builder", async ({ page }) => {
  await page.goto("./?q=run-plan");
  await expect(page.locator("#install-count")).toBeHidden();
  await firstCard(page).getByRole("button", { name: "+ Add plugin" }).click();
  await expect(page.locator("#install-count")).toHaveText("1");
  await expect(firstCard(page).getByRole("button", { name: "✓ Added" })).toBeVisible();

  await page.getByRole("link", { name: /Install builder/ }).click();
  await expect(page.locator("#out-commands")).toContainText("/plugin install sdd-engineering@dev-digest-agentic-sdd-kit");
  await page.getByRole("tab", { name: "Project settings" }).click();
  const json = JSON.parse((await page.locator("#out-settings").textContent()) ?? "");
  expect(json.enabledPlugins).toEqual({ "sdd-engineering@dev-digest-agentic-sdd-kit": true });

  await page.getByRole("button", { name: "Copy" }).click();
  expect(JSON.parse(await page.evaluate(() => navigator.clipboard.readText()))).toEqual(json);
});

test("IB2: empty builder disables copy", async ({ page }) => {
  await page.goto("install/");
  await expect(page.locator("#builder-empty")).toBeVisible();
  await expect(page.locator("#copy-output")).toBeDisabled();
});

test("artifact page renders details and copies the invocation", async ({ page }) => {
  await page.goto("a/sdd-engineering/skill/run-plan/");
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("run-plan");
  await expect(page.locator(".prose")).toContainText("Take an approved Implementation Plan");
  await page.getByRole("button", { name: "Copy invocation" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("/sdd-engineering:run-plan");
});
