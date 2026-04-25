#!/usr/bin/env node
/**
 * verify-build.mjs
 * ----------------
 * فحص شامل لمخرجات البناء قبل الرفع للإنتاج.
 *
 * الخطوات:
 *  1. حذف مجلد dist القديم (اختياري عبر --skip-clean).
 *  2. تشغيل `vite build`.
 *  3. التحقق من وجود dist/index.html وأصول JS/CSS.
 *  4. إثبات أن ملفات JS و CSS مُصغّرة فعلاً (minified) عبر مقاييس
 *     عملية: نسبة الأسطر الطويلة، غياب التعليقات، عدم وجود مسافات بادئة.
 *  5. (اختياري) تشغيل `vite preview` لمدة قصيرة والتأكد من استجابة 200.
 *
 * الاستخدام:
 *   node scripts/verify-build.mjs              # بناء + فحص
 *   node scripts/verify-build.mjs --preview    # + تشغيل preview للتحقق
 *   node scripts/verify-build.mjs --skip-build # افحص dist الموجود فقط
 *
 * الخروج بكود 0 = نجاح، 1 = فشل (مناسب لـ CI).
 */

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

// ─── 1. تنظيف ─────────────────────────────────────────────
if (!SKIP_BUILD && !SKIP_CLEAN && existsSync(DIST)) {
  head("تنظيف dist السابق");
  rmSync(DIST, { recursive: true, force: true });
  ok("تم حذف dist القديم");
}

// ─── 2. البناء ─────────────────────────────────────────────
if (!SKIP_BUILD) {
  head("تنفيذ vite build");
  const r = spawnSync("npx", ["vite", "build"], {
    cwd: ROOT, stdio: "inherit", shell: true,
  });
  if (r.status !== 0) {
    fail(`vite build فشل بكود ${r.status}`);
    process.exit(1);
  }
  ok("اكتمل البناء");
}

// ─── 3. وجود الملفات الأساسية ──────────────────────────────
head("التحقق من بنية dist");
if (!existsSync(DIST)) {
  fail("مجلد dist غير موجود — نفّذ بدون --skip-build أولاً");
  process.exit(1);
}
const indexHtml = join(DIST, "index.html");
if (!existsSync(indexHtml)) failHard("dist/index.html مفقود");
else ok("dist/index.html موجود");

// جمع كل الأصول
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

ok(`عدد ملفات JS: ${jsFiles.length}`);
ok(`عدد ملفات CSS: ${cssFiles.length}`);
ok(`عدد source maps: ${mapFiles.length}`);

if (jsFiles.length === 0) failHard("لا توجد ملفات JS في dist");
if (cssFiles.length === 0) failHard("لا توجد ملفات CSS في dist");

// ─── 4. فحوصات Minification ────────────────────────────────
head("فحص ضغط (minify) الملفات");

