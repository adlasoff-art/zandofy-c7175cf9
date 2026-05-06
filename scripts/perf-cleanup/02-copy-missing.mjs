#!/usr/bin/env node
/**
 * Copie les objets storage manquants depuis le projet STAGING (wgidwyrdnboivfphwete)
 * vers le projet PROD (vpttoqojmiqxgudknyxf), en conservant exactement le même
 * bucket + path. À lancer UNIQUEMENT si 02-audit + storage check montrent que
 * certains objets référencés n'existent pas côté prod.
 *
 * Usage:
 *   STAGING_SERVICE_KEY=... PROD_SERVICE_KEY=... node 02-copy-missing.mjs urls.txt
 *
 * urls.txt = une URL legacy par ligne (sortie de 01-audit.sql).
 *
 * Sécurité : ce script ne touche AUCUNE donnée applicative. Il fait uniquement
 * un GET côté staging + un upload côté prod. Idempotent (skip si déjà présent).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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
  console.error("Usage: node 02-copy-missing.mjs urls.txt");
  process.exit(1);
}

const staging = createClient(STAGING_URL, stagingKey);
const prod    = createClient(PROD_URL,    prodKey);

function parsePath(url) {
  // .../storage/v1/object/public/<bucket>/<path>
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
  if (!m) return null;
  return { bucket: m[1], path: decodeURIComponent(m[2]) };
}

const urls = readFileSync(inputFile, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("http"));

let copied = 0, skipped = 0, failed = 0;

for (const url of urls) {
  const parsed = parsePath(url);
  if (!parsed) { console.warn("skip (no parse):", url); failed++; continue; }
  const { bucket, path } = parsed;

  // 1) check existence côté prod
  const { data: head } = await prod.storage.from(bucket).list(path.split("/").slice(0, -1).join("/"), {
    search: path.split("/").pop(),
  });
  if (head && head.some((f) => f.name === path.split("/").pop())) {
    skipped++; continue;
  }

  // 2) download depuis staging
  const { data: blob, error: dlErr } = await staging.storage.from(bucket).download(path);
  if (dlErr || !blob) { console.error("download fail:", path, dlErr?.message); failed++; continue; }

  // 3) upload vers prod (mêmes path/contentType)
  const { error: upErr } = await prod.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    upsert: false,
  });
  if (upErr) { console.error("upload fail:", path, upErr.message); failed++; continue; }
  copied++;
  console.log("copied:", bucket, path);
}

console.log(`\nDone: ${copied} copied, ${skipped} skipped, ${failed} failed.`);
process.exit(failed > 0 ? 2 : 0);