import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ContactRequest {
  name: string;
  email: string;
  message: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const { name, email, message }: ContactRequest = await req.json();

    if (!name || !email || !message) {
      throw new Error('Missing required fields: name, email, message');
    }

    // Basic size limits
    const nameSafe = String(name).slice(0, 100);
    const emailSafe = String(email).slice(0, 254);
    const messageSafe = String(message).slice(0, 5000);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailSafe)) {
      throw new Error('Invalid email address');
    }

    // HTML-escape all user-supplied fields before injecting into email HTML
    const escapeHtml = (s: string) =>
      s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;')
       .replace(/'/g, '&#39;');
    const nameHtml = escapeHtml(nameSafe);
    const emailHtml = escapeHtml(emailSafe);
    const messageHtml = escapeHtml(messageSafe);

    // Send notification to admin
    const adminHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">New Contact Form Message 📩</h1>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
    <p style="font-size:14px;color:#666;margin:0 0 8px"><strong>From:</strong> ${nameHtml}</p>
    <p style="font-size:14px;color:#666;margin:0 0 8px"><strong>Email:</strong> ${emailHtml}</p>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
    <p style="font-size:14px;color:#666;margin:0 0 4px"><strong>Message:</strong></p>
    <p style="font-size:14px;color:#333;margin:0;white-space:pre-wrap;line-height:1.6">${messageHtml}</p>
  </div>
</div>
</body></html>`;

    // Send to admin
    const adminRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ShopHub <onboarding@resend.dev>',
        to: ['tthirmal@gmail.com'],
        subject: `New Contact: ${nameSafe.replace(/[\r\n]/g, ' ')} - ShopHub`,
        html: adminHtml,
        reply_to: emailSafe,
      }),
    });

    const adminResult = await adminRes.json();
    if (!adminRes.ok) {
      console.error('Resend API error:', adminResult);
      throw new Error(`Email send failed: ${JSON.stringify(adminResult)}`);
    }

    // Send confirmation to user
    const userHtml = `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">Thanks for reaching out! 💜</h1>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${nameHtml},</p>
    <p style="font-size:14px;color:#666;margin:0 0 16px">We've received your message and will get back to you within 24 hours.</p>
    <p style="font-size:14px;color:#666;margin:0 0 8px">Here's a copy of your message:</p>
    <div style="padding:16px;background:#f8f8ff;border-radius:8px;margin:0 0 16px">
      <p style="font-size:14px;color:#333;margin:0;white-space:pre-wrap">${messageHtml}</p>
    </div>
    <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center">— The ShopHub Team</p>
  </div>
</div>
</body></html>`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ShopHub <onboarding@resend.dev>',
        to: [emailSafe],
        subject: `We received your message - ShopHub`,
        html: userHtml,
      }),
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Contact email error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
