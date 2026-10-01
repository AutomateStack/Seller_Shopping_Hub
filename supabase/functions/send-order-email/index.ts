import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function escapeHtml(v: unknown): string {
  const s = v == null ? '' : String(v);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface OrderItem {
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
}

interface EmailRequest {
  type: 'confirmation' | 'shipped' | 'delivered';
  to: string;
  customerName: string;
  orderId: string;
  totalAmount: number;
  items?: OrderItem[];
  shippingAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  discountAmount?: number;
  couponCode?: string;
}

function generateConfirmationEmail(data: EmailRequest): string {
  const itemsHtml = (data.items || []).map(item => `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333">${escapeHtml(item.product_name)}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:center">${Number(item.quantity)||0}</td>
      <td style="padding:12px 8px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right">₹${(Number(item.subtotal)||0).toFixed(2)}</td>
    </tr>
  `).join('');

  const discount = data.discountAmount && data.discountAmount > 0
    ? `<tr><td colspan="2" style="padding:4px 8px;font-size:14px;color:#16a34a">Discount${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ''}</td><td style="padding:4px 8px;font-size:14px;color:#16a34a;text-align:right">-₹${(Number(data.discountAmount)||0).toFixed(2)}</td></tr>`
    : '';

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">Order Confirmed! 🎉</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Thank you for your purchase</p>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${escapeHtml(data.customerName)},</p>
    <p style="font-size:14px;color:#666;margin:0 0 24px">Your order <strong style="color:#4f46e5">#${escapeHtml(data.orderId.slice(-8))}</strong> has been placed successfully!</p>
    
    <table style="width:100%;border-collapse:collapse;margin:0 0 16px">
      <thead>
        <tr style="background:#f8f8f8">
          <th style="padding:10px 8px;text-align:left;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Product</th>
          <th style="padding:10px 8px;text-align:center;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Amount</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    
    <table style="width:100%;border-collapse:collapse">
      ${discount}
      <tr>
        <td colspan="2" style="padding:8px;font-size:16px;font-weight:700;color:#333;border-top:2px solid #333">Total</td>
        <td style="padding:8px;font-size:16px;font-weight:700;color:#4f46e5;text-align:right;border-top:2px solid #333">₹${(Number(data.totalAmount)||0).toFixed(2)}</td>
      </tr>
    </table>

    ${data.shippingAddress ? `
    <div style="margin:24px 0 0;padding:16px;background:#f8f8ff;border-radius:8px">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Shipping To</p>
      <p style="margin:0;font-size:14px;color:#333">${escapeHtml(data.shippingAddress)}<br/>${escapeHtml(data.city)}, ${escapeHtml(data.state)} ${escapeHtml(data.zipCode)}</p>
    </div>` : ''}
    
    <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center">We'll notify you when your order ships.</p>
  </div>
</div>
</body></html>`;
}

function generateShippedEmail(data: EmailRequest): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">Your Order Has Shipped! 📦</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">It's on its way to you</p>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${escapeHtml(data.customerName)},</p>
    <p style="font-size:14px;color:#666;margin:0 0 24px">Great news! Your order <strong style="color:#7c3aed">#${escapeHtml(data.orderId.slice(-8))}</strong> has been shipped.</p>
    
    ${data.trackingNumber ? `
    <div style="padding:16px;background:#f3f0ff;border-radius:8px;margin:0 0 16px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Tracking Number</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:#7c3aed;font-family:monospace">${escapeHtml(data.trackingNumber)}</p>
    </div>` : ''}
    
    ${data.estimatedDelivery ? `
    <div style="padding:16px;background:#f0fdf4;border-radius:8px;text-align:center">
      <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;color:#888;font-weight:600">Estimated Delivery</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#16a34a">${escapeHtml(data.estimatedDelivery)}</p>
    </div>` : ''}
    
    <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center">We'll let you know when it's delivered.</p>
  </div>
</div>
</body></html>`;
}

function generateDeliveredEmail(data: EmailRequest): string {
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:20px">
  <div style="background:linear-gradient(135deg,#16a34a,#22c55e);padding:32px;border-radius:12px 12px 0 0;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px">Order Delivered! ✅</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px">Your order has arrived</p>
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px">
    <p style="font-size:16px;color:#333;margin:0 0 16px">Hi ${escapeHtml(data.customerName)},</p>
    <p style="font-size:14px;color:#666;margin:0 0 24px">Your order <strong style="color:#16a34a">#${escapeHtml(data.orderId.slice(-8))}</strong> has been delivered successfully!</p>
    
    <div style="padding:20px;background:#f0fdf4;border-radius:8px;text-align:center">
      <p style="margin:0;font-size:14px;color:#333">We hope you love your purchase! 💚</p>
    </div>
    
    <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center">If you have any issues, please don't hesitate to contact us.</p>
  </div>
</div>
</body></html>`;
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

    // AUTH: require either the service role key (used by trusted server-side
    // callers such as guest-checkout / authenticated-checkout) or an admin
    // JWT (used by AdminOrders). Reject anonymous public callers so this
    // endpoint cannot be used to send arbitrary branded emails.
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const isServiceRole = bearer && bearer === SUPABASE_SERVICE_ROLE_KEY;

    let isAdmin = false;
    if (!isServiceRole && bearer) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: role } = await svc
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();
        isAdmin = !!role;
      }
    }

    if (!isServiceRole && !isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const orderId: string | undefined = body?.orderId;
    const type: EmailRequest['type'] | undefined = body?.type;
    if (!orderId || typeof orderId !== 'string' || !type ||
        !['confirmation', 'shipped', 'delivered'].includes(type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing or invalid orderId/type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up order + items server-side; do not trust client-supplied content.
    const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error: orderErr } = await svc
      .from('orders')
      .select('id, user_id, guest_email, guest_name, total_amount, discount_amount, coupon_code, shipping_address, city, state, zip_code, tracking_number, estimated_delivery_date')
      .eq('id', orderId)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve recipient email from the order (or from the account profile).
    let toEmail: string | null = order.guest_email;
    let toName: string | null = order.guest_name;
    if (!toEmail && order.user_id) {
      const { data: profile } = await svc
        .from('profiles')
        .select('email, full_name')
        .eq('id', order.user_id)
        .maybeSingle();
      toEmail = profile?.email ?? null;
      toName = toName ?? profile?.full_name ?? null;
    }
    if (!toEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'No recipient email on order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: items } = await svc
      .from('order_items')
      .select('product_name, quantity, product_price, subtotal')
      .eq('order_id', orderId);

    const data: EmailRequest = {
      type,
      to: toEmail,
      customerName: toName || 'Customer',
      orderId: order.id,
      totalAmount: Number(order.total_amount) || 0,
      items: (items || []) as OrderItem[],
      shippingAddress: order.shipping_address || undefined,
      city: order.city || undefined,
      state: order.state || undefined,
      zipCode: order.zip_code || undefined,
      trackingNumber: order.tracking_number || undefined,
      estimatedDelivery: order.estimated_delivery_date
        ? new Date(order.estimated_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : undefined,
      discountAmount: Number(order.discount_amount) || 0,
      couponCode: order.coupon_code || undefined,
    };

    let subject: string;
    let html: string;

    switch (data.type) {
      case 'confirmation':
        subject = `Order Confirmed - #${data.orderId.slice(-8)}`;
        html = generateConfirmationEmail(data);
        break;
      case 'shipped':
        subject = `Your Order Has Shipped - #${data.orderId.slice(-8)}`;
        html = generateShippedEmail(data);
        break;
      case 'delivered':
        subject = `Order Delivered - #${data.orderId.slice(-8)}`;
        html = generateDeliveredEmail(data);
        break;
      default:
        throw new Error('Invalid email type');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ShopHub <onboarding@resend.dev>',
        to: [data.to],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', result);
      throw new Error(`Email send failed: ${JSON.stringify(result)}`);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Send order email error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
