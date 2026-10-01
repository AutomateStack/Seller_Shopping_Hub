import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, ShoppingCart, Truck, FileText, Package, HelpCircle, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { OrderStatusHistory } from "@/components/order/OrderStatusHistory";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";

interface OrderItem {
  product_id: string | null;
  product_name: string;
  quantity: number;
  product_price: number;
  subtotal: number;
  products?: {
    id: string;
    image_url: string | null;
    category: string | null;
    description: string | null;
  } | null;
}

interface Order {
  id: string;
  total_amount: number;
  discount_amount: number | null;
  coupon_code: string | null;
  shipping_fee: number | null;
  tax_amount: number | null;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  status: string;
  created_at: string;
  shipping_address: string;
  city: string;
  state: string;
  zip_code: string;
  order_items: OrderItem[];
}

export default function Orders() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    getOrders();
  }, []);

  const getOrders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, total_amount, discount_amount, coupon_code, shipping_fee, tax_amount,
        tracking_number, estimated_delivery_date, status, created_at,
        shipping_address, city, state, zip_code,
        order_items (
          product_id, product_name, quantity, product_price, subtotal,
          products:product_id (id, image_url, category, description)
        )
      `)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: "Failed to load orders", variant: "destructive" });
    } else {
      setOrders((data as any) || []);
    }
    setLoading(false);
  };

  const handleReorder = async (order: Order) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }

    const validItems = order.order_items.filter(item => item.product_id);
    if (!validItems.length) {
      toast({ title: "Cannot reorder", description: "Products are no longer available", variant: "destructive" });
      return;
    }

    for (const item of validItems) {
      const { data: existing } = await supabase
        .from("cart")
        .select("id, quantity")
        .eq("user_id", session.user.id)
        .eq("product_id", item.product_id!)
        .maybeSingle();

      if (existing) {
        await supabase.from("cart").update({ quantity: existing.quantity + item.quantity }).eq("id", existing.id);
      } else {
        await supabase.from("cart").insert({ user_id: session.user.id, product_id: item.product_id!, quantity: item.quantity });
      }
    }

    toast({ title: "Items added to cart", description: `${validItems.length} item(s) added to your cart` });
    navigate("/cart");
  };

  const handleDownloadInvoice = (order: Order) => {
    const itemsSubtotal = order.order_items.reduce((s, i) => s + i.subtotal, 0);
    const shipping = Number(order.shipping_fee || 0);
    const tax = Number(order.tax_amount || 0);
    const discount = Number(order.discount_amount || 0);

    const html = `
