import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExternalLink, History, Printer, FileText, Copy } from "lucide-react";
import { OrderStatusHistory } from "@/components/order/OrderStatusHistory";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  order: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getCustomerInfo: (order: any) => { name: string; email: string; phone: string; type: string };
  statusVariant: (status: string) => "default" | "secondary" | "destructive" | "outline";
}

export function OrderDetailsDialog({ order, open, onOpenChange, getCustomerInfo, statusVariant }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const openPrintWindow = (title: string, bodyHtml: string) => {
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to print.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding:24px;color:#111}
        .label{width:100mm;border:1px dashed #999;padding:16px;margin-bottom:16px}
        .label h2{margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#666}
        .name{font-size:20px;font-weight:700;margin:0 0 4px}
        .addr{font-size:15px;line-height:1.5;margin:0 0 8px;white-space:pre-line}
        .meta{font-size:12px;color:#444;border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
        h1{font-size:20px;margin:0 0 4px}
        table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
        th,td{border-bottom:1px solid #e5e5e5;padding:8px;text-align:left}
        th{background:#f6f6f6}
        .right{text-align:right}
        .totals{margin-top:12px;font-size:13px;width:280px;margin-left:auto}
        .totals div{display:flex;justify-content:space-between;padding:4px 0}
        .totals .grand{border-top:1px solid #999;font-weight:700;font-size:15px;margin-top:4px;padding-top:6px}
        @media print{body{padding:0}.label{border:1px solid #000}}
      </style></head><body>${bodyHtml}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const esc = (v: any) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Order Details</DialogTitle></DialogHeader>
        {order && (() => {
          const customer = getCustomerInfo(order);
          const itemsSubtotal = order.order_items?.reduce((s: number, i: any) => s + Number(i.subtotal), 0) || 0;
          const shipping = Number(order.shipping_fee || 0);
          const tax = Number(order.tax_amount || 0);
          const discount = Number(order.discount_amount || 0);

          const shortId = order.id.slice(-12).toUpperCase();
          const addressText = `${customer.name}\n${order.shipping_address}\n${order.city}, ${order.state} - ${order.zip_code}\nPhone: ${customer.phone}`;

          const printLabel = () => openPrintWindow(`Shipping Label ${shortId}`, `
            <div class="label">
              <h2>Ship To</h2>
              <p class="name">${esc(customer.name)}</p>
              <p class="addr">${esc(order.shipping_address)}\n${esc(order.city)}, ${esc(order.state)} - ${esc(order.zip_code)}</p>
              <p class="addr"><strong>Phone:</strong> ${esc(customer.phone)}</p>
              <div class="meta">
                Order #${esc(shortId)}<br/>
                Date: ${esc(new Date(order.created_at).toLocaleDateString("en-IN"))}<br/>
                Items: ${esc(order.order_items?.length || 0)} &nbsp;|&nbsp; Amount: Rs. ${Number(order.total_amount).toFixed(2)}${order.payment_id ? " (Prepaid)" : ""}<br/>
                ${order.tracking_number ? `Tracking: ${esc(order.tracking_number)}<br/>` : ""}
                From: ShopsHub
              </div>
            </div>`);

          const printInvoice = () => openPrintWindow(`Invoice ${shortId}`, `
            <h1>Invoice — Order #${esc(shortId)}</h1>
            <div style="font-size:13px;color:#555">Date: ${esc(new Date(order.created_at).toLocaleString("en-IN"))}</div>
            <div style="display:flex;gap:40px;margin-top:16px;font-size:13px">
              <div><strong>Billed To</strong><br/>${esc(customer.name)}<br/>${esc(customer.email)}<br/>${esc(customer.phone)}</div>
              <div><strong>Ship To</strong><br/>${esc(order.shipping_address)}<br/>${esc(order.city)}, ${esc(order.state)} - ${esc(order.zip_code)}</div>
            </div>
            <table><thead><tr><th>Product</th><th class="right">Price</th><th class="right">Qty</th><th class="right">Subtotal</th></tr></thead>
            <tbody>${(order.order_items || []).map((i: any) => `<tr><td>${esc(i.product_name)}</td><td class="right">Rs. ${Number(i.product_price).toFixed(2)}</td><td class="right">${esc(i.quantity)}</td><td class="right">Rs. ${Number(i.subtotal).toFixed(2)}</td></tr>`).join("")}</tbody></table>
            <div class="totals">
              <div><span>Subtotal</span><span>Rs. ${itemsSubtotal.toFixed(2)}</span></div>
              ${shipping > 0 ? `<div><span>Shipping</span><span>Rs. ${shipping.toFixed(2)}</span></div>` : ""}
              ${tax > 0 ? `<div><span>Tax</span><span>Rs. ${tax.toFixed(2)}</span></div>` : ""}
              ${discount > 0 ? `<div><span>Discount${order.coupon_code ? ` (${esc(order.coupon_code)})` : ""}</span><span>-Rs. ${discount.toFixed(2)}</span></div>` : ""}
              <div class="grand"><span>Total</span><span>Rs. ${Number(order.total_amount).toFixed(2)}</span></div>
            </div>
            <p style="margin-top:24px;font-size:12px;color:#666">Thank you for shopping with ShopsHub.</p>`);

          return (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-2" onClick={printLabel}>
                  <Printer className="h-4 w-4" /> Print Address Label
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={printInvoice}>
                  <FileText className="h-4 w-4" /> Print Invoice
                </Button>
                <Button size="sm" variant="ghost" className="gap-2" onClick={() => {
                  navigator.clipboard.writeText(addressText);
                  toast({ title: "Address copied" });
                }}>
                  <Copy className="h-4 w-4" /> Copy Address
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Name:</span> {customer.name}</p>
                    <p><span className="text-muted-foreground">Email:</span> {customer.email}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {customer.phone}</p>
                    <p><span className="text-muted-foreground">Type:</span> <Badge variant="outline" className="text-xs">{customer.type}</Badge></p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Order Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{order.id.slice(0, 8)}</span></p>
                    <p><span className="text-muted-foreground">Status:</span> <Badge variant={statusVariant(order.status)}>{order.status}</Badge></p>
                    <p><span className="text-muted-foreground">Date:</span> {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}</p>
                    <p><span className="text-muted-foreground">Total:</span> <span className="font-bold">₹{Number(order.total_amount).toFixed(2)}</span></p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Tracking & Delivery</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Tracking Number</label>
                    <Input
                      placeholder="Enter tracking number..."
                      defaultValue={order.tracking_number || ""}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val !== (order.tracking_number || "")) {
                          supabase.from("orders").update({ tracking_number: val || null }).eq("id", order.id).then(() => {
                            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                            toast({ title: "Tracking number updated" });
                          });
                        }
                      }}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Estimated Delivery</label>
                    <Input
                      type="date"
                      defaultValue={order.estimated_delivery_date || ""}
                      onChange={(e) => {
                        supabase.from("orders").update({ estimated_delivery_date: e.target.value || null }).eq("id", order.id).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
                          toast({ title: "Delivery date updated" });
                        });
                      }}
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Shipping Address</h3>
                <div className="text-sm bg-muted p-3 rounded-md">
                  <p>{order.shipping_address}</p>
                  <p>{order.city}, {order.state} {order.zip_code}</p>
                  <p className="mt-1"><span className="text-muted-foreground">Phone:</span> {customer.phone}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Order Items ({order.order_items?.length || 0})</h3>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.order_items?.map((item: any) => {
                        const product = item.products;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
                                  {product?.image_url ? (
                                    <img src={product.image_url} alt={item.product_name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[10px]">N/A</div>
                                  )}
                                </div>
                                <div>
                                  {item.product_id ? (
                                    <a href={`/products/${item.product_id}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 font-medium">
                                      {item.product_name}
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <span>{item.product_name}</span>
                                  )}
                                  {product?.category && <p className="text-xs text-muted-foreground">{product.category}</p>}
                                  {product?.description && <p className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{product.description}</p>}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>₹{Number(item.product_price).toFixed(2)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="font-semibold">₹{Number(item.subtotal).toFixed(2)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

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
                <div className="border-t pt-2 flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>₹{Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Status History
                </h3>
                <div className="border rounded-lg p-4">
                  <OrderStatusHistory orderId={order.id} />
                </div>
              </div>

              {order.payment_id && (
                <div>
                  <h3 className="font-semibold mb-2">Payment Information</h3>
                  <div className="text-sm space-y-1">
                    <p><span className="text-muted-foreground">Payment ID:</span> <span className="font-mono">{order.payment_id}</span></p>
                    <p><span className="text-muted-foreground">Status:</span> <Badge>{order.payment_status}</Badge></p>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}