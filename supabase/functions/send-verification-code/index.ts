import { createClient } from "npm:@supabase/supabase-js@2";

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
      title: 'مرحباً بك في عائلة ليفو',
      message: 'شكراً لانضمامك إلى عائلة ليفو! استخدم الرمز أدناه لتفعيل حسابك والبدء في تجربة تسوق استثنائية.',
    },
    password_reset: {
      title: 'إعادة تعيين كلمة المرور',
      message: 'تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. استخدم الرمز أدناه للمتابعة.',
    },
    password_change: {
      title: 'تأكيد تغيير كلمة المرور',
      message: 'لإتمام عملية تغيير كلمة المرور، يرجى إدخال رمز التحقق أدناه.',
    },
    email_change: {
      title: 'تأكيد البريد الإلكتروني الجديد',
      message: 'لتأكيد تغيير بريدك الإلكتروني، يرجى إدخال رمز التحقق أدناه.',
    },
  };

  const config = typeLabels[type] || typeLabels.signup;
  const codeDigits = code.split('');

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.title} - LEVONIS</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #0a1f1a; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Wrapper Table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0a1f1a 0%, #0d2820 50%, #0a1f1a 100%); min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: linear-gradient(145deg, #112b24 0%, #0e2420 100%); border-radius: 24px; overflow: hidden; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(178, 143, 55, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05);">
          
          <!-- Decorative Top Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, transparent 0%, #b28f37 20%, #d4af37 50%, #b28f37 80%, transparent 100%);"></td>
          </tr>
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding: 45px 40px 30px; text-align: center;">
              <!-- Logo Image -->
              <img src="https://sajlfpygebpqwzpotrsg.supabase.co/storage/v1/object/public/site-assets/logo.png" alt="LEVONIS Logo" width="80" height="80" style="display: block; margin: 0 auto 20px; border-radius: 16px;" />
              <!-- Brand Name -->
              <h1 style="margin: 0; font-size: 32px; font-weight: 800; letter-spacing: 6px; background: linear-gradient(135deg, #d4af37 0%, #f5d984 50%, #d4af37 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">LEVONIS</h1>
              <p style="margin: 8px 0 0; font-size: 11px; color: #7a9990; letter-spacing: 3px; text-transform: uppercase;">Premium Electronics</p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 50px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.3) 50%, transparent 100%);"></div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 35px 40px;">
              <!-- Title -->
              <h2 style="margin: 0 0 15px; font-size: 24px; font-weight: 700; color: #ffffff; text-align: center;">${config.title}</h2>
              
              <!-- Message -->
              <p style="margin: 0 0 35px; font-size: 15px; line-height: 1.8; color: #a8c4bc; text-align: center;">
                ${config.message}
              </p>
              
              <!-- Verification Code Box -->
              <div style="background: linear-gradient(145deg, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0.04) 100%); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 16px; padding: 30px 20px; text-align: center; margin-bottom: 25px;">
                <p style="margin: 0 0 15px; font-size: 12px; color: #7a9990; text-transform: uppercase; letter-spacing: 2px;">رمز التحقق الخاص بك</p>
                
                <!-- Code Digits -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    ${codeDigits.map(digit => `
                    <td style="padding: 0 4px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 48px; height: 60px; background: linear-gradient(180deg, #1a3d34 0%, #153029 100%); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 10px;">
                        <tr>
                          <td align="center" valign="middle" style="font-size: 28px; font-weight: 700; color: #d4af37; font-family: 'Courier New', monospace;">${digit}</td>
                        </tr>
                      </table>
                    </td>
                    `).join('')}
                  </tr>
                </table>
              </div>
              
              <!-- Timer Notice -->
              <div style="text-align: center; margin-bottom: 25px;">
                <span style="display: inline-block; background: linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(212, 175, 55, 0.08) 100%); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 20px; padding: 10px 24px; font-size: 13px; color: #d4af37;">
                  ⏱️ صالح لمدة <strong style="color: #f5d984;">10 دقائق</strong> فقط
                </span>
              </div>
              
              <!-- Security Warning -->
              <div style="background: linear-gradient(135deg, rgba(178, 143, 55, 0.1) 0%, rgba(178, 143, 55, 0.05) 100%); border: 1px solid rgba(178, 143, 55, 0.2); border-radius: 12px; padding: 16px 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #c9a84a; line-height: 1.6;">
                  🔒 لا تشارك هذا الرمز مع أي شخص. فريق LEVONIS لن يطلب منك هذا الرمز أبداً.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: rgba(0, 0, 0, 0.3); padding: 25px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.1);">
              <p style="margin: 0 0 8px; font-size: 12px; color: #5a7a72;">
                إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.
              </p>
              <p style="margin: 0; font-size: 11px; color: #3d5a52;">
                © 2026 LEVONIS. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Bottom Decoration -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin-top: 30px;">
          <tr>
            <td align="center">
              <p style="margin: 0; font-size: 11px; color: #3d5a52;">
                تم الإرسال بواسطة نظام LEVONIS الآمن
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
        JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, type, user_id }: VerificationRequest = await req.json();

    if (!email || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "بيانات غير صحيحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For password_reset, check if user exists first
    if (type === 'password_reset') {
      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error checking user:", userError);
        return new Response(
          JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userExists = users.users.some(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!userExists) {
        return new Response(
          JSON.stringify({ success: false, error: "البريد الإلكتروني غير مسجل في النظام" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Check if a valid code was sent recently (within 55 seconds) to prevent duplicate sends
    // Using 55 seconds to leave a small buffer before the 60-second cooldown expires
    const fiftyFiveSecondsAgo = new Date(Date.now() - 55 * 1000).toISOString();
    const { data: recentCode } = await supabase
      .from('email_verification_codes')
      .select('id, created_at')
      .eq('email', email)
      .eq('type', type)
      .gte('created_at', fiftyFiveSecondsAgo)
      .maybeSingle();

    if (recentCode) {
      // Code was recently sent, return success without sending again
      console.log("Recent code exists, skipping duplicate send for:", email);
      return new Response(
        JSON.stringify({ success: true, message: "Verification code already sent", alreadySent: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification code
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Delete ALL old codes for this email and type (invalidate previous codes)
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
      // Check if it's a duplicate - another request beat us to it
      if (insertError.code === '23505') {
        console.log("Duplicate insert detected, skipping for:", email);
        return new Response(
          JSON.stringify({ success: true, message: "Verification code already sent", alreadySent: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("Error inserting code:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
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
        from: "LEVONIS <noreply@levonisiq.com>",
        to: [email],
        subject: `رمز التحقق: ${code} - LEVONIS`,
        html: emailHTML,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      return new Response(
        JSON.stringify({ success: false, error: "فشل في إرسال البريد" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Verification code sent to:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Verification code sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error sending verification code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

Deno.serve(handler);
