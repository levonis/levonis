#!/usr/bin/env node
// migration/import-all.mjs
// يستورد كل ملفات JSON إلى المشروع الجديد.
// Usage: node migration/import-all.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env.migration") });

const {
  NEW_SUPABASE_URL,
  NEW_SUPABASE_SERVICE_KEY,
  DATA_DIR = "./migration/data",
} = process.env;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_KEY) {
  console.error("❌ املأ NEW_SUPABASE_URL و NEW_SUPABASE_SERVICE_KEY في .env.migration");
  process.exit(1);
}

const tables = JSON.parse(readFileSync(join(__dirname, "tables.json"), "utf8"));
const dataDir = join(process.cwd(), DATA_DIR);
if (!existsSync(dataDir)) {
  console.error(`❌ مجلد البيانات غير موجود: ${dataDir} — شغّل export-all.mjs أولاً`);
  process.exit(1);
}

const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CHUNK = 500;
const seen = new Set();
let totalInserted = 0;
let failedTables = [];

for (const table of tables) {
  if (seen.has(table)) continue;
  seen.add(table);
  const file = join(dataDir, `${table}.json`);
  if (!existsSync(file)) {
    console.log(`⏭️  ${table}: no data file`);
    continue;
  }
  const rows = JSON.parse(readFileSync(file, "utf8"));
  if (!rows.length) {
    console.log(`⏭️  ${table}: empty`);
    continue;
  }

  let inserted = 0;
  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).upsert(chunk, {
        onConflict: "id",
        ignoreDuplicates: false,
      });
      if (error) throw new Error(error.message);
      inserted += chunk.length;
      process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
    }
    totalInserted += inserted;
    console.log(`\r✅ ${table}: ${inserted} rows                        `);
  } catch (e) {
    console.error(`\r❌ ${table}: ${e.message}`);
    failedTables.push({ table, error: e.message });
  }
}

console.log(`\n📥 اكتمل الاستيراد: ${totalInserted} صف`);
if (failedTables.length) {
  console.warn(`⚠️  فشل ${failedTables.length} جدول:`);
  failedTables.forEach(({ table, error }) => console.warn(`   • ${table}: ${error}`));
  console.warn(`\n💡 نصائح:`);
  console.warn(`   - جداول بلا عمود 'id': عدّل onConflict يدوياً`);
  console.warn(`   - أخطاء FK: أعد التشغيل — بعض الجداول قد تحتاج ترتيباً آخر`);
  process.exit(1);
}
