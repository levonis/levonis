import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Email notification types
type NotificationType = 
  | 'new_message' 
  | 'order_status' 
  | 'admin_message' 
  | 'wallet_update'
  | 'merchant_update'
  | 'account_update'
  | 'general';

interface EmailNotificationRequest {
  user_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  metadata?: {
    order_number?: string;
    sender_name?: string;
    amount?: number;
    status?: string;
    link?: string;
  };
}

// Professional Arabic email template
const generateEmailHTML = (
  type: NotificationType,
  title: string,
  message: string,
  metadata?: EmailNotificationRequest['metadata']
) => {
  const typeConfig: Record<NotificationType, { icon: string; color: string }> = {
    new_message: { icon: '💬', color: '#d4af37' },
    order_status: { icon: '📦', color: '#10b981' },
    admin_message: { icon: '📢', color: '#3b82f6' },
    wallet_update: { icon: '💰', color: '#f59e0b' },
    merchant_update: { icon: '🏪', color: '#8b5cf6' },
    account_update: { icon: '👤', color: '#ef4444' },
    general: { icon: 'ℹ️', color: '#6b7280' },
  };

  const config = typeConfig[type] || typeConfig.general;
  const appUrl = 'https://levonis.lovable.app';
  const actionLink = metadata?.link || appUrl;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
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
              <div style="width: 70px; height: 70px; background: ${config.color}20; border-radius: 50%; line-height: 70px; text-align: center; border: 2px solid ${config.color}40;">
                <span style="font-size: 32px;">${config.icon}</span>
              </div>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 20px 40px 10px; text-align: center;">
              <h2 style="color: ${config.color}; font-size: 22px; font-weight: 700; margin: 0;">${title}</h2>
            </td>
          </tr>
          
          <!-- Message Content -->
          <tr>
            <td style="padding: 10px 40px 30px; text-align: center;">
              <p style="color: #efe6c9; font-size: 16px; line-height: 1.8; margin: 0;">${message}</p>
              
              ${metadata?.order_number ? `
              <div style="margin-top: 20px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
                <p style="color: #b8b08f; font-size: 14px; margin: 0;">رقم الطلب</p>
                <p style="color: #d4af37; font-size: 18px; font-weight: 700; margin: 5px 0 0;">${metadata.order_number}</p>
              </div>
              ` : ''}
              
              ${metadata?.sender_name ? `
              <div style="margin-top: 20px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
                <p style="color: #b8b08f; font-size: 14px; margin: 0;">المرسل</p>
                <p style="color: #d4af37; font-size: 18px; font-weight: 700; margin: 5px 0 0;">${metadata.sender_name}</p>
              </div>
              ` : ''}
              
              ${metadata?.amount ? `
              <div style="margin-top: 20px; padding: 15px; background: rgba(212, 175, 55, 0.1); border-radius: 8px; border: 1px solid rgba(212, 175, 55, 0.2);">
                <p style="color: #b8b08f; font-size: 14px; margin: 0;">المبلغ</p>
                <p style="color: #d4af37; font-size: 18px; font-weight: 700; margin: 5px 0 0;">${metadata.amount.toLocaleString()} د.ع</p>
              </div>
              ` : ''}
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 30px;">
              <a href="${actionLink}" style="display: inline-block; background: linear-gradient(135deg, #d4af37 0%, #c7a832 100%); color: #103d33; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 16px;">
                عرض التفاصيل
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #0b3028; padding: 25px 40px; text-align: center; border-top: 1px solid rgba(212, 175, 55, 0.2);">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                تم إرسال هذا البريد تلقائياً من LEVONIS
              </p>
              <p style="color: #4b5563; font-size: 11px; margin-top: 10px;">
                © ${new Date().getFullYear()} LEVONIS - جميع الحقوق محفوظة
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
    if (!RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, notification_type, title, message, metadata }: EmailNotificationRequest = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: user_id, title, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, email_notifications_enabled")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching user profile:", profileError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profile.email) {
      console.log("User has no email, skipping notification");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No email for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (profile.email_notifications_enabled === false) {
      console.log("User has disabled email notifications");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate email HTML
    const emailHTML = generateEmailHTML(notification_type || 'general', title, message, metadata);

    // Send email using Resend API directly
    console.log(`Sending email to ${profile.email} (${profile.full_name || 'User'})`);
    
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "LEVONIS <onboarding@resend.dev>", // Use resend.dev for testing, replace with verified domain
        to: [profile.email],
        subject: `${title} - LEVONIS`,
        html: emailHTML,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      return new Response(
        JSON.stringify({ success: false, error: emailResult.message || "Email send failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error sending email notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
