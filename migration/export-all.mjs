#!/usr/bin/env node
// migration/export-all.mjs
// يصدّر كل جدول من Lovable Cloud إلى ملف JSON.
// Usage: node migration/export-all.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env.migration") });

const {
  OLD_SUPABASE_URL,
  OLD_SUPABASE_ANON_KEY,
  OLD_ADMIN_EMAIL,
  OLD_ADMIN_PASSWORD,
  DATA_DIR = "./migration/data",
  PAGE_SIZE = "1000",
  SKIP_TABLES = "",
} = process.env;

if (!OLD_SUPABASE_URL || !OLD_SUPABASE_ANON_KEY || !OLD_ADMIN_EMAIL || !OLD_ADMIN_PASSWORD) {
  console.error("❌ املأ migration/.env.migration أولاً");
  process.exit(1);
}

const pageSize = parseInt(PAGE_SIZE, 10);
const skip = new Set(SKIP_TABLES.split(",").map((s) => s.trim()).filter(Boolean));

const tables = JSON.parse(readFileSync(join(__dirname, "tables.json"), "utf8"));
const dataDir = join(process.cwd(), DATA_DIR);
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const supabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);

console.log("🔑 تسجيل دخول admin...");
const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
  email: OLD_ADMIN_EMAIL,
  password: OLD_ADMIN_PASSWORD,
});
if (signErr || !signIn?.session) {
  console.error("❌ فشل تسجيل الدخول:", signErr?.message);
  process.exit(1);
}
const token = signIn.session.access_token;
console.log("✅ تم الدخول\n");

const seen = new Set();
let totalRows = 0;
let failedTables = [];

for (const table of tables) {
  if (seen.has(table)) continue;
  seen.add(table);
  if (skip.has(table)) {
    console.log(`⏭️  skip ${table}`);
    continue;
  }

  const outFile = join(dataDir, `${table}.json`);
  const allRows = [];
  let offset = 0;

  try {
    while (true) {
      const res = await fetch(`${OLD_SUPABASE_URL}/functions/v1/admin-export-table`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": OLD_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ table, offset, limit: pageSize }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const rows = json.rows || [];
      allRows.push(...rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
      process.stdout.write(`\r  ${table}: ${allRows.length}/${json.total}`);
    }
    writeFileSync(outFile, JSON.stringify(allRows));
    totalRows += allRows.length;
    console.log(`\r✅ ${table}: ${allRows.length} rows                          `);
  } catch (e) {
    console.error(`\r❌ ${table}: ${e.message}`);
    failedTables.push(table);
  }
}

console.log(`\n📦 اكتمل التصدير: ${totalRows} صف عبر ${seen.size} جدول`);
if (failedTables.length) {
  console.warn(`⚠️  فشل ${failedTables.length} جدول:`, failedTables.join(", "));
  process.exit(1);
}
