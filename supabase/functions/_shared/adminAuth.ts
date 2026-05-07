// ============= Centralized auth helpers for edge functions =============
// Use these to enforce a consistent admin / authenticated-user gate across
// every admin-only edge function. Do NOT hand-roll JWT/role checks per
// function — always go through these helpers so no endpoint is missed.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

export interface AuthContext {
  userId: string;
  isService: boolean;
  isAdmin: boolean;
  client: SupabaseClient;        // anon-key client bound to caller's JWT (for RLS-respecting reads)
  serviceClient: SupabaseClient; // service-role client (bypasses RLS — use with care)
}

function jsonError(status: number, body: Json, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Validates the Authorization bearer token and returns an AuthContext, or a 401 Response. */
export async function requireAuth(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, { success: false, error: "Unauthorized" }, corsHeaders);
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims) {
    return jsonError(401, { success: false, error: "Unauthorized" }, corsHeaders);
  }
  const claims = data.claims as { sub?: string; role?: string };
  const userId = claims.sub ?? "";
  const isService = claims.role === "service_role";

  const serviceClient = createClient(url, serviceKey);

  // service_role tokens are admin by definition
  let isAdmin = isService;
  if (!isAdmin && userId) {
    const { data: roleRow } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    isAdmin = !!roleRow;
  }

  return { userId, isService, isAdmin, client, serviceClient };
}

/** Same as requireAuth but additionally enforces admin (or service_role). Returns 403 otherwise. */
export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> {
  const ctx = await requireAuth(req, corsHeaders);
  if (ctx instanceof Response) return ctx;
  if (!ctx.isAdmin) {
    return jsonError(403, { success: false, error: "Forbidden" }, corsHeaders);
  }
  return ctx;
}
