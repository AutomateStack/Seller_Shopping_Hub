import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.79.0";
import { checkRateLimit, clientKey } from "../_shared/rate-limit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  quantity: number;
}

interface GuestCheckoutRequest {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  shippingAddress: string;
  city: string;
  state: string;
  zipCode: string;
  cartItems: CartItem[];
  couponCode?: string;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.length >= 10 && phone.length <= 20;
}

function sanitizeString(str: string, maxLength: number): string {
  return str.trim().substring(0, maxLength);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = checkRateLimit(clientKey(req, 'guest-checkout'), 5, 60_000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ success: false, error: 'Too many requests. Please wait and try again.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfterSec) } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData: GuestCheckoutRequest = await req.json();

    // Validate inputs
    if (!requestData.guestName || typeof requestData.guestName !== 'string' || requestData.guestName.trim().length === 0) throw new Error('Valid name is required');
    if (!requestData.guestEmail || !isValidEmail(requestData.guestEmail)) throw new Error('Valid email address is required');
    if (!requestData.guestPhone || !isValidPhone(requestData.guestPhone)) throw new Error('Valid phone number is required');
    if (!requestData.shippingAddress || typeof requestData.shippingAddress !== 'string' || requestData.shippingAddress.trim().length === 0) throw new Error('Shipping address is required');
    if (!requestData.city || typeof requestData.city !== 'string' || requestData.city.trim().length === 0) throw new Error('City is required');
    if (!requestData.state || typeof requestData.state !== 'string' || requestData.state.trim().length === 0) throw new Error('State is required');
    if (!requestData.zipCode || typeof requestData.zipCode !== 'string' || requestData.zipCode.trim().length === 0) throw new Error('Zip code is required');
    if (!requestData.cartItems || !Array.isArray(requestData.cartItems) || requestData.cartItems.length === 0) throw new Error('Cart is empty');
    if (requestData.cartItems.length > 50) throw new Error('Too many items in cart');

    const sanitizedData = {
      guestName: sanitizeString(requestData.guestName, 100),
      guestEmail: sanitizeString(requestData.guestEmail, 255),
      guestPhone: sanitizeString(requestData.guestPhone, 20),
      shippingAddress: sanitizeString(requestData.shippingAddress, 255),
      city: sanitizeString(requestData.city, 100),
      state: sanitizeString(requestData.state, 50),
      zipCode: sanitizeString(requestData.zipCode, 20),
    };

    // Validate products
    const productIds = requestData.cartItems.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, stock, volume_tiers')
      .in('id', productIds);

    if (productsError) throw new Error('Failed to validate products');
    if (!products || products.length !== productIds.length) throw new Error('Some products are invalid or unavailable');

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

    for (const item of requestData.cartItems) {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (typeof item.quantity !== 'number' || item.quantity < 1 || item.quantity > 100) throw new Error('Invalid quantity');
      if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${product.name}`);

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
        guest_name: sanitizedData.guestName,
        guest_email: sanitizedData.guestEmail,
        guest_phone: sanitizedData.guestPhone,
        shipping_address: sanitizedData.shippingAddress,
        city: sanitizedData.city,
        state: sanitizedData.state,
        zip_code: sanitizedData.zipCode,
        total_amount: finalTotal,
        status: 'pending',
        user_id: null,
        coupon_code: couponCode,
        discount_amount: discountAmount,
      })
      .select()
      .single();

    if (orderError) throw new Error(`Failed to create order: ${orderError.message}`);

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

    // Send order confirmation email (fire-and-forget)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      if (sanitizedData.guestEmail) {
        await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ type: 'confirmation', orderId: order.id }),
        });
      }
    } catch (emailErr) {
      console.error('Failed to send confirmation email:', emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, orderId: order.id, total: finalTotal, discount: discountAmount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in guest-checkout function:', error);
    
    const knownMessages = [
      'Valid name is required', 'Valid email address is required', 'Valid phone number is required',
      'Shipping address is required', 'City is required', 'State is required', 'Zip code is required',
      'Cart is empty', 'Too many items in cart', 'Invalid quantity',
      'Invalid coupon code', 'Coupon has expired', 'Coupon usage limit reached',
    ];
    
    const msg = error.message || '';
    let clientMessage = 'Unable to process your order. Please try again.';
    
    if (knownMessages.includes(msg)) {
      clientMessage = msg;
    } else if (msg.includes('Insufficient stock')) {
      clientMessage = 'One or more items are out of stock. Please update your cart.';
    } else if (msg.includes('invalid or unavailable')) {
      clientMessage = 'Some products are no longer available.';
    } else if (msg.includes('Minimum order')) {
      clientMessage = msg;
    }
    
    return new Response(
      JSON.stringify({ success: false, error: clientMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
