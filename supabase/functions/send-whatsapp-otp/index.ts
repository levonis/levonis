import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, otp } = await req.json();
    
    console.log('Sending OTP via SMS:', { phoneNumber, otp });

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      throw new Error('Twilio credentials not configured');
    }

    // SMS message in Arabic
    const message = `رمز التحقق الخاص بك هو: ${otp}\n\nصالح لمدة 5 دقائق.\nلا تشارك هذا الرمز مع أحد.`;
    
    // Format phone number for Twilio (add +964 country code if not present)
    const formattedPhone = phoneNumber.startsWith('+') 
      ? phoneNumber 
      : phoneNumber.startsWith('0') 
        ? `+964${phoneNumber.substring(1)}` 
        : `+964${phoneNumber}`;

    console.log('Formatted phone:', formattedPhone);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = btoa(`${twilioAccountSid}:${twilioAuthToken}`);
    
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: twilioPhoneNumber,
        To: formattedPhone,
        Body: message
      })
    });

    const twilioResponse = await response.json();
    
    if (!response.ok) {
      console.error('Twilio error:', twilioResponse);
      throw new Error(twilioResponse.message || 'Failed to send SMS');
    }

    console.log('SMS sent successfully:', twilioResponse.sid);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP sent successfully via SMS',
        messageSid: twilioResponse.sid
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-sms-otp function:', error);
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
