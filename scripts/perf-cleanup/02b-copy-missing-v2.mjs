#!/usr/bin/env node
/**
 * v2 — copie fiable staging → prod des objets storage référencés par urls.txt.
 *
 * Différences vs v1 :
 *  - check d'existence côté prod via HEAD HTTP sur l'URL publique (déterministe,
 *    pas de fuzzy match comme storage.list({ search }))
 *  - upload avec upsert: true (RLS UPDATE déjà en place sur les buckets concernés)
 *  - log par ligne (présent / copié / échec) avec flush immédiat
 *  - rapport JSON final (./report.json) avec status par URL
 *
 * Usage (PowerShell) :
 *   $env:STAGING_SERVICE_KEY="..."; $env:PROD_SERVICE_KEY="..."
 *   node scripts/perf-cleanup/02b-copy-missing-v2.mjs urls.txt
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const STAGING_URL = "https://wgidwyrdnboivfphwete.supabase.co";
const PROD_URL    = "https://vpttoqojmiqxgudknyxf.supabase.co";

const stagingKey = process.env.STAGING_SERVICE_KEY;
const prodKey    = process.env.PROD_SERVICE_KEY;
if (!stagingKey || !prodKey) {
  console.error("Missing STAGING_SERVICE_KEY or PROD_SERVICE_KEY env vars");
  process.exit(1);
}

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Usage: node 02b-copy-missing-v2.mjs urls.txt");
  process.exit(1);
}

const staging = createClient(STAGING_URL, stagingKey);
const prod    = createClient(PROD_URL,    prodKey);

function parsePath(url) {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

function prodPublicUrl(bucket, path) {
  return `${PROD_URL}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function existsOnProd(bucket, path) {
  try {
    const res = await fetch(prodPublicUrl(bucket, path), { method: "HEAD" });
    return res.status === 200;
  } catch {
    return false;
  }
}

const urls = Array.from(
  new Set(
    readFileSync(inputFile, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("http"))
  )
);

console.log(`Processing ${urls.length} unique URLs...`);

let copied = 0, present = 0, failed = 0;
const report = [];

function log(line) {
  process.stdout.write(line + "\n");
}

for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  const prefix = `[${i + 1}/${urls.length}]`;
  const parsed = parsePath(url);
  if (!parsed) {
    failed++;
    report.push({ url, status: "parse_error" });
    log(`${prefix} PARSE_ERROR ${url}`);
    continue;
  }
  const { bucket, path } = parsed;

  if (await existsOnProd(bucket, path)) {
    present++;
    report.push({ url, bucket, path, status: "present" });
    log(`${prefix} present  ${bucket}/${path}`);
    continue;
  }

  const { data: blob, error: dlErr } = await staging.storage.from(bucket).download(path);
  if (dlErr || !blob) {
    failed++;
    report.push({ url, bucket, path, status: "download_fail", error: dlErr?.message });
    log(`${prefix} DL_FAIL  ${bucket}/${path} :: ${dlErr?.message}`);
    continue;
  }

  const { error: upErr } = await prod.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: true,
  });
  if (upErr) {
    failed++;
    report.push({ url, bucket, path, status: "upload_fail", error: upErr.message });
    log(`${prefix} UP_FAIL  ${bucket}/${path} :: ${upErr.message}`);
    continue;
  }
  copied++;
  report.push({ url, bucket, path, status: "copied", bytes: blob.size });
  log(`${prefix} COPIED   ${bucket}/${path} (${blob.size} B)`);
}

writeFileSync("report.json", JSON.stringify(report, null, 2));
console.log(`\nDone: ${copied} copied, ${present} already present, ${failed} failed.`);
console.log("Detailed report written to report.json");
process.exit(failed > 0 ? 2 : 0);