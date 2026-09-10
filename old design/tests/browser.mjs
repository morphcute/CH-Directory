import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir(".audit", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const base = "http://localhost:3101";
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let original;
try {
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.getByRole("navigation").count(), 0);
  assert.equal(await page.getByRole("searchbox").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: /saved|how it works|refine|tournaments/i })
      .count(),
    0,
  );
  assert.equal(await page.getByRole("radio").count(), 0);
  await page.getByRole("link", { name: "Admin panel" }).waitFor();
  assert.ok(
    await page.getByRole("button", { name: "Full slots for KIX" }).isDisabled(),
  );
  let result = await page.request.get(`${base}/api/register?id=p-25`);
  assert.equal(result.status(), 409);
  assert.equal((await result.json()).url, undefined);
  result = await page.request.get(`${base}/api/register?id=p-34`);
  assert.equal(result.status(), 200);
  assert.ok((await result.json()).url.startsWith("https://"));
  result = await page.request.post(`${base}/api/app-state`, {
    data: { players: [] },
  });
  assert.equal(result.status(), 401);
  await page.screenshot({
    path: ".audit/simple-directory-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow at ${width}`,
    );
    await page.getByRole("link", { name: "Admin panel" }).waitFor();
    await page.screenshot({
      path: `.audit/simple-directory-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.getByLabel("Organizer password").fill("local-audit-password-only");
  await page.getByRole("button", { name: "Enter organizer workspace" }).click();
  await page
    .getByRole("heading", { name: "A great community starts here." })
    .waitFor();
  original = await (await page.request.get(`${base}/api/app-state`)).json();
  const publicPage = await context.newPage();
  await publicPage.goto(base, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Edit Meg", exact: true }).click();
  await page.getByLabel("Teams registered", { exact: true }).fill("16");
  await page.getByRole("button", { name: "Save to draft" }).click();
  await page.getByRole("button", { name: "Publish changes" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your directory is published" })
    .waitFor();
  // The other tab still has the old open button: the server must reject it.
  await publicPage.getByRole("button", { name: "Register with Meg" }).click();
  await publicPage
    .getByRole("alert")
    .filter({ hasText: "not accepting registrations" })
    .waitFor();
  assert.ok(
    await publicPage
      .getByRole("button", { name: "Full slots for Meg" })
      .isDisabled(),
  );
  assert.equal(publicPage.url(), `${base}/`);
  await page.getByLabel("Show Tigz in public directory").uncheck();
  await page.getByRole("button", { name: "Publish changes" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Your directory is published" })
    .waitFor();
  await publicPage.reload({ waitUntil: "networkidle" });
  assert.equal(await publicPage.locator('[data-ch="Tigz"]').count(), 0);
  assert.equal(
    (await page.request.get(`${base}/api/register?id=p-24`)).status(),
    404,
  );
  await page.getByRole("button", { name: "Sheet & sources" }).click();
  await page.getByLabel("Master spreadsheet link", { exact: true }).waitFor();
  await page.getByText("Paste directly from a spreadsheet").click();
  await page
    .getByLabel("Spreadsheet data", { exact: true })
    .fill(
      "Active\tArea\tFull name\tNickname\tTeams\tRegistration link\tResponse sheet\n1\tLaguna\tTest Organizer\tTest Hero\t1/16\thttps://forms.gle/example\t",
    );
  await page.getByRole("button", { name: "Preview pasted data" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  const restored = await page.request.post(`${base}/api/app-state`, {
    data: original,
  });
  assert.equal(restored.status(), 200);
  original = null;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Welcome back, Hero." }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: simplified CH list, full-slot blocking, stale-page registration rejection, admin visibility selection, master sheet controls, import preview, responsive layouts, and zero runtime errors.",
  );
} finally {
  if (original)
    await page.request.post(`${base}/api/app-state`, { data: original });
  await browser.close();
}
