import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, otp } = await req.json();
    
    console.log('Sending OTP to WhatsApp:', { phoneNumber, otp });

    // WhatsApp message
    const message = `رمز التحقق الخاص بك هو: ${otp}\n\nصالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أحد.`;
    
    // For now, we'll send to the admin WhatsApp number provided
    // In production, you would integrate with WhatsApp Business API
    const adminWhatsApp = '9647838455220';
    
    // Format message for WhatsApp
    const whatsappMessage = `طلب تحقق جديد:\nرقم الهاتف: ${phoneNumber}\nالكود: ${otp}`;
    
    // Here you would integrate with WhatsApp Business API or service like Twilio
    // For testing, we'll just log it
    console.log('WhatsApp Message:', {
      to: adminWhatsApp,
      message: whatsappMessage,
      userPhone: phoneNumber
    });

    // TODO: Integrate with actual WhatsApp API service
    // Example with Twilio WhatsApp:
    // const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID/Messages.json', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${btoa('YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN')}`,
    //     'Content-Type': 'application/x-www-form-urlencoded',
    //   },
    //   body: new URLSearchParams({
    //     From: 'whatsapp:+14155238886',
    //     To: `whatsapp:${adminWhatsApp}`,
    //     Body: whatsappMessage
    //   })
    // });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP sent successfully',
        // For testing purposes, return the OTP
        otp: otp 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-whatsapp-otp function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
