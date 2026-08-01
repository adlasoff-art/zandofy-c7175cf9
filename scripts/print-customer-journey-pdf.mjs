/**
 * Print the customer journey HTML guide to PDF (A4).
 * Usage (from frontend/): node ../scripts/print-customer-journey-pdf.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const frontendRequire = createRequire(path.join(root, "frontend", "package.json"));
const { chromium } = frontendRequire("playwright");

const htmlPath = path.join(root, "docs", "guides", "parcours-client-paiement-suivi.html");
const pdfPath = path.join(root, "docs", "guides", "Zandofy_Guide_Client_Paiement_Suivi.pdf");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.pdf({
  path: pdfPath,
  format: "A4",
  printBackground: true,
  margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
});
await browser.close();
console.log(`PDF written: ${pdfPath}`);
