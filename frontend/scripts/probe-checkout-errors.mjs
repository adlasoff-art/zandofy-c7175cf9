import { chromium } from "playwright";

const url = process.argv[2] || "https://www.zandofy.com/";

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}\n${err.stack || ""}`));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`);
});

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
const swText = await page.evaluate(async () => {
  const r = await fetch("/sw.js");
  const t = await r.text();
  return t.split("\n").slice(0, 8).join("\n");
});
console.log("SW head:\n", swText);

const versionHint = await page.evaluate(() => {
  // Try to find version in any script text is heavy; check localStorage / window
  return {
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    controller: !!navigator.serviceWorker?.controller,
  };
});
console.log("PWA hint:", versionHint);

await page.goto(url.replace(/\/$/, "") + "/checkout", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(2000);
const bodyText = await page.locator("body").innerText();
console.log("Checkout body snippet:", bodyText.slice(0, 400).replace(/\s+/g, " "));
console.log("Errors:", errors.slice(0, 20));
await browser.close();
