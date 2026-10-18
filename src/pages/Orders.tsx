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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { OrderTimeline } from "@/components/order/OrderTimeline";
import { OrderStatusHistory } from "@/components/order/OrderStatusHistory";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";
import { MarketplaceOrderItemActions } from "@/components/order/MarketplaceOrderItemActions";

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
  const [marketplaceOrders, setMarketplaceOrders] = useState<any[]>([]);
  const [marketplaceHistory, setMarketplaceHistory] = useState<Record<string, any[]>>({});
  const [returnRequests, setReturnRequests] = useState<Record<string, any>>({});
  const [returnSubmitting, setReturnSubmitting] = useState<string | null>(null);
  const [returnReasonDrafts, setReturnReasonDrafts] = useState<Record<string, string>>({});
  const [returnFormOpen, setReturnFormOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getOrders();
  }, []);

  const getOrders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const [legacyResult, marketplaceResult] = await Promise.all([
      supabase.from("orders").select(`
        id, total_amount, discount_amount, coupon_code, shipping_fee, tax_amount,
        tracking_number, estimated_delivery_date, status, created_at,
        shipping_address, city, state, zip_code,
        order_items (product_id, product_name, quantity, product_price, subtotal,
          products:product_id (id, image_url, category, description))
      `).eq("user_id", session.user.id).order("created_at", { ascending: false }),
      (supabase as any).schema("orders").from("marketplace_orders")
        .select("id,order_number,status,payment_method,payment_status,refund_status,refund_amount,refunded_at,subtotal,shipping_amount,total_amount,shipping_name,shipping_phone,shipping_address,shipping_city,shipping_state,shipping_postal_code,created_at,marketplace_order_items(id,product_id,product_title,quantity,unit_price,line_total,image_url)")
        .eq("buyer_id", session.user.id).order("created_at", { ascending: false })
    ]);
    if (!legacyResult.error) setOrders((legacyResult.data as any) || []);
    if (!marketplaceResult.error) {
      const loadedOrders = marketplaceResult.data || [];
      setMarketplaceOrders(loadedOrders);
      const orderIds = loadedOrders.map((o:any)=>o.id);
      if (orderIds.length) {
        const { data: returnRows } = await (supabase as any).schema("orders").from("marketplace_return_requests").select("id,order_id,status,seller_note,created_at").in("order_id", orderIds);
        const requestMap: Record<string,any> = {};
        (returnRows || []).forEach((row:any) => { requestMap[row.order_id] = row; });
        setReturnRequests(requestMap);
      }
      if (orderIds.length) {
        const {data: historyRows} = await (supabase as any).schema("orders").from("marketplace_order_history").select("id,order_id,event_type,old_value,new_value,amount,changed_at").in("order_id", orderIds).order("changed_at", {ascending:false});
        const grouped:Record<string,any[]> = {};
        (historyRows||[]).forEach((event:any)=>{(grouped[event.order_id] ||= []).push(event);});
        setMarketplaceHistory(grouped);
      }
    }
    if (legacyResult.error && marketplaceResult.error) {
      toast({ title: "Error loading orders", description: marketplaceResult.error.message || legacyResult.error.message || "Please refresh and try again.", variant: "destructive" });
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
      returned: "bg-orange-100 text-orange-800",
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

          {marketplaceOrders.length > 0 && <section className="mb-8 space-y-4">
            <h2 className="text-xl font-semibold">Marketplace orders</h2>
            {marketplaceOrders.map((order:any) => <Card key={order.id}><details><summary className="list-none cursor-pointer"><div className="flex items-center gap-3 px-4 py-3"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">{order.marketplace_order_items?.[0]?.product_id ? <Link to={`/marketplace/products/${order.marketplace_order_items[0].product_id}`} aria-label={`View ${order.marketplace_order_items[0].product_title}`}>{order.marketplace_order_items?.[0]?.image_url ? <img src={order.marketplace_order_items[0].image_url} alt={order.marketplace_order_items[0].product_title} className="h-full w-full object-cover"/> : <Package className="m-4 h-6 w-6 text-muted-foreground"/>}</Link> : order.marketplace_order_items?.[0]?.image_url ? <img src={order.marketplace_order_items[0].image_url} alt={order.marketplace_order_items[0].product_title} className="h-full w-full object-cover"/> : <Package className="m-4 h-6 w-6 text-muted-foreground"/>}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{order.order_number}</p><p className="truncate text-sm text-muted-foreground">{order.marketplace_order_items?.[0]?.product_id ? <Link className="hover:text-primary hover:underline" to={`/marketplace/products/${order.marketplace_order_items[0].product_id}`}>{order.marketplace_order_items?.[0]?.product_title || "Marketplace order"}</Link> : order.marketplace_order_items?.[0]?.product_title || "Marketplace order"} · {format(new Date(order.created_at), "PPP")}</p><div className="mt-1 flex items-center gap-2"><Badge className={getStatusColor(order.status)}>{String(order.status).replaceAll("_"," ").replace(/\\b\\w/g,(c:string)=>c.toUpperCase())}</Badge><span className="text-sm font-semibold">₹{Number(order.total_amount).toFixed(2)}</span></div></div><span className="shrink-0 text-xs text-muted-foreground">Details⌄</span></div></summary><div className="border-t"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-lg">{order.order_number}</CardTitle><CardDescription>{format(new Date(order.created_at), "PPP")} · {String(order.payment_method||"cod").toUpperCase()}</CardDescription></div><div className="text-right"><Badge className={getStatusColor(order.status)}>{String(order.status).replaceAll("_"," ").replace(/\\b\\w/g,(c:string)=>c.toUpperCase())}</Badge><p className="mt-2 text-lg font-semibold">₹{Number(order.total_amount).toFixed(2)}</p>{order.status === "returned" && <div className="mt-2 rounded-lg border bg-muted/30 p-3 text-left"><p className="text-xs font-medium text-muted-foreground">Refund status</p><div className="mt-1 flex flex-wrap items-center gap-2"><Badge variant={order.refund_status==="refunded"?"default":order.refund_status==="pending"?"secondary":"outline"}>{order.refund_status==="refunded"?"Refunded":order.refund_status==="pending"?"Refund pending":"No refund recorded"}</Badge>{Number(order.refund_amount)>0&&<span className="text-sm font-semibold">₹{Number(order.refund_amount).toFixed(2)} · {Number(order.refund_amount)+0.005<Number(order.total_amount)?"Partial refund":"Full refund"}</span>}</div>{order.payment_status==="paid"&&<p className="mt-1 text-xs text-muted-foreground">Payment collected: <span className="font-medium text-foreground">₹{Number(order.total_amount).toFixed(2)}</span></p>}{order.refund_status==="refunded"&&<p className="mt-1 text-xs text-muted-foreground">Net amount after refund: <span className="font-semibold text-foreground">₹{Math.max(0,Number(order.total_amount)-Number(order.refund_amount)).toFixed(2)}</span></p>}{order.refund_status==="pending"&&<p className="mt-1 text-xs text-muted-foreground">Your refund is pending processing. The status will update once the refund is recorded as completed.</p>}{order.refund_status==="refunded"&&<p className="mt-1 text-xs text-muted-foreground">Refund recorded{order.refunded_at?" on "+format(new Date(order.refunded_at),"PPP"):""}.</p>}{(!order.refund_status||order.refund_status==="not_applicable")&&<p className="mt-1 text-xs text-muted-foreground">Your order is returned, but no refund has been recorded yet. Contact support if you believe a refund is due.</p>}</div>}{order.status === "delivered" && <div className="mt-3 space-y-2">{returnRequests[order.id] ? <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary" className="capitalize">Return {returnRequests[order.id].status}</Badge>{returnRequests[order.id]?.seller_note&&<p className="text-xs text-muted-foreground">{returnRequests[order.id].seller_note}</p>}</div> : <>{!returnFormOpen[order.id] ? <Button size="sm" variant="outline" onClick={()=>setReturnFormOpen(prev=>({...prev,[order.id]:true}))}><Undo2 className="mr-2 h-4 w-4"/>Request return</Button> : <div className="max-w-lg space-y-2 rounded-lg border bg-muted/20 p-3"><p className="text-sm font-medium">Request a return</p><p className="text-xs text-muted-foreground">Tell the seller what went wrong. Please enter at least 5 characters.</p><Textarea aria-label={"Return reason for "+order.order_number} placeholder="Describe the reason for your return…" rows={3} className="text-sm" value={returnReasonDrafts[order.id]||""} onChange={e=>setReturnReasonDrafts(prev=>({...prev,[order.id]:e.target.value}))}/><div className="flex flex-wrap gap-2"><Button size="sm" disabled={returnSubmitting===order.id || (returnReasonDrafts[order.id]||"").trim().length<5} onClick={async()=>{const reason=(returnReasonDrafts[order.id]||"").trim();setReturnSubmitting(order.id);const {error}=await (supabase as any).rpc("request_marketplace_return",{p_order_id:order.id,p_reason:reason});setReturnSubmitting(null);if(error){toast({title:"Could not request return",description:error.message,variant:"destructive"});return;}setReturnReasonDrafts(prev=>({...prev,[order.id]:""}));setReturnFormOpen(prev=>({...prev,[order.id]:false}));toast({title:"Return requested",description:"The seller will review your request."});await getOrders();}}>{returnSubmitting===order.id?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Submitting…</>:"Submit request"}</Button><Button size="sm" variant="ghost" onClick={()=>setReturnFormOpen(prev=>({...prev,[order.id]:false}))}>Cancel</Button></div></div>}</>}</div>}{order.status === "returned" && <details className="mt-3 rounded-lg border p-3 text-left"><summary className="cursor-pointer text-sm font-medium">View return &amp; refund history <span className="ml-1 text-xs font-normal text-muted-foreground">({(marketplaceHistory[order.id]||[]).length} events)</span></summary><div className="mt-3 space-y-2">{(marketplaceHistory[order.id]||[]).filter((event:any)=>!(event.event_type==="refund_status"&&event.old_value==null&&event.new_value==="not_applicable")).map((event:any)=><div key={event.id} className="flex gap-2 text-xs"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"/><div><p className="font-medium">{event.event_type==="order_status"?"Order status":event.event_type==="refund_status"?"Refund status":"Payment status"}: {event.old_value?String(event.old_value).replaceAll("_"," ")+" → ":""}{String(event.new_value||"updated").replaceAll("_"," ")}</p><p className="text-muted-foreground">{format(new Date(event.changed_at),"PPP p")}{event.event_type==="refund_status"&&Number(event.amount)>0?" · ₹"+Number(event.amount).toFixed(2):""}</p></div></div>)}{!(marketplaceHistory[order.id]||[]).length&&<p className="text-xs text-muted-foreground">History will appear when return or refund updates are recorded.</p>}</div></details>}</div></div></CardHeader><CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">{order.shipping_name} · {order.shipping_phone}<br/>{order.shipping_address}, {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}</div>
              {(order.marketplace_order_items||[]).map((item:any)=><div key={item.id} className="flex flex-wrap items-start gap-3 border-t pt-3"><Link to={item.product_id ? `/marketplace/products/${item.product_id}` : "/products"} aria-label={`View ${item.product_title}`} className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{item.image_url&&<img src={item.image_url} alt={item.product_title} className="h-full w-full object-cover transition-opacity hover:opacity-80"/>}</Link><div className="min-w-0 flex-1"><Link to={item.product_id ? `/marketplace/products/${item.product_id}` : "/products"} className="font-medium hover:text-primary hover:underline">{item.product_title}</Link><p className="text-sm text-muted-foreground">Qty {item.quantity} · ₹{Number(item.unit_price).toFixed(2)} each</p><MarketplaceOrderItemActions productId={item.product_id} orderStatus={order.status} productTitle={item.product_title}/></div><p className="font-medium">₹{Number(item.line_total).toFixed(2)}</p></div>)}
            </CardContent></div></details></Card>)}
          </section>}
          {/* Order Summary Stats */}
          {(orders.length + marketplaceOrders.length) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-xl font-bold">{orders.length + marketplaceOrders.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Processing</p>
                  <p className="text-xl font-bold text-primary">{orders.filter(o => o.status === "processing").length + marketplaceOrders.filter((o:any) => o.status === "processing").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Shipped</p>
                  <p className="text-xl font-bold text-purple-600">{orders.filter(o => o.status === "shipped").length + marketplaceOrders.filter((o:any) => o.status === "shipped").length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Delivered</p>
                  <p className="text-xl font-bold text-green-600">{orders.filter(o => o.status === "delivered").length + marketplaceOrders.filter((o:any) => o.status === "delivered").length}</p>
                </CardContent>
              </Card>
              <Card><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">Returned</p><p className="text-xl font-bold text-orange-600">{orders.filter(o => o.status === "returned").length + marketplaceOrders.filter((o:any) => o.status === "returned").length}</p></CardContent></Card>
            </div>
          )}

          {orders.length === 0 && marketplaceOrders.length === 0 ? (
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
