import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface VerifyRequest {
  email: string;
  code: string;
  type: 'signup' | 'password_reset' | 'password_change' | 'email_change';
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, code, type }: VerifyRequest = await req.json();

    if (!email || !code || !type) {
      return new Response(
        JSON.stringify({ success: false, error: "Email, code, and type are required" }),
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
      // Increment attempts
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

    // Return success with user_id if available
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "تم التحقق بنجاح",
        user_id: verificationData.user_id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error verifying code:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
