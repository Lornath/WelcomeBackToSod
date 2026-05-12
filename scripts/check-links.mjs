#!/usr/bin/env node
// Static-HTML invariant checker. No deps.
//
// Verifies, for src/index.html:
//   1. Every TOC <a href="#X"> resolves to an element with id="X".
//   2. Every external <a href="http(s)://..."> has target="_blank" and
//      a rel attribute containing "noopener".
//
// Same-origin links (welcomebacktosod.com) are treated as internal.
// Orphan sections (id present but no TOC link) are reported as warnings
// and do not fail the build.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const htmlPath = resolve(here, "..", "src", "index.html");

const html = await readFile(htmlPath, "utf8");

const errors = [];
const warnings = [];

function lineOf(idx) {
  return html.slice(0, idx).split(/\r?\n/).length;
}

const idRe = /\bid\s*=\s*"([^"]+)"/g;
const allIds = new Set();
for (const m of html.matchAll(idRe)) allIds.add(m[1]);

const tocBlockMatch = html.match(/<aside[^>]*class="sidebar"[\s\S]*?<\/aside>/i);
const tocBlock = tocBlockMatch ? tocBlockMatch[0] : "";
const tocAnchorRe = /<a\s[^>]*href="#([^"]+)"/gi;
const tocTargets = new Set();
if (tocBlock) {
  for (const m of tocBlock.matchAll(tocAnchorRe)) tocTargets.add(m[1]);
}

for (const m of tocBlock.matchAll(tocAnchorRe)) {
  const id = m[1];
  if (id === "" || id === "top") continue;
  if (!allIds.has(id)) {
    errors.push(`TOC link "#${id}" has no matching id in the document.`);
  }
}

// Every <section id>, <h2 id>, and <h3 id> must be reachable from the TOC.
// (h4+ ids are treated as intra-page anchor targets and not enforced.)
const tocCandidateRe = /<(?:section|h2|h3)\s[^>]*\bid\s*=\s*"([^"]+)"/gi;
for (const m of html.matchAll(tocCandidateRe)) {
  const id = m[1];
  if (id === "main" || id === "top") continue;
  if (!tocTargets.has(id)) {
    const line = lineOf(m.index);
    errors.push(`Line ${line}: heading id="${id}" is not referenced from the sidebar TOC.`);
  }
}

const anchorOpenRe = /<a\b([^>]*)>/gis;
for (const m of html.matchAll(anchorOpenRe)) {
  const attrs = m[1];
  const hrefM = /href\s*=\s*"([^"]+)"/i.exec(attrs);
  if (!hrefM) continue;
  const href = hrefM[1];
  if (!/^https?:\/\//i.test(href)) continue;
  if (href.includes("welcomebacktosod.com")) continue;

  const hasTarget = /\btarget\s*=\s*"_blank"/i.test(attrs);
  const relM = /\brel\s*=\s*"([^"]*)"/i.exec(attrs);
  const hasNoopener = relM && /\bnoopener\b/i.test(relM[1]);

  if (!hasTarget || !hasNoopener) {
    const line = lineOf(m.index);
    const issues = [];
    if (!hasTarget) issues.push('missing target="_blank"');
    if (!hasNoopener) issues.push("missing rel=\"noopener\"");
    errors.push(`Line ${line}: external link to ${href} — ${issues.join(", ")}.`);
  }
}

if (warnings.length) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncheck-links: ${errors.length} error(s).`);
  process.exit(1);
}
console.log(`check-links: ok (${allIds.size} ids, ${tocTargets.size} TOC links, ${warnings.length} warning(s)).`);
