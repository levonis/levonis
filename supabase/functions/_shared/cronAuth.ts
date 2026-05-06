// Shared cron-auth helper for scheduled edge functions.
// Requires the request to carry header `x-cron-secret: <CRON_SECRET>`.
export function requireCron(req: Request, corsHeaders: Record<string, string>): Response | null {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}
