import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Validation for code input
const validateCode = (code: string): boolean => {
  return typeof code === 'string' && /^\d{6}$/.test(code);
};

// Validation for type input
const VALID_TYPES = ['signup', 'password_reset', 'password_change', 'email_change'];
const validateType = (type: string): boolean => {
  return typeof type === 'string' && VALID_TYPES.includes(type);
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email: rawEmail, code, type } = await req.json();

    // Validate and sanitize email
    const emailValidation = validateAndSanitizeEmail(rawEmail);
    if (!emailValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "بيانات غير صحيحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const email = emailValidation.sanitized;

    // Validate code format
    if (!validateCode(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "بيانات غير صحيحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate type
    if (!validateType(type)) {
      return new Response(
        JSON.stringify({ success: false, error: "بيانات غير صحيحة" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the verification code
    const { data: verificationData, error: fetchError } = await supabase
      .from('email_verification_codes')
      .select('*')
      .eq('email', email)
      .eq('type', type)
      .is('verified_at', null)
      .single();

    if (fetchError || !verificationData) {
      return new Response(
        JSON.stringify({ success: false, error: "رمز التحقق غير موجود أو منتهي الصلاحية" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(verificationData.expires_at) < new Date()) {
      await supabase
        .from('email_verification_codes')
        .delete()
        .eq('id', verificationData.id);

      return new Response(
        JSON.stringify({ success: false, error: "انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check attempts (max 5)
    if (verificationData.attempts >= 5) {
      await supabase
        .from('email_verification_codes')
        .delete()
        .eq('id', verificationData.id);

      return new Response(
        JSON.stringify({ success: false, error: "تجاوزت عدد المحاولات المسموحة. اطلب رمزاً جديداً." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check code
    if (verificationData.code !== code) {
      await supabase
        .from('email_verification_codes')
        .update({ attempts: verificationData.attempts + 1 })
        .eq('id', verificationData.id);

      const remainingAttempts = 5 - verificationData.attempts - 1;
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `رمز التحقق غير صحيح. متبقي ${remainingAttempts} محاولات.` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Code is valid! Mark as verified
    await supabase
      .from('email_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verificationData.id);

    // If signup type, mark email as verified in profiles
    if (type === 'signup' && verificationData.user_id) {
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', verificationData.user_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "تم التحقق بنجاح",
        user_id: verificationData.user_id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error verifying code:", error);
    return new Response(
      JSON.stringify({ success: false, error: "حدث خطأ. يرجى المحاولة لاحقاً." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
