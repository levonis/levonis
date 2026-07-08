#!/usr/bin/env bash
# migration/deploy-functions.sh
# ينشر كل edge functions إلى المشروع الجديد.
set -e

PROJECT_REF="${NEW_PROJECT_REF:-iwbvyyjmhrrudkjjqaks}"

if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI غير مثبت. ثبّته: npm i -g supabase"
  exit 1
fi

echo "🚀 نشر Edge Functions على $PROJECT_REF"
echo ""

FAILED=()
while read -r fn; do
  [ -z "$fn" ] && continue
  echo "📤 $fn"
  if supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt 2>&1 | tail -3; then
    echo "   ✅"
  else
    echo "   ❌"
    FAILED+=("$fn")
  fi
  echo ""
done < migration/functions.txt

if [ ${#FAILED[@]} -eq 0 ]; then
  echo "🎉 نُشرت كل الدوال بنجاح"
else
  echo "⚠️  فشلت: ${FAILED[*]}"
  exit 1
fi
