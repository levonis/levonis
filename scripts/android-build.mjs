#!/usr/bin/env node
/**
 * Android build runner with detailed, timestamped logs.
 *
 * Usage:
 *   node scripts/android-build.mjs              # full: build + sync + gradle assembleDebug
 *   node scripts/android-build.mjs sync         # only: vite build + cap sync
 *   node scripts/android-build.mjs gradle       # only: ./gradlew assembleDebug
 *   node scripts/android-build.mjs release      # full + ./gradlew assembleRelease
 *   node scripts/android-build.mjs doctor       # environment diagnostics only
 *
 * All output is mirrored to console AND saved to:
 *   logs/android-build-<timestamp>.log
 */
import { spawn } from "node:child_process";
import { mkdirSync, createWriteStream, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { platform } from "node:os";

const ROOT = process.cwd();
const LOG_DIR = resolve(ROOT, "logs");
const TS = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_FILE = join(LOG_DIR, `android-build-${TS}.log`);
const IS_WIN = platform() === "win32";

mkdirSync(LOG_DIR, { recursive: true });
const logStream = createWriteStream(LOG_FILE, { flags: "a" });

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function ts() {
  return new Date().toISOString();
}

function write(line, color = null) {
  const plain = `[${ts()}] ${line}\n`;
  logStream.write(plain);
  if (color) process.stdout.write(`${color}${plain}${COLORS.reset}`);
  else process.stdout.write(plain);
}

function header(title) {
  const bar = "═".repeat(Math.max(8, 70 - title.length));
  write("");
  write(`╔═══ ${title} ${bar}`, COLORS.cyan);
}

function section(title) {
  write("");
  write(`▸ ${title}`, COLORS.blue);
}

function ok(msg) { write(`✓ ${msg}`, COLORS.green); }
function warn(msg) { write(`⚠ ${msg}`, COLORS.yellow); }
function err(msg) { write(`✗ ${msg}`, COLORS.red); }

/** Run a command, mirror stdout/stderr to console + log file. */
function run(cmd, args, opts = {}) {
  return new Promise((resolvePromise) => {
    const display = `${cmd} ${args.join(" ")}`;
    const start = Date.now();
    write(`$ ${display}`, COLORS.magenta);

    const child = spawn(cmd, args, {
      cwd: opts.cwd || ROOT,
      shell: IS_WIN, // needed for .cmd shims on Windows (npx, gradlew.bat)
      env: { ...process.env, ...(opts.env || {}) },
    });

    const pipe = (stream, isErr) => {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        logStream.write(text);
        process.stdout.write(text);
        // Capture telltale failure markers for the summary
        if (isErr || /FAILURE|error:|ERROR /i.test(text)) {
          for (const line of text.split("\n")) {
            const t = line.trim();
            if (!t) continue;
            if (/error|failure|exception|cannot|missing|undefined/i.test(t)) {
              CAPTURED_ERRORS.push(t.slice(0, 300));
            }
          }
        }
      });
    };

    pipe(child.stdout, false);
    pipe(child.stderr, true);

    child.on("error", (e) => {
      err(`spawn failed: ${e.message}`);
      resolvePromise({ code: -1, ms: Date.now() - start });
    });

    child.on("close", (code) => {
      const ms = Date.now() - start;
      if (code === 0) ok(`done in ${ms}ms — ${display}`);
      else err(`exit ${code} after ${ms}ms — ${display}`);
      resolvePromise({ code: code ?? -1, ms });
    });
  });
}

const CAPTURED_ERRORS = [];

async function captureVersion(label, cmd, args) {
  const child = spawn(cmd, args, { shell: IS_WIN });
  let out = "";
  child.stdout.on("data", (c) => (out += c));
  child.stderr.on("data", (c) => (out += c));
  await new Promise((r) => {
    child.on("close", r);
    child.on("error", () => r());
  });
  const first = (out.split("\n")[0] || "").trim() || "(not found)";
  write(`  ${label.padEnd(14)} ${first}`, COLORS.dim);
  return first;
}

