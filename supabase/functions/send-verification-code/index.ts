import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerificationRequest {
  email: string;
  type: 'signup' | 'password_reset' | 'password_change' | 'email_change';
  user_id?: string;
}

const generateCode = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateEmailHTML = (code: string, type: string) => {
  const typeLabels: Record<string, { title: string; message: string }> = {
    signup: {
      title: 'تأكيد البريد الإلكتروني',
      message: 'شكراً لتسجيلك في ليفونيس! أدخل الرمز أدناه لتأكيد بريدك الإلكتروني:',
    },
    password_reset: {
      title: 'إعادة تعيين كلمة المرور',
      message: 'طلبت إعادة تعيين كلمة المرور. أدخل الرمز أدناه للمتابعة:',
    },
    password_change: {
      title: 'تغيير كلمة المرور',
      message: 'لتأكيد تغيير كلمة المرور، أدخل الرمز أدناه:',
    },
    email_change: {
      title: 'تغيير البريد الإلكتروني',
      message: 'لتأكيد تغيير بريدك الإلكتروني، أدخل الرمز أدناه:',
    },
  };

  const config = typeLabels[type] || typeLabels.signup;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0d2b24; font-family: 'Cairo', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0d2b24; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background: linear-gradient(180deg, #123f35 0%, #103d33 100%); border-radius: 16px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.3);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #103d33 0%, #0b3028 100%); padding: 30px 40px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.2);">
              <h1 style="color: #d4af37; font-size: 28px; font-weight: 700; margin: 0; letter-spacing: 2px;">LEVONIS</h1>
              <p style="color: #b8b08f; font-size: 12px; margin-top: 5px;">متجر الإلكترونيات الفاخرة</p>
            </td>
          </tr>
          
          <!-- Icon Badge -->
          <tr>
            <td align="center" style="padding: 30px 40px 0;">
              <div style="width: 70px; height: 70px; background: rgba(212, 175, 55, 0.2); border-radius: 50%; line-height: 70px; text-align: center; border: 2px solid rgba(212, 175, 55, 0.4);">
                <span style="font-size: 32px;">🔐</span>
              </div>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td align="center" style="padding: 20px 40px 10px;">
              <h2 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0;">${config.title}</h2>
            </td>
          </tr>
          
          <!-- Message -->
          <tr>
            <td style="padding: 0 40px;">
              <p style="color: #e0e0e0; font-size: 15px; line-height: 1.8; text-align: center; margin: 0;">
                ${config.message}
              </p>
            </td>
          </tr>
          
          <!-- Verification Code -->
          <tr>
            <td align="center" style="padding: 30px 40px;">
              <div style="background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.05) 100%); border: 2px solid rgba(212, 175, 55, 0.4); border-radius: 12px; padding: 25px 40px; display: inline-block;">
                <span style="font-size: 36px; font-weight: 700; color: #d4af37; letter-spacing: 12px; font-family: 'Courier New', monospace;">${code}</span>
              </div>
            </td>
          </tr>
          
          <!-- Expiry Notice -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="color: #b8b08f; font-size: 13px; text-align: center; margin: 0;">
                ⏱️ هذا الرمز صالح لمدة <strong style="color: #d4af37;">10 دقائق</strong> فقط
              </p>
            </td>
          </tr>
          
          <!-- Warning -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 15px;">
                <p style="color: #f87171; font-size: 12px; text-align: center; margin: 0;">
                  ⚠️ إذا لم تطلب هذا الرمز، تجاهل هذا البريد. لا تشارك هذا الرمز مع أي شخص.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0, 0, 0, 0.2); padding: 20px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.1);">
              <p style="color: #888; font-size: 11px; margin: 0;">
                © 2024 LEVONIS. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, type, user_id }: VerificationRequest = await req.json();

    if (!email || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check rate limiting - max 3 codes per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('email_verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if (count && count >= 3) {
      return new Response(
        JSON.stringify({ success: false, error: "لقد تجاوزت الحد المسموح. حاول بعد ساعة." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Delete old codes for this email and type
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('email', email)
      .eq('type', type);

    // Insert new code
    const { error: insertError } = await supabase
      .from('email_verification_codes')
      .insert({
        email,
        code,
        type,
        user_id: user_id || null,
        expires_at: expiresAt,
        attempts: 0,
      });

    if (insertError) {
      console.error("Error inserting code:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email
    const emailHTML = generateEmailHTML(code, type);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LEVONIS <noreply@levonis.iq>",
        to: [email],
        subject: `رمز التحقق: ${code} - LEVONIS`,
        html: emailHTML,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Verification code sent to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending verification code:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
