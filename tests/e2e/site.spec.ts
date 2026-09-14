import { expect, test } from "@playwright/test";

test("MCP onboarding and download remain accessible on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Edit less.");
    await page.locator('[data-placement="hero-mcp-card"]').click();
    await expect(page).toHaveURL(/#mcp$/);
    for (const client of ["codex", "claude-code", "claude-desktop"]) {
      await expect(page.locator(`[data-placement="${client}"]`)).toHaveAttribute(
        "href",
        new RegExp(`/docs/mcp.md#${client}$`),
      );
    }
    const question = page.getByText("Does my recording leave my Mac?", { exact: true });
    await question.click();
    await expect(question.locator("..")).toHaveAttribute("open", "");
    await expect(page.locator("[data-download]").first()).toHaveAttribute("href", /\.dmg$/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("documentation shares the site layout and covers both audiences", async ({ page }) => {
  await page.goto("/documentation/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentation.");
  await expect(page.getByRole("link", { name: "Screen Recorder home" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Record your first take." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect Claude or Codex." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Understand the architecture." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Documentation ↗" })).toBeVisible();
});