async function doctor() {
  header("Environment diagnostics");
  section("Versions");
  await captureVersion("node", "node", ["-v"]);
  await captureVersion("npm", "npm", ["-v"]);
  await captureVersion("bun", "bun", ["-v"]);
  await captureVersion("java", "java", ["-version"]);
  await captureVersion("javac", "javac", ["-version"]);
  await captureVersion("adb", "adb", ["--version"]);

  section("Environment variables");
  const envKeys = ["JAVA_HOME", "ANDROID_HOME", "ANDROID_SDK_ROOT", "GRADLE_USER_HOME", "PATH"];
  for (const k of envKeys) {
    const v = process.env[k];
    if (!v) warn(`  ${k.padEnd(18)} (not set)`);
    else write(`  ${k.padEnd(18)} ${k === "PATH" ? v.slice(0, 200) + "…" : v}`, COLORS.dim);
  }

  section("Project layout");
  const checks = [
    ["capacitor.config.ts", existsSync(resolve(ROOT, "capacitor.config.ts"))],
    ["android/", existsSync(resolve(ROOT, "android"))],
    ["android/gradlew", existsSync(resolve(ROOT, "android/gradlew"))],
    ["android/app/build.gradle", existsSync(resolve(ROOT, "android/app/build.gradle"))],
    ["android/local.properties", existsSync(resolve(ROOT, "android/local.properties"))],
    ["dist/", existsSync(resolve(ROOT, "dist"))],
    ["dist/index.html", existsSync(resolve(ROOT, "dist/index.html"))],
  ];
  for (const [name, present] of checks) {
    if (present) ok(`  ${name}`);
    else warn(`  ${name} missing`);
  }

  if (!process.env.JAVA_HOME) {
    warn("JAVA_HOME is not set — Gradle will fail. Install JDK 17 (Adoptium Temurin) and set JAVA_HOME.");
  }
  if (!process.env.ANDROID_HOME && !process.env.ANDROID_SDK_ROOT && !existsSync(resolve(ROOT, "android/local.properties"))) {
    warn("Neither ANDROID_HOME nor android/local.properties found — Gradle will not locate the SDK.");
  }
}

async function step(name, fn) {
  section(name);
  const r = await fn();
  if (r && r.code !== 0) {
    err(`Step failed: ${name}`);
    return false;
  }
  return true;
}

function summarize(success) {
  header("Summary");
  write(`Log file: ${LOG_FILE}`, COLORS.cyan);
  if (CAPTURED_ERRORS.length) {
    section(`Captured ${CAPTURED_ERRORS.length} error/warning line(s)`);
    const unique = [...new Set(CAPTURED_ERRORS)].slice(0, 25);
    unique.forEach((l) => write(`  • ${l}`, COLORS.red));
  } else if (success) {
    ok("No errors detected.");
  }
  if (success) ok("BUILD SUCCESS");
  else err("BUILD FAILED — see log file above for full output.");
}

async function main() {
  const mode = (process.argv[2] || "full").toLowerCase();

  header(`Android build runner — mode: ${mode}`);
  write(`cwd:      ${ROOT}`, COLORS.dim);
  write(`platform: ${platform()}`, COLORS.dim);
  write(`log:      ${LOG_FILE}`, COLORS.dim);

  await doctor();

  if (mode === "doctor") {
    summarize(true);
    return;
  }

  let success = true;
  const gradleCmd = IS_WIN ? "gradlew.bat" : "./gradlew";
  const gradleCwd = resolve(ROOT, "android");

  if (mode === "full" || mode === "sync" || mode === "release") {
    success = await step("Web build (vite)", () => run("npm", ["run", "build"]));
    if (!success) return summarize(false);

    success = await step("Capacitor sync (android)", () => run("npx", ["cap", "sync", "android"]));
    if (!success) return summarize(false);
  }

  if (mode === "gradle" || mode === "full") {
    if (!existsSync(resolve(gradleCwd, IS_WIN ? "gradlew.bat" : "gradlew"))) {
      err("android/gradlew not found — run `npx cap add android` first.");
      return summarize(false);
    }
    success = await step("Gradle assembleDebug", () =>
      run(gradleCmd, ["assembleDebug", "--stacktrace", "--info"], { cwd: gradleCwd }));
  }

  if (mode === "release") {
    success = await step("Gradle assembleRelease", () =>
      run(gradleCmd, ["assembleRelease", "--stacktrace", "--info"], { cwd: gradleCwd }));
  }

  summarize(success);
  process.exit(success ? 0 : 1);
}

main().catch((e) => {
  err(`Unhandled error: ${e?.stack || e?.message || e}`);
  summarize(false);
  process.exit(1);
});