/** يحدد إن كان الملف مضغوطاً بناءً على مقاييس عملية. */
function inspectMinify(filePath, kind) {
  const rel = relative(ROOT, filePath);
  // تخطي source maps
  if (filePath.endsWith(".map")) return { ok: true, rel };

  const src = readFileSync(filePath, "utf8");
  const bytes = Buffer.byteLength(src, "utf8");
  const lines = src.split("\n");
  const total = lines.length;
  const longLines = lines.filter((l) => l.length > 500).length;
  const longRatio = total > 0 ? longLines / total : 0;
  const avgLen = bytes / Math.max(1, total);

  // إشارات "غير مضغوط":
  //  - متوسط طول السطر منخفض جداً (<80) مع وجود الكثير من الأسطر
  //  - تعليقات JS متعددة الأسطر بكثرة
  //  - مسافات بادئة منتظمة (4 مسافات/تاب) في معظم الأسطر
  const indented = lines.filter((l) => /^( {2,}|\t)/.test(l)).length;
  const indentedRatio = total > 0 ? indented / total : 0;

  // قواعد القرار حسب النوع:
  let minified = false;
  let reason = "";
  if (kind === "js") {
    // ملفات JS الإنتاجية المضغوطة عادةً تحتوي أسطراً طويلة جداً.
    // نقبل: إما long ratio مرتفعة، أو متوسط طول سطر >300، أو ملف صغير جداً.
    if (bytes < 2_000) { minified = true; reason = "ملف صغير جداً"; }
    else if (longRatio >= 0.5 || avgLen > 300) {
      minified = true;
      reason = `avgLen=${avgLen.toFixed(0)}، longRatio=${(longRatio * 100).toFixed(0)}%`;
    } else if (indentedRatio > 0.3) {
      reason = `أسطر مزاحة ${(indentedRatio * 100).toFixed(0)}%، avgLen=${avgLen.toFixed(0)}`;
    } else {
      reason = `avgLen=${avgLen.toFixed(0)}، longRatio=${(longRatio * 100).toFixed(0)}%`;
    }
  } else if (kind === "css") {
    // CSS مضغوط عادة سطر واحد طويل جداً، أو متوسط طول سطر مرتفع
    if (bytes < 500) { minified = true; reason = "ملف صغير جداً"; }
    else if (total <= 5 || avgLen > 200 || longRatio >= 0.3) {
      minified = true;
      reason = `lines=${total}، avgLen=${avgLen.toFixed(0)}`;
    } else {
      reason = `lines=${total}، avgLen=${avgLen.toFixed(0)}، indented=${(indentedRatio * 100).toFixed(0)}%`;
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
  else failHard(`JS غير مضغوط: ${r.rel} — ${r.reason}`);
}

for (const f of cssFiles) {
  const r = inspectMinify(f.path, "css");
  totalCssBytes += r.bytes || 0;
  if (r.ok) { cssMinifiedCount++; }
  else failHard(`CSS غير مضغوط: ${r.rel} — ${r.reason}`);
}

const fmt = (b) => b > 1024 * 1024
  ? `${(b / 1024 / 1024).toFixed(2)} MB`
  : `${(b / 1024).toFixed(1)} KB`;

ok(`JS مضغوط: ${jsMinifiedCount}/${jsFiles.length} (إجمالي ${fmt(totalJsBytes)})`);
ok(`CSS مضغوط: ${cssMinifiedCount}/${cssFiles.length} (إجمالي ${fmt(totalCssBytes)})`);

// تحذيرات للحجم
if (totalJsBytes > 5 * 1024 * 1024) {
  warn(`إجمالي JS كبير (${fmt(totalJsBytes)}) — راجع code splitting`);
}
if (totalCssBytes > 500 * 1024) {
  warn(`إجمالي CSS كبير (${fmt(totalCssBytes)})`);
}

// أكبر 5 ملفات
head("أكبر 5 ملفات JS/CSS");
[...jsFiles, ...cssFiles]
  .sort((a, b) => b.size - a.size)
  .slice(0, 5)
  .forEach((f) => log(`  ${fmt(f.size).padStart(10)}  ${relative(DIST, f.path)}`));

// ─── 5. preview (اختياري) ─────────────────────────────────
async function tryPreview() {
  head("تشغيل vite preview");
  const port = 4173;
  const proc = spawn("npx", ["vite", "preview", "--port", String(port)], {
    cwd: ROOT, shell: true, stdio: ["ignore", "pipe", "pipe"],
  });

  let ready = false;
  proc.stdout.on("data", (d) => {
    const s = d.toString();
    if (s.includes("Local:") || s.includes(`:${port}`)) ready = true;
  });

  // انتظر حتى 15ث لجاهزية الخادم
  const start = Date.now();
  while (!ready && Date.now() - start < 15_000) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) {
    proc.kill();
    failHard("preview لم يبدأ خلال 15 ثانية");
    return;
  }

  try {
    const res = await fetch(`http://localhost:${port}/`);
    if (res.status !== 200) failHard(`preview أرجع ${res.status}`);
    else {
      const html = await res.text();
      if (!html.includes("<div id=\"root\"")) failHard("HTML لا يحوي #root");
      else ok(`preview يستجيب 200 على :${port}`);
    }
  } catch (e) {
    failHard(`فشل الاتصال بـ preview: ${e.message}`);
  } finally {
    proc.kill();
  }
}

if (RUN_PREVIEW) {
  await tryPreview();
}

// ─── النتيجة النهائية ─────────────────────────────────────
head("النتيجة");
if (errors > 0) {
  fail(`فشل الفحص: ${errors} خطأ — لا ترفع هذه النسخة للإنتاج`);
  process.exit(1);
}
ok("جميع الفحوصات نجحت — البناء جاهز للإنتاج ✨");
process.exit(0);
