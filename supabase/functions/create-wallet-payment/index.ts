import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Get request body
    const { amount, usdRate } = await req.json();
    
    if (!amount || amount <= 0) {
      throw new Error("Invalid amount");
    }
    
    // Use provided rate or default
    const exchangeRate = usdRate || 1460;

    // Retrieve authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated or email not available");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if a Stripe customer record exists for this user
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Convert IQD to USD cents using admin-configured rate
    const amountInCents = Math.round((amount / exchangeRate) * 100);
    
    // Minimum $0.50 USD for Stripe
    if (amountInCents < 50) {
      throw new Error(`Minimum amount is approximately ${Math.ceil(exchangeRate * 0.5)} IQD`);
    }

    // Get origin from headers or use Supabase URL as fallback
    let origin = req.headers.get("origin");
    if (!origin) {
      // Try referer header
      const referer = req.headers.get("referer");
      if (referer) {
        try {
          const refererUrl = new URL(referer);
          origin = refererUrl.origin;
        } catch {
          // Ignore parsing errors
        }
      }
    }
    
    // Fallback to SUPABASE_URL based domain or default
    if (!origin) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      // Extract project ref from supabase URL
      const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (match) {
        origin = `https://${match[1]}.lovable.app`;
      } else {
        origin = "https://levonis.lovable.app";
      }
    }

    console.log("Creating checkout session with origin:", origin);

    // Create a one-time payment session with dynamic pricing
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "تعبئة المحفظة - Wallet Top-up",
              description: `${amount.toLocaleString()} دينار عراقي`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/wallet-success?session_id={CHECKOUT_SESSION_ID}&amount=${amount}`,
      cancel_url: `${origin}/?wallet_canceled=true`,
      metadata: {
        user_id: user.id,
        amount_iqd: amount.toString(),
        type: "wallet_deposit",
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error creating payment session:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
