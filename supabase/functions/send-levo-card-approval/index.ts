// Sends the Levo card activation email once an admin approves a card request.
// Called from the admin browser after `approve_levo_card_order` returns the card secrets.
// The function is admin-only and never re-fetches secrets from the DB.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  recipient_email: string;
  full_name: string;
  card_number: string;
  pin: string;
  qr_token: string;
  nfc_token: string;
}

const buildHtml = (p: Payload) => {
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    p.qr_token,
  )}`;
  const grouped = p.card_number.replace(/(.{4})/g, "$1 ").trim();
  const appUrl = "https://levonisiq.com";
  const activateUrl = `${appUrl}/rewards?activate=${encodeURIComponent(p.card_number)}&token=${encodeURIComponent(p.qr_token)}`;
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>بطاقة ليفو</title></head>
<body style="margin:0;padding:0;background:#0d2b24;font-family:'Cairo',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d2b24;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:linear-gradient(180deg,#123f35,#103d33);border-radius:16px;overflow:hidden;border:1px solid rgba(212,175,55,.3);">
<tr><td style="background:linear-gradient(135deg,#103d33,#0b3028);padding:30px 40px;text-align:center;border-bottom:1px solid rgba(212,175,55,.2);">
<h1 style="color:#d4af37;font-size:28px;font-weight:700;margin:0;letter-spacing:2px;">LEVONIS</h1>
<p style="color:#b8b08f;font-size:12px;margin-top:5px;">بطاقة ليفو الفيزيائية</p></td></tr>
<tr><td style="padding:30px 40px 20px;text-align:center;">
<h2 style="color:#d4af37;font-size:22px;font-weight:700;margin:0 0 10px;">تمت الموافقة على طلبك 🎉</h2>
<p style="color:#efe6c9;font-size:15px;line-height:1.8;margin:0;">مرحباً ${p.full_name}،<br/>تم تخصيص بطاقة ليفو الفيزيائية لك. استخدم البيانات أدناه لتفعيلها.</p>
</td></tr>
<tr><td style="padding:0 40px 20px;">
<div style="background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:12px;padding:20px;text-align:center;">
<p style="color:#b8b08f;font-size:13px;margin:0 0 8px;">رقم البطاقة</p>
<p style="color:#d4af37;font-size:22px;font-weight:700;letter-spacing:3px;margin:0;font-family:monospace;">${grouped}</p>
</div>
</td></tr>
<tr><td style="padding:0 40px 20px;">
<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:20px;text-align:center;">
<p style="color:#fca5a5;font-size:13px;margin:0 0 8px;">رمز PIN السري (4 أرقام)</p>
<p style="color:#fecaca;font-size:32px;font-weight:800;letter-spacing:8px;margin:0;font-family:monospace;">${p.pin}</p>
<p style="color:#fca5a5;font-size:11px;margin:10px 0 0;">⚠️ لا تشاركه مع أحد</p>
</div>
</td></tr>
<tr><td style="padding:0 40px 20px;text-align:center;">
<p style="color:#b8b08f;font-size:13px;margin:0 0 10px;">امسح رمز QR للتفعيل السريع</p>
<img src="${qrImg}" alt="QR" width="220" height="220" style="border-radius:12px;background:#fff;padding:8px;"/>
</td></tr>
<tr><td style="padding:0 40px 30px;text-align:center;">
<a href="${activateUrl}" style="display:inline-block;background:#d4af37;color:#0d2b24;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">فعّل بطاقتي الآن</a>
</td></tr>
<tr><td style="background:#0b3028;padding:20px 40px;text-align:center;border-top:1px solid rgba(212,175,55,.15);">
<p style="color:#b8b08f;font-size:11px;margin:0;">LEVONIS © ${new Date().getFullYear()} — رسالة تلقائية، لا ترد عليها</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    if (
      !body?.recipient_email || !body?.card_number || !body?.pin ||
      !body?.qr_token || !body?.nfc_token
    ) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "email_not_configured", detail: "RESEND_API_KEY missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Levonis <onboarding@resend.dev>",
        to: [body.recipient_email],
        subject: "🎉 بطاقة ليفو الفيزيائية جاهزة للتفعيل",
        html: buildHtml(body),
      }),
    });
    const text = await emailRes.text();
    if (!emailRes.ok) {
      console.error("Resend API error", emailRes.status, text, "to:", body.recipient_email);
      return new Response(
        JSON.stringify({ error: "email_failed", status: emailRes.status, detail: text }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    console.log("Resend email sent", text);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal_error", detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
