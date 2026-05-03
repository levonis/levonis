#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const DIST = join(ROOT, "dist");

const args = new Set(process.argv.slice(2));
const SKIP_BUILD = args.has("--skip-build");
const SKIP_CLEAN = args.has("--skip-clean");
const RUN_PREVIEW = args.has("--preview");

const C = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m",
  yellow: "\x1b[33m", cyan: "\x1b[36m", bold: "\x1b[1m",
};
const log = (m) => console.log(m);
const ok = (m) => log(`${C.green}✔${C.reset} ${m}`);
const warn = (m) => log(`${C.yellow}⚠${C.reset} ${m}`);
const fail = (m) => log(`${C.red}✘${C.reset} ${m}`);
const head = (m) => log(`\n${C.bold}${C.cyan}━━ ${m} ━━${C.reset}`);

let errors = 0;
const failHard = (m) => { fail(m); errors++; };

if (!SKIP_BUILD && !SKIP_CLEAN && existsSync(DIST)) {
  head("clean dist");
  rmSync(DIST, { recursive: true, force: true });
  ok("removed old dist");
}

if (!SKIP_BUILD) {
  head("vite build");
  const r = spawnSync("npx", ["vite", "build"], {
    cwd: ROOT, stdio: "inherit", shell: true,
  });
  if (r.status !== 0) {
    fail(`vite build exit ${r.status}`);
    process.exit(1);
  }
  ok("build complete");
}

head("verify dist structure");
if (!existsSync(DIST)) {
  fail("dist missing");
  process.exit(1);
}
const indexHtml = join(DIST, "index.html");
if (!existsSync(indexHtml)) failHard("dist/index.html missing");
else ok("dist/index.html present");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else out.push({ path: p, size: s.size });
  }
  return out;
}
const all = walk(DIST);
const jsFiles = all.filter((f) => extname(f.path) === ".js");
const cssFiles = all.filter((f) => extname(f.path) === ".css");
const mapFiles = all.filter((f) => f.path.endsWith(".map"));

ok(`js files: ${jsFiles.length}`);
ok(`css files: ${cssFiles.length}`);
ok(`source maps: ${mapFiles.length}`);

if (jsFiles.length === 0) failHard("no JS in dist");
if (cssFiles.length === 0) failHard("no CSS in dist");

head("minify check");

function inspectMinify(filePath, kind) {
  const rel = relative(ROOT, filePath);
  if (filePath.endsWith(".map")) return { ok: true, rel };

  const src = readFileSync(filePath, "utf8");
  const bytes = Buffer.byteLength(src, "utf8");
  const lines = src.split("\n");
  const total = lines.length;
  const longLines = lines.filter((l) => l.length > 500).length;
  const longRatio = total > 0 ? longLines / total : 0;
  const avgLen = bytes / Math.max(1, total);

  const indented = lines.filter((l) => /^( {2,}|\t)/.test(l)).length;
  const indentedRatio = total > 0 ? indented / total : 0;

  let minified = false;
  let reason = "";
  if (kind === "js") {
    if (bytes < 2_000) { minified = true; reason = "tiny"; }
    else if (longRatio >= 0.5 || avgLen > 300) {
      minified = true;
      reason = `avgLen=${avgLen.toFixed(0)}, longRatio=${(longRatio * 100).toFixed(0)}%`;
    } else if (indentedRatio > 0.3) {
      reason = `indented=${(indentedRatio * 100).toFixed(0)}%, avgLen=${avgLen.toFixed(0)}`;
    } else {
      reason = `avgLen=${avgLen.toFixed(0)}, longRatio=${(longRatio * 100).toFixed(0)}%`;
    }
  } else if (kind === "css") {
    if (bytes < 500) { minified = true; reason = "tiny"; }
    else if (total <= 5 || avgLen > 200 || longRatio >= 0.3) {
      minified = true;
      reason = `lines=${total}, avgLen=${avgLen.toFixed(0)}`;
    } else {
      reason = `lines=${total}, avgLen=${avgLen.toFixed(0)}, indented=${(indentedRatio * 100).toFixed(0)}%`;
    }
  }

  return { ok: minified, rel, bytes, reason, total, avgLen, longRatio };
}

let totalJsBytes = 0, totalCssBytes = 0;
let jsMinifiedCount = 0, cssMinifiedCount = 0;

for (const f of jsFiles) {
  const r = inspectMinify(f.path, "js");
  totalJsBytes += r.bytes || 0;
  if (r.ok) { jsMinifiedCount++; }
  else failHard(`JS not minified: ${r.rel} - ${r.reason}`);
}

for (const f of cssFiles) {
  const r = inspectMinify(f.path, "css");
  totalCssBytes += r.bytes || 0;
  if (r.ok) { cssMinifiedCount++; }
  else failHard(`CSS not minified: ${r.rel} - ${r.reason}`);
}

const fmt = (b) => b > 1024 * 1024
  ? `${(b / 1024 / 1024).toFixed(2)} MB`
  : `${(b / 1024).toFixed(1)} KB`;

ok(`JS minified: ${jsMinifiedCount}/${jsFiles.length} (total ${fmt(totalJsBytes)})`);
ok(`CSS minified: ${cssMinifiedCount}/${cssFiles.length} (total ${fmt(totalCssBytes)})`);

if (totalJsBytes > 5 * 1024 * 1024) {
  warn(`JS bundle large (${fmt(totalJsBytes)})`);
}
if (totalCssBytes > 500 * 1024) {
  warn(`CSS bundle large (${fmt(totalCssBytes)})`);
}

head("top 5 files");
[...jsFiles, ...cssFiles]
  .sort((a, b) => b.size - a.size)
  .slice(0, 5)
  .forEach((f) => log(`  ${fmt(f.size).padStart(10)}  ${relative(DIST, f.path)}`));

async function tryPreview() {
  head("vite preview");
  const port = 4173;
  const proc = spawn("npx", ["vite", "preview", "--port", String(port)], {
    cwd: ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  proc.stdout.on("data", (d) => {
    const s = d.toString();
    if (s.includes("Local:") || s.includes(`:${port}`)) ready = true;
  });

  const start = Date.now();
  while (!ready && Date.now() - start < 15_000) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    proc.kill();
    failHard("preview did not start in 15s");
    return;
  }

  try {
    const res = await fetch(`http://localhost:${port}/`);
    if (res.status !== 200) failHard(`preview returned ${res.status}`);
    else {
      const html = await res.text();
      if (!html.includes("<div id=\"root\"")) failHard("HTML missing #root");
      else ok(`preview 200 on :${port}`);
    }
  } catch (e) {
    failHard(`preview fetch failed: ${e.message}`);
  } finally {
    proc.kill();
  }
}

if (RUN_PREVIEW) {
  await tryPreview();
}

head("result");
if (errors > 0) {
  fail(`failed: ${errors} error(s)`);
  process.exit(1);
}
ok("all checks passed");
process.exit(0);
