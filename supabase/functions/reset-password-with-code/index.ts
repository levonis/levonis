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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { email, new_password }: ResetPasswordRequest = await req.json();

    if (!email || !new_password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error resetting password:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
