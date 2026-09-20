import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const { chromium } = require("playwright");

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console:" + m.text());
});

await page.goto("https://www.zandofy.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
const html = await page.content();
const match = html.match(/assets\/CheckoutPage-[A-Za-z0-9_-]+\.js/);
console.log("checkoutChunk", match ? match[0] : null);
if (match) {
  const res = await page.goto("https://www.zandofy.com/" + match[0], { timeout: 60000 });
  console.log("chunkStatus", res.status());
  const text = await res.text();
  console.log("hasMobileBack", text.includes("MobileBackButton") || text.includes("general.back"));
  console.log("hasCartLoading", text.includes("loadingCart") || text.includes("Chargement du panier"));
  console.log("has1_11", text.includes("1.11.0"));
}

await page.goto("https://www.zandofy.com/checkout", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1500);
const oops = await page.getByText("Oups").count();
const login = await page.getByText("Connexion requise").count();
console.log({ oops, login, errs: errs.slice(0, 15) });
await browser.close();
