import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface CheckoutRequest {
  shippingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  name: string;
  email: string;
  phone: string;
  paymentMethod?: 'cod' | 'razorpay';
  couponCode?: string;
}

function sanitizeString(str: string, maxLength: number): string {
  return str.trim().substring(0, maxLength);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.user.id;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestData: CheckoutRequest = await req.json();

    if (!requestData.shippingAddress?.trim() || !requestData.city?.trim() ||
        !requestData.state?.trim() || !requestData.zipCode?.trim() ||
        !requestData.name?.trim() || !requestData.email?.trim() ||
        !requestData.phone?.trim()) {
      throw new Error('All shipping fields are required');
    }

    if (requestData.paymentMethod && !['cod', 'razorpay'].includes(requestData.paymentMethod)) {
      throw new Error('Invalid payment method');
    }

    // Fetch user's cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart')
      .select('product_id, quantity')
      .eq('user_id', userId);

    if (cartError) throw new Error('Failed to fetch cart');
    if (!cartItems || cartItems.length === 0) throw new Error('Cart is empty');

    // Fetch products and validate stock
    const productIds = cartItems.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, volume_tiers')
      .in('id', productIds);

    if (productsError || !products) throw new Error('Failed to validate products');
    if (products.length !== productIds.length) throw new Error('Some products are unavailable');

    const applicableTier = (qty: number, tiers: any) => {
      if (!Array.isArray(tiers) || tiers.length === 0) return null;
      return [...tiers]
        .sort((a: any, b: any) => Number(b.min_qty) - Number(a.min_qty))
        .find((t: any) => qty >= Number(t.min_qty)) || null;
    };

    const productMap = new Map(products.map(p => [p.id, p]));
    let serverTotal = 0;
    let volumeDiscount = 0;
    const validatedItems = [];

    for (const item of cartItems) {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Product not found`);
      if (product.stock !== null && product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock}`);
      }
      const subtotal = product.price * item.quantity;
      serverTotal += subtotal;
      const tier = applicableTier(item.quantity, (product as any).volume_tiers);
      if (tier) volumeDiscount += subtotal * (Number(tier.discount_percent) / 100);
      validatedItems.push({
        product_id: product.id, product_name: product.name,
        product_price: product.price, quantity: item.quantity, subtotal,
      });
    }

    serverTotal = Math.max(0, serverTotal - volumeDiscount);


    // Validate and apply coupon server-side
    let discountAmount = 0;
    let couponCode: string | null = null;

    if (requestData.couponCode) {
      const code = requestData.couponCode.trim().toUpperCase().substring(0, 30);
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single();

      if (couponError || !coupon) throw new Error('Invalid coupon code');
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error('Coupon has expired');
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) throw new Error('Coupon usage limit reached');
      if (coupon.min_order_amount && serverTotal < coupon.min_order_amount) {
        throw new Error(`Minimum order ₹${coupon.min_order_amount} required for this coupon`);
      }

      if (coupon.discount_type === 'percentage') {
        discountAmount = (serverTotal * coupon.discount_value) / 100;
        if (coupon.max_discount_amount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
        }
      } else {
        discountAmount = coupon.discount_value;
      }
      discountAmount = Math.min(discountAmount, serverTotal);
      couponCode = coupon.code;

      // Increment usage count
      await supabase
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('id', coupon.id);
    }

    const finalTotal = serverTotal - discountAmount;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        guest_name: sanitizeString(requestData.name, 100),
        guest_email: sanitizeString(requestData.email, 255),
        guest_phone: sanitizeString(requestData.phone, 20),
        shipping_address: sanitizeString(requestData.shippingAddress, 255),
        city: sanitizeString(requestData.city, 100),
        state: sanitizeString(requestData.state, 50),
        zip_code: sanitizeString(requestData.zipCode, 20),
        total_amount: finalTotal,
        status: 'pending',
        coupon_code: couponCode,
        discount_amount: discountAmount,
      })
      .select()
      .single();

    if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);

    // Create order items
    const orderItemsToInsert = validatedItems.map(item => ({
      order_id: order.id, product_id: item.product_id,
      product_name: item.product_name, product_price: item.product_price,
      quantity: item.quantity, subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
    if (itemsError) {
      await supabase.from('orders').delete().eq('id', order.id);
      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    // Clear cart for COD orders only (Razorpay clears cart after successful verify)
    if (requestData.paymentMethod !== 'razorpay') {
      await supabase.from('cart').delete().eq('user_id', userId);
    }

    // Send order confirmation email (fire-and-forget)
    try {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      await fetch(`${SUPABASE_URL}/functions/v1/send-order-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
        body: JSON.stringify({ type: 'confirmation', orderId: order.id }),
      });
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, orderId: order.id, total: finalTotal, discount: discountAmount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Authenticated checkout error:', error);
    
    const safeMessages: Record<string, string> = {
      'All shipping fields are required': 'All shipping fields are required',
      'Cart is empty': 'Your cart is empty',
      'Failed to fetch cart': 'Unable to process your cart. Please try again.',
      'Invalid coupon code': 'Invalid coupon code',
      'Coupon has expired': 'This coupon has expired',
      'Coupon usage limit reached': 'This coupon has reached its usage limit',
    };
    
    let clientMessage = 'Unable to process your order. Please try again.';
    const msg = error.message || '';
    
    if (safeMessages[msg]) {
      clientMessage = safeMessages[msg];
    } else if (msg.includes('Insufficient stock')) {
      clientMessage = 'One or more items are out of stock. Please update your cart.';
    } else if (msg.includes('unavailable')) {
      clientMessage = 'Some products are no longer available.';
    } else if (msg.includes('Minimum order')) {
      clientMessage = msg;
    }
    
    return new Response(
      JSON.stringify({ success: false, error: clientMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
