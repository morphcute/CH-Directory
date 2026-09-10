import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  async function check(label) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const summary = violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        reason: n.failureSummary,
      })),
    }));
    assert.deepEqual(summary, [], `${label}: accessibility violations`);
    console.log(`PASS: ${label} automated WCAG A/AA audit`);
  }
  await page.goto("http://localhost:3101", { waitUntil: "networkidle" });
  await check("Desktop directory");
  await page.setViewportSize({ width: 390, height: 844 });
  await check("Mobile directory");
  await page.goto("http://localhost:3101/admin", { waitUntil: "networkidle" });
  await check("Organizer sign-in");
  await page.getByLabel("Organizer password").fill("local-audit-password-only");
  await page.getByRole("button", { name: "Enter organizer workspace" }).click();
  await page
    .getByRole("heading", { name: "A great community starts here." })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await check("Organizer workspace");
} finally {
  await browser.close();
}
