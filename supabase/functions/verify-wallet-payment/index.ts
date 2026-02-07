import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { session_id, amount } = await req.json();
    
    if (!session_id) {
      throw new Error("Session ID is required");
    }

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    // Verify the session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      throw new Error("Session does not belong to this user");
    }

    const amountIQD = parseInt(session.metadata?.amount_iqd || amount?.toString() || "0");
    
    if (amountIQD <= 0) {
      throw new Error("Invalid amount");
    }

    // استخدام RPC ذري لمعالجة الدفع بشكل آمن
    const { data: result, error: rpcError } = await supabaseClient.rpc(
      'process_stripe_wallet_deposit',
      {
        p_user_id: user.id,
        p_amount: amountIQD,
        p_stripe_session_id: session_id
      }
    );

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      throw new Error("Failed to process payment: " + rpcError.message);
    }

    if (!result?.success) {
      throw new Error(result?.error || "Failed to process payment");
    }

    console.log("Payment processed successfully:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error verifying payment:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
