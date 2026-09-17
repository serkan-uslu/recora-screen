import { expect, test } from "@playwright/test";

test("MCP onboarding and download remain accessible on desktop and mobile", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Edit less.");
    if (width === 1280) {
      await expect(page.locator('[data-placement="header-repository"]')).toHaveAttribute(
        "href",
        "https://github.com/serkan-uslu/recora-screen",
      );
      await expect(page.locator('[data-placement="hero-download"]')).toBeVisible();
      await expect(page.locator('[data-placement="hero-mcp"]')).toHaveText(
        /Connect Claude \+ Codex/,
      );
      await page.getByRole("link", { name: "Features" }).click();
      await expect(page.getByRole("link", { name: "Features" })).toHaveAttribute(
        "aria-current",
        "location",
      );
    } else {
      const menu = page.getByRole("button", { name: "Menu" });
      await expect(menu).toBeVisible();
      await menu.click();
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      await expect(page.locator('[data-placement="mobile-nav-download"]')).toBeVisible();
      await menu.click();
    }
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
    await expect(page.locator('[data-placement="github"]')).toHaveAttribute(
      "href",
      "https://github.com/serkan-uslu",
    );
    await expect(page.locator('[data-placement="linkedin"]')).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/serkan-uslu",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("documentation shares the site layout and covers the creator workflow", async ({ page }) => {
  await page.goto("/documentation/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Documentation.");
  await expect(page.getByRole("link", { name: "Recora Screen home" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Docs" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Record your first take." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect Claude or Codex." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your projects remain yours." })).toBeVisible();
  await expect(page.locator(".docs-section pre code").first()).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  for (const heading of [
    "Move clips and insert media",
    "Start with an existing video",
    "Your first edit",
    "Arrows and privacy covers",
    "Imported audio",
    "Cursor and camera effects",
  ]) {
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByText(/GIF supports up to 60 seconds/)).toBeVisible();
  await expect(page.getByText(/Videos support MP4, MOV and M4V up to 2 GB/)).toBeVisible();
  await expect(page.getByText(/Use Restore deleted footage at playhead/)).toBeVisible();
});
