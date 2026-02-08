import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResetPasswordRequest {
  email: string;
  new_password: string;
}

// Email validation and sanitization
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 320;

const validateAndSanitizeEmail = (email: string): { valid: boolean; sanitized: string } => {
  if (!email || typeof email !== 'string') {
    return { valid: false, sanitized: '' };
  }
  const sanitized = email.trim().toLowerCase();
  if (sanitized.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(sanitized)) {
    return { valid: false, sanitized: '' };
  }
  return { valid: true, sanitized };
};

// Password validation
const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: "كلمة المرور مطلوبة" };
  }
  if (password.length < 6) {
    return { valid: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" };
  }
  if (password.length > 128) {
    return { valid: false, error: "كلمة المرور طويلة جداً" };
  }
  return { valid: true };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email: rawEmail, new_password }: ResetPasswordRequest = await req.json();

    // Validate and sanitize email
    const emailValidation = validateAndSanitizeEmail(rawEmail);
    if (!emailValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "بيانات غير صحيحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const email = emailValidation.sanitized;

    // Validate password
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: passwordValidation.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has a verified code for password_reset
    const { data: verificationData, error: verifyError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('type', 'password_reset')
      .not('verified_at', 'is', null)
      .order('verified_at', { ascending: false })
      .limit(1)
      .single();

    if (verifyError || !verificationData) {
      return new Response(
        JSON.stringify({ success: false, error: "يجب التحقق من البريد الإلكتروني أولاً" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if verified within last 10 minutes
    const verifiedAt = new Date(verificationData.verified_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - verifiedAt.getTime()) / (1000 * 60);

    if (diffMinutes > 10) {
      return new Response(
        JSON.stringify({ success: false, error: "انتهت صلاحية التحقق. يرجى طلب رمز جديد." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user by email
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error listing users:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "حدث خطأ في البحث عن المستخدم" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "المستخدم غير موجود" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "فشل في تحديث كلمة المرور" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete the used verification code
    await supabase
      .from('email_verification_codes')
      .delete()
      .eq('id', verificationData.id);

    console.log("Password reset successful for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "تم تغيير كلمة المرور بنجاح" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error resetting password:", error);
    return new Response(
      JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
