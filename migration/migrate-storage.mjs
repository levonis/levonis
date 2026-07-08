#!/usr/bin/env node
// migration/migrate-storage.mjs
// ينسخ كل buckets والملفات من المشروع القديم إلى الجديد.
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, ".env.migration") });

const {
  OLD_SUPABASE_URL,
  OLD_SUPABASE_ANON_KEY,
  OLD_ADMIN_EMAIL,
  OLD_ADMIN_PASSWORD,
  NEW_SUPABASE_URL,
  NEW_SUPABASE_SERVICE_KEY,
} = process.env;

const oldClient = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
await oldClient.auth.signInWithPassword({ email: OLD_ADMIN_EMAIL, password: OLD_ADMIN_PASSWORD });

const newClient = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: buckets, error: bErr } = await oldClient.storage.listBuckets();
if (bErr) { console.error("❌ list buckets:", bErr.message); process.exit(1); }
console.log(`📦 ${buckets.length} buckets`);

async function listAll(client, bucket, prefix = "") {
  const all = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 1000, offset, sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(error.message);
    for (const item of data) {
      if (item.id === null) {
        // folder
        const sub = await listAll(client, bucket, prefix ? `${prefix}/${item.name}` : item.name);
        all.push(...sub);
      } else {
        all.push(prefix ? `${prefix}/${item.name}` : item.name);
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return all;
}

for (const bucket of buckets) {
  console.log(`\n🪣 ${bucket.name} (public=${bucket.public})`);
  await newClient.storage.createBucket(bucket.name, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit,
    allowedMimeTypes: bucket.allowed_mime_types,
  }).catch(() => {});

  let paths = [];
  try { paths = await listAll(oldClient, bucket.name); }
  catch (e) { console.error(`  ❌ list: ${e.message}`); continue; }

  console.log(`  📁 ${paths.length} files`);
  let ok = 0, fail = 0;
  for (const path of paths) {
    try {
      const { data: blob, error: dErr } = await oldClient.storage.from(bucket.name).download(path);
      if (dErr || !blob) throw new Error(dErr?.message || "empty");
      const buf = Buffer.from(await blob.arrayBuffer());
      const { error: uErr } = await newClient.storage.from(bucket.name).upload(path, buf, {
        contentType: blob.type, upsert: true,
      });
      if (uErr) throw new Error(uErr.message);
      ok++;
      if (ok % 20 === 0) process.stdout.write(`\r  ${ok}/${paths.length}`);
    } catch (e) {
      fail++;
      console.error(`\r  ❌ ${path}: ${e.message}`);
    }
  }
  console.log(`\r  ✅ ${ok} uploaded, ${fail} failed`);
}