<!DOCTYPE html><html><head><title>Invoice #${order.id.slice(-8)}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:auto;padding:40px;color:#333}
h1{color:#111;border-bottom:2px solid #eee;padding-bottom:10px}
table{width:100%;border-collapse:collapse;margin:20px 0}
th,td{padding:10px;text-align:left;border-bottom:1px solid #eee}
th{background:#f8f8f8;font-weight:600}
.total-row td{font-weight:bold;font-size:16px;border-top:2px solid #333}
.header{display:flex;justify-content:space-between;align-items:start}
.meta{color:#666;font-size:14px}
.amount{text-align:right}
@media print{body{padding:20px}}
</style></head><body>
<div class="header"><div><h1>Invoice</h1><p class="meta">Order #${order.id.slice(-8)}<br/>Date: ${format(new Date(order.created_at), "PPP")}<br/>Status: ${order.status}</p></div>
<div style="text-align:right"><strong>ShopHub</strong><br/><span class="meta">Thank you for your purchase!</span></div></div>
<h3>Shipping Address</h3><p class="meta">${order.shipping_address}<br/>${order.city}, ${order.state} ${order.zip_code}</p>
<table><thead><tr><th>Product</th><th>Qty</th><th class="amount">Price</th><th class="amount">Subtotal</th></tr></thead><tbody>
${order.order_items.map(i => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td class="amount">₹${i.product_price.toFixed(2)}</td><td class="amount">₹${i.subtotal.toFixed(2)}</td></tr>`).join("")}
</tbody></table>
<table style="width:300px;margin-left:auto"><tbody>
<tr><td>Subtotal</td><td class="amount">₹${itemsSubtotal.toFixed(2)}</td></tr>
${shipping > 0 ? `<tr><td>Shipping</td><td class="amount">₹${shipping.toFixed(2)}</td></tr>` : ''}
${tax > 0 ? `<tr><td>Tax</td><td class="amount">₹${tax.toFixed(2)}</td></tr>` : ''}
${discount > 0 ? `<tr><td>Discount${order.coupon_code ? ` (${order.coupon_code})` : ''}</td><td class="amount">-₹${discount.toFixed(2)}</td></tr>` : ''}
<tr class="total-row"><td>Total</td><td class="amount">₹${Number(order.total_amount).toFixed(2)}</td></tr>
</tbody></table>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) setTimeout(() => w.print(), 500);
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="My Orders — ShopHub" description="Track and manage your ShopHub orders." canonical="/orders" />
      <Navbar />
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">My Orders</h1>

          {/* Order Summary Stats */}
          {orders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{orders.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Processing</p>
                  <p className="text-xl font-bold text-primary">{orders.filter(o => o.status === "processing").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Shipped</p>
                  <p className="text-xl font-bold text-purple-600">{orders.filter(o => o.status === "shipped").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Delivered</p>
                  <p className="text-xl font-bold text-green-600">{orders.filter(o => o.status === "delivered").length}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-muted-foreground mb-4">You haven't placed any orders yet.</p>
                  <Link to="/products" className="text-primary hover:underline">Start shopping</Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const itemsSubtotal = order.order_items.reduce((s, i) => s + i.subtotal, 0);
                const shipping = Number(order.shipping_fee || 0);
                const tax = Number(order.tax_amount || 0);
                const discount = Number(order.discount_amount || 0);

                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">Order #{order.id.slice(-8)}</CardTitle>
                          <CardDescription>{format(new Date(order.created_at), "PPP")}</CardDescription>
                        </div>
                        <div className="text-right flex flex-col items-end gap-2">
                          <Badge className={getStatusColor(order.status)}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </Badge>
                          <p className="text-lg font-semibold">₹{Number(order.total_amount).toFixed(2)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <OrderTimeline status={order.status} />
                      <OrderStatusHistory orderId={order.id} />

                      {/* Tracking Info */}
                      {(order.tracking_number || order.estimated_delivery_date) && (
                        <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3 text-sm">
                          <Truck className="h-4 w-4 text-primary flex-shrink-0" />
                          <div>
                            {order.tracking_number && (
                              <p><span className="text-muted-foreground">Tracking:</span> <span className="font-mono font-medium">{order.tracking_number}</span></p>
                            )}
                            {order.estimated_delivery_date && (
                              <p><span className="text-muted-foreground">Estimated Delivery:</span> {format(new Date(order.estimated_delivery_date), "PPP")}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Order Items */}
                      <div className="space-y-0">
                        {order.order_items.map((item, index) => {
                          const product = item.products as any;
                          return (
                            <div key={index} className="flex items-start gap-4 py-3 border-b last:border-b-0">
                              <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                                {product?.image_url ? (
                                  <img src={product.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {item.product_id ? (
                                  <Link to={`/products/${item.product_id}`} className="font-medium text-primary hover:underline inline-flex items-center gap-1">
                                    {item.product_name}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                ) : (
                                  <p className="font-medium">{item.product_name}</p>
                                )}
                                {product?.category && (
                                  <p className="text-xs text-muted-foreground mt-0.5">Category: {product.category}</p>
                                )}
                                {product?.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{product.description}</p>
                                )}
                                <p className="text-sm text-muted-foreground mt-1">
                                  Qty: {item.quantity} × ₹{item.product_price.toFixed(2)}
                                </p>
                              </div>
                              <p className="font-semibold whitespace-nowrap">₹{item.subtotal.toFixed(2)}</p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cost Breakdown */}
                      <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span>₹{itemsSubtotal.toFixed(2)}</span>
                        </div>
                        {shipping > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Shipping</span>
                            <span>₹{shipping.toFixed(2)}</span>
                          </div>
                        )}
                        {tax > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax</span>
                            <span>₹{tax.toFixed(2)}</span>
                          </div>
                        )}
                        {discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount{order.coupon_code ? ` (${order.coupon_code})` : ''}</span>
                            <span>-₹{discount.toFixed(2)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-base">
                          <span>Total</span>
                          <span>₹{Number(order.total_amount).toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => handleReorder(order)} className="gap-1.5">
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Reorder
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(order)} className="gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          Invoice
                        </Button>
                        {order.status === "delivered" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/contact?subject=${encodeURIComponent("Return request — Order #" + order.id.slice(-8))}&orderId=${order.id.slice(-8)}`)}
                            className="gap-1.5"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Request return
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/contact?orderId=${order.id.slice(-8)}`)}
                          className="gap-1.5"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                          Need Help?
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
