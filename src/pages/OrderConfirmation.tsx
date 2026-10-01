import { useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Package, Truck, ArrowRight, ShoppingBag } from "lucide-react";
import { format } from "date-fns";
import { SEOHead } from "@/components/SEOHead";
import { trackEvent } from "@/lib/analytics";
import { PostOrderUpsell } from "@/components/order/PostOrderUpsell";
import { formatINR } from "@/lib/format";

export default function OrderConfirmation() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const { data: order, isLoading } = useQuery({
    queryKey: ["order-confirmation", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`*, order_items(*)`)
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fire a `purchase` event exactly once when the order loads.
  useEffect(() => {
    if (order?.id) {
      void trackEvent("purchase", {
        order_id: order.id,
        total: Number(order.total_amount),
        item_count: order.order_items?.length ?? 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container px-4 py-16 text-center">
          <p className="text-muted-foreground">Order not found.</p>
          <Link to="/">
            <Button variant="premium" className="mt-4">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusSteps = [
    { label: "Order Placed", icon: CheckCircle2, done: true },
    { label: "Processing", icon: Package, done: ["processing", "shipped", "delivered"].includes(order.status) },
    { label: "Shipped", icon: Truck, done: ["shipped", "delivered"].includes(order.status) },
    { label: "Delivered", icon: CheckCircle2, done: order.status === "delivered" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Order Confirmed — Thank You for Your Purchase | ShopHub"
        description="Your ShopHub order has been confirmed. Track your shipment, view items and estimated delivery details."
        noindex
      />
      <Navbar />
      <main id="main-content" className="container px-4 py-12 max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground text-lg">
            Thank you for your purchase. Your order has been placed successfully.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Order ID: <span className="font-mono font-medium text-foreground">#{order.id.slice(-12).toUpperCase()}</span>
          </p>
        </div>

        {/* Status Timeline */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Order Status</h2>
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center flex-1">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 mb-2 transition-colors ${
                    step.done
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border text-muted-foreground"
                  }`}>
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span className={`text-xs text-center ${step.done ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                  {i < statusSteps.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Order Summary</h2>
            <div className="space-y-3 divide-y">
              {(order.order_items as any[])?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">Qty: {item.quantity} × ₹{Number(item.product_price).toFixed(2)}</p>
                  </div>
                  <p className="font-semibold">₹{Number(item.subtotal).toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary">{formatINR(order.total_amount)}</span>
            </div>
          </CardContent>
        </Card>

        <PostOrderUpsell
          categoryHints={[]}
          excludeIds={(order.order_items as any[])?.map((i: any) => i.product_id).filter(Boolean) || []}
        />

        {/* Shipping Info */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-3">Shipping To</h2>
            <div className="text-muted-foreground space-y-1">
              {order.guest_name && <p className="text-foreground font-medium">{order.guest_name}</p>}
              <p>{order.shipping_address}</p>
              <p>{order.city}, {order.state} - {order.zip_code}</p>
              {order.guest_email && <p className="text-sm">{order.guest_email}</p>}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Placed on {format(new Date(order.created_at!), "PPP 'at' p")}
            </p>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/orders">
            <Button variant="outline" className="w-full sm:w-auto gap-2">
              <Package className="h-4 w-4" />
              View My Orders
            </Button>
          </Link>
          <Link to="/products">
            <Button variant="premium" className="w-full sm:w-auto gap-2">
              <ShoppingBag className="h-4 w-4" />
              Continue Shopping
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
