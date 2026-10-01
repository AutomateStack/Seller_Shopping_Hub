import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, CreditCard, Lock, Truck, Wallet, Tag, X, CheckCircle2 } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { calculateVolumeDiscount } from "@/lib/format";

const checkoutSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20, "Phone number must be less than 20 digits"),
  address: z.string().trim().min(1, "Address is required").max(255, "Address must be less than 255 characters"),
  city: z.string().trim().min(1, "City is required").max(100, "City must be less than 100 characters"),
  state: z.string().trim().min(1, "State is required").max(50, "State must be less than 50 characters"),
  zipCode: z.string().trim().min(1, "Zip code is required").max(20, "Zip code must be less than 20 characters"),
});

type PaymentMethod = "cod" | "razorpay";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function getFunctionErrorMessage(error: any, data: any, fallback: string): Promise<string> {
  if (data?.error && typeof data.error === "string") return data.error;

  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // The function may have returned a non-JSON error response.
    }
  }

  return error?.message || fallback;
}

interface AppliedCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  discountAmount: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [formData, setFormData] = useState({
    name: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "",
  });
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, phone, address, city, state, zip_code")
          .eq("id", u.id)
          .single();
        if (profile) {
          setFormData({
            name: profile.full_name || "", email: profile.email || u.email || "",
            phone: profile.phone || "", address: profile.address || "",
            city: profile.city || "", state: profile.state || "", zipCode: profile.zip_code || "",
          });
        } else {
          setFormData(prev => ({ ...prev, email: u.email || "" }));
        }
        // Load saved addresses & auto-select default
        const { data: addrs } = await supabase
          .from("saved_addresses")
          .select("*")
          .eq("user_id", u.id)
          .order("is_default", { ascending: false });
        if (addrs && addrs.length > 0) {
          const def = addrs[0];
          setSelectedAddressId(def.id);
          setFormData(prev => ({
            ...prev,
            name: def.recipient_name, phone: def.phone, address: def.address,
            city: def.city, state: def.state, zipCode: def.zip_code,
          }));
        }
      }
    });
  }, []);

  const { data: savedAddresses } = useQuery({
    queryKey: ["saved-addresses", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      return data || [];
    },
  });

  const handleSelectAddress = (id: string) => {
    setSelectedAddressId(id);
    const a = savedAddresses?.find((x: any) => x.id === id);
    if (a) {
      setFormData(prev => ({
        ...prev,
        name: a.recipient_name, phone: a.phone, address: a.address,
        city: a.city, state: a.state, zipCode: a.zip_code,
      }));
    }
  };

  const { data: cartItems, isLoading: cartLoading } = useQuery({
    queryKey: ["cart", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("cart")
        .select(`*, products:product_id(*)`)
        .eq("user_id", user.id);
      return data;
    },
  });

  useEffect(() => {
    if (!cartLoading && cartItems !== undefined && (!cartItems || cartItems.length === 0) && user) {
      toast({ title: "Cart is empty", description: "Add some products before checking out.", variant: "destructive" });
      navigate("/cart");
    }
  }, [cartItems, cartLoading, user, navigate, toast]);

  // Fire `begin_checkout` once when the page loads with non-empty cart
  useEffect(() => {
    if (!cartLoading && cartItems && cartItems.length > 0) {
      void trackEvent("begin_checkout", {
        item_count: cartItems.length,
        subtotal: cartItems.reduce(
          (sum: number, item: any) => sum + (item.products?.price || 0) * item.quantity,
          0
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLoading]);

  const subtotal = cartItems?.reduce((sum, item: any) => sum + (item.products?.price || 0) * item.quantity, 0) || 0;
  const volumeDiscount = cartItems
    ? calculateVolumeDiscount(
        (cartItems as any[]).map((item: any) => ({
          quantity: item.quantity,
          price: item.products?.price || 0,
          volume_tiers: item.products?.volume_tiers,
        }))
      )
    : 0;
  const discount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal - volumeDiscount - discount);

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    try {
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .single();

      if (error || !coupon) throw new Error("Invalid coupon code");
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) throw new Error("Coupon has expired");
      if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) throw new Error("Coupon usage limit reached");
      if (coupon.min_order_amount && subtotal < coupon.min_order_amount) {
        throw new Error(`Minimum order ₹${coupon.min_order_amount} required`);
      }

      let discountAmount = 0;
      if (coupon.discount_type === "percentage") {
        discountAmount = (subtotal * coupon.discount_value) / 100;
        if (coupon.max_discount_amount) {
          discountAmount = Math.min(discountAmount, coupon.max_discount_amount);
        }
      } else {
        discountAmount = coupon.discount_value;
      }
      discountAmount = Math.min(discountAmount, subtotal);

      setAppliedCoupon({
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        max_discount_amount: coupon.max_discount_amount,
        discountAmount,
      });
      toast({ title: "Coupon applied!", description: `You save ₹${discountAmount.toFixed(2)}` });
    } catch (e: any) {
      toast({ title: "Invalid Coupon", description: e.message, variant: "destructive" });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  const createOrder = async (): Promise<{ id: string; total: number }> => {
    try {
      checkoutSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) throw new Error(error.issues[0].message);
      throw error;
    }

    const couponPayload = appliedCoupon ? { couponCode: appliedCoupon.code } : {};

    if (!user) {
      const localCartItems = cartItems || [];
      if (localCartItems.length === 0) throw new Error("Cart is empty");
      const itemsForCheckout = localCartItems.map((item: any) => ({
        product_id: item.product_id, quantity: item.quantity,
      }));

      const { data, error } = await supabase.functions.invoke("guest-checkout", {
        body: {
          guestName: formData.name, guestEmail: formData.email,
          guestPhone: formData.phone, shippingAddress: formData.address,
          city: formData.city, state: formData.state, zipCode: formData.zipCode,
          cartItems: itemsForCheckout, ...couponPayload,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Checkout failed");
      return { id: data.orderId, total: data.total || total };
    }

    const { data, error } = await supabase.functions.invoke("authenticated-checkout", {
      body: {
        name: formData.name, email: formData.email, phone: formData.phone,
        shippingAddress: formData.address, city: formData.city, state: formData.state,
        zipCode: formData.zipCode, paymentMethod, ...couponPayload,
      },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Checkout failed");
    return { id: data.orderId, total: data.total };
  };

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      if (!paymentMethod) throw new Error("Please select a payment method");
      const orderResult = await createOrder();

      if (paymentMethod === "razorpay") {
        const { data: rzpData, error: rzpError } = await supabase.functions.invoke(
          "razorpay-create-order", { body: { orderId: orderResult.id } }
        );
        if (rzpError || !rzpData?.razorpayOrderId) {
          const message = await getFunctionErrorMessage(
            rzpError,
            rzpData,
            "Failed to initiate payment gateway. Please try again or choose Cash on Delivery."
          );
          throw new Error(message);
        }

        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) throw new Error("Payment SDK failed to load. Check your connection.");

        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: rzpData.keyId,
            amount: rzpData.amount,
            currency: rzpData.currency,
            order_id: rzpData.razorpayOrderId,
            name: "ShopHub",
            description: `Order #${String(orderResult.id).slice(0, 8)}`,
            prefill: {
              name: rzpData.customer?.name || formData.name,
              email: rzpData.customer?.email || formData.email,
              contact: rzpData.customer?.contact || formData.phone,
            },
            theme: { color: "#6366f1" },
            handler: async (response: any) => {
              try {
                const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
                  "razorpay-verify-payment",
                  {
                    body: {
                      shophubOrderId: orderResult.id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    },
                  }
                );
                if (verifyError || verifyData?.status !== "success") {
                  reject(new Error("Payment verification failed. Please contact support."));
                  return;
                }
                resolve();
                navigate(`/order-confirmation/${orderResult.id}`);
              } catch (err: any) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => reject(new Error("Payment cancelled")),
            },
          });
          rzp.on("payment.failed", (resp: any) => {
            reject(new Error(resp?.error?.description || "Payment failed"));
          });
          rzp.open();
        });

        return { id: orderResult.id, redirecting: true };
      }
      return { id: orderResult.id, redirecting: false };
    },
    onSuccess: (result) => {
      if (result.redirecting) return;
      toast({ title: "Order placed successfully!", description: "You chose Cash on Delivery." });
      navigate(`/order-confirmation/${result.id}`);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-0">
      <SEOHead title="Checkout — ShopHub" description="Complete your order securely." noindex />
      <Navbar />
      <div className="container px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact & Shipping */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-lg mb-4">Contact & Shipping</h2>
                {user && savedAddresses && savedAddresses.length > 0 && (
                  <div className="mb-4">
                    <Label className="flex items-center gap-1.5 mb-2"><MapPin className="h-3.5 w-3.5" /> Use a saved address</Label>
                    <Select value={selectedAddressId} onValueChange={handleSelectAddress}>
                      <SelectTrigger><SelectValue placeholder="Choose an address..." /></SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {savedAddresses.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.label} — {a.recipient_name}, {a.city} {a.is_default ? "★" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {user && (
                  <p className="text-xs text-muted-foreground mb-4 bg-primary/5 border border-primary/20 rounded-md px-3 py-2">
                    ✓ Auto-filled from your saved profile. Update below if needed.
                  </p>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><Label>Full Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" /></div>
                  <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="john@example.com" /></div>
                  <div className="sm:col-span-2"><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
                  <div className="sm:col-span-2"><Label>Address</Label><Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="123 Street, Area" /></div>
                  <div><Label>City</Label><Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Mumbai" /></div>
                  <div><Label>State</Label><Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="Maharashtra" /></div>
                  <div><Label>ZIP Code</Label><Input value={formData.zipCode} onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })} placeholder="400001" /></div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold text-lg mb-4">Payment Method</h2>
                <RadioGroup value={paymentMethod ?? undefined} onValueChange={(val) => setPaymentMethod(val as PaymentMethod)} className="space-y-3">
                  <label htmlFor="razorpay" className={`flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors ${paymentMethod === "razorpay" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                    <RadioGroupItem value="razorpay" id="razorpay" />
                    <Wallet className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Pay Online (Razorpay)</p>
                      <p className="text-xs text-muted-foreground">UPI, Credit/Debit Card, Net Banking, Wallets</p>
                    </div>
                    <div className="flex gap-1">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">UPI</span>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Cards</span>
                    </div>
                  </label>
                  <label htmlFor="cod" className={`flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors ${paymentMethod === "cod" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                    <RadioGroupItem value="cod" id="cod" />
                    <Truck className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Cash on Delivery</p>
                      <p className="text-xs text-muted-foreground">Pay when your order arrives at your doorstep</p>
                    </div>
                  </label>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary */}
          <div>
            <Card className="sticky top-20">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                {cartItems && cartItems.length > 0 && (
                  <div className="space-y-2 mb-4 divide-y">
                    {cartItems.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center py-2 text-sm">
                        <span className="text-muted-foreground line-clamp-1 flex-1 pr-2">
                          {item.products?.name} × {item.quantity}
                        </span>
                        <span className="font-medium whitespace-nowrap">₹{(item.products?.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coupon Section */}
                <div className="border-t pt-4 mb-4">
                  <Label className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Coupon Code
                  </Label>
                  {appliedCoupon ? (
                    <div className="flex items-center gap-2 mt-2 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-mono font-bold text-green-700">{appliedCoupon.code}</p>
                        <p className="text-xs text-green-600">You save ₹{appliedCoupon.discountAmount.toFixed(2)}</p>
                      </div>
                      <button onClick={removeCoupon} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <Input
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="Enter code"
                        className="font-mono text-sm"
                        maxLength={30}
                        onKeyDown={e => e.key === "Enter" && applyCoupon()}
                      />
                      <Button variant="outline" size="sm" onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} className="shrink-0">
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  {volumeDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Bulk savings</span>
                      <span>-₹{volumeDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-₹{discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span className="text-green-600">Free</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  variant="premium"
                  onClick={() => placeOrderMutation.mutate()}
                  disabled={placeOrderMutation.isPending || !paymentMethod}
                >
                  {placeOrderMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                  ) : !paymentMethod ? (
                    <><Wallet className="mr-2 h-4 w-4" />Select Payment Method</>
                  ) : paymentMethod === "razorpay" ? (
                    <><CreditCard className="mr-2 h-4 w-4" />Pay ₹{total.toFixed(2)}</>
                  ) : (
                    <><Truck className="mr-2 h-4 w-4" />Place Order (COD)</>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-1.5 mt-3 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Secure & encrypted checkout
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky mobile place-order bar */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3 safe-area-bottom">
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="text-lg font-bold text-primary">₹{total.toFixed(2)}</span>
        </div>
        <Button
          className="ml-auto h-11 rounded-xl text-sm font-semibold flex-1 max-w-[60%]"
          variant="premium"
          onClick={() => placeOrderMutation.mutate()}
          disabled={placeOrderMutation.isPending || !paymentMethod}
        >
          {placeOrderMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
          ) : !paymentMethod ? (
            "Select Payment"
          ) : paymentMethod === "razorpay" ? (
            <><CreditCard className="mr-1.5 h-4 w-4" />Pay Now</>
          ) : (
            <><Truck className="mr-1.5 h-4 w-4" />Place Order</>
          )}
        </Button>
      </div>
    </div>
  );
}
