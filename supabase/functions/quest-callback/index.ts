// Public proxy that forwards a quest token to the main app's verify endpoint
// while keeping QUEST_VERIFY_SECRET hidden on the server.
const MAIN_APP_URL = "https://project--44f4f23a-f52e-4dba-9203-5fb4d9be4e92.lovable.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, authorization, x-client-info, apikey",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: cors });
  }
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "missing token" }), { status: 400, headers: cors });
    }
    const secret = Deno.env.get("QUEST_VERIFY_SECRET");
    if (!secret) {
      return new Response(JSON.stringify({ error: "server misconfigured" }), { status: 500, headers: cors });
    }
    const res = await fetch(`${MAIN_APP_URL}/api/public/quest-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-quest-secret": secret,
      },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    return new Response(JSON.stringify(data), { status: res.status, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? "failed" }), { status: 500, headers: cors });
  }
});
