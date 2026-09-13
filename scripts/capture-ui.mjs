import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1120],
    ["mobile", 390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      locale: "fr-BE",
    });
    await page.goto("http://127.0.0.1:8100/evenements");
    await page.locator("app-event-list ion-card").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("app-event-list ion-content")
      .evaluate((content) => content.scrollToTop(0));
    await page.screenshot({ path: "docs/screenshots/ionic-" + name + ".png" });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("Captures ordinateur et mobile générées.");
