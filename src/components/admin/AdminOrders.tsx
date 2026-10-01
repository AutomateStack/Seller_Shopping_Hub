import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, Download, Package, Clock, Truck, CheckCircle, XCircle, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { OrderDetailsDialog } from "@/components/admin/OrderDetailsDialog";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AdminOrdersProps {
  orders: any[] | undefined;
}

const PAGE_SIZE = 15;

const statusConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline"; iconClass: string }> = {
  pending: { label: "Pending", icon: Clock, variant: "secondary", iconClass: "text-amber-500" },
  processing: { label: "Processing", icon: Package, variant: "outline", iconClass: "text-blue-500" },
  shipped: { label: "Shipped", icon: Truck, variant: "default", iconClass: "text-purple-500" },
  delivered: { label: "Delivered", icon: CheckCircle, variant: "default", iconClass: "text-green-500" },
  cancelled: { label: "Cancelled", icon: XCircle, variant: "destructive", iconClass: "text-red-500" },
};

export function AdminOrders({ orders }: AdminOrdersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");

  // Fetch profiles for authenticated orders
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, phone");
      return data || [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, any> = {};
    profiles?.forEach((p) => { map[p.id] = p; });
    return map;
  }, [profiles]);

  const getCustomerInfo = (order: any) => {
    if (order.user_id && profileMap[order.user_id]) {
      const p = profileMap[order.user_id];
      return {
        name: order.guest_name || p.full_name || p.email,
        email: order.guest_email || p.email,
        phone: order.guest_phone || p.phone || "N/A",
        type: "registered",
      };
    }
    return { name: order.guest_name || "Guest", email: order.guest_email || "N/A", phone: order.guest_phone || "N/A", type: "guest" };
  };

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) throw error;

      // Send email notification for shipped/delivered status changes
      if (status === "shipped" || status === "delivered") {
        try {
          const order = orders?.find(o => o.id === orderId);
          if (order) {
            const customer = getCustomerInfo(order);
            if (customer.email && customer.email !== "N/A") {
              await supabase.functions.invoke("send-order-email", {
                body: { type: status, orderId },
              });
            }
          }
        } catch (emailErr) {
          console.error("Failed to send status email:", emailErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Order status updated" });
    },
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async (status: "pending" | "processing" | "shipped" | "delivered" | "cancelled") => {
      const { error } = await supabase.from("orders").update({ status }).in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: `Updated ${selectedIds.length} orders` });
      setSelectedIds([]);
      setBulkStatus("");
    },
    onError: (e: any) => toast({ title: "Bulk update failed", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order) => {
      const customer = getCustomerInfo(order);
      const matchesSearch =
        customer.name.toLowerCase().includes(search.toLowerCase()) ||
        customer.email.toLowerCase().includes(search.toLowerCase()) ||
        order.id.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        (paymentFilter === "cod" && !order.payment_id) ||
        (paymentFilter === "online" && order.payment_id);

      let matchesDate = true;
      if (dateFilter !== "all") {
        const orderDate = new Date(order.created_at);
        const now = new Date();
        if (dateFilter === "today") {
          matchesDate = orderDate.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          matchesDate = orderDate >= new Date(now.getTime() - 7 * 86400000);
        } else if (dateFilter === "month") {
          matchesDate = orderDate >= new Date(now.getTime() - 30 * 86400000);
        }
      }

      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
  }, [orders, search, statusFilter, paymentFilter, dateFilter, profileMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedOrders = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page when filters change
  useMemo(() => { setPage(1); }, [search, statusFilter, paymentFilter, dateFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!orders) return { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, revenue: 0 };
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === "pending").length,
      processing: orders.filter(o => o.status === "processing").length,
      shipped: orders.filter(o => o.status === "shipped").length,
      delivered: orders.filter(o => o.status === "delivered").length,
      revenue: orders.reduce((s, o) => s + Number(o.total_amount), 0),
    };
  }, [orders]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setDateFilter("all");
  };

  const hasActiveFilters = search || statusFilter !== "all" || paymentFilter !== "all" || dateFilter !== "all";

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Order ID", "Customer", "Email", "Phone", "Type", "Total", "Status", "Payment", "Date", "Address"];
    const rows = filtered.map((o) => {
      const c = getCustomerInfo(o);
      return [
        o.id.slice(0, 8), c.name, c.email, c.phone, c.type,
        o.total_amount, o.status, o.payment_status || "COD",
        new Date(o.created_at).toLocaleDateString(),
        `"${o.shipping_address}, ${o.city}, ${o.state} ${o.zip_code}"`,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-muted-foreground">Manage and track all customer orders</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { clearFilters(); }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Orders</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { clearFilters(); setStatusFilter("pending"); }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Pending</p>
            <p className="text-2xl font-bold text-secondary">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { clearFilters(); setStatusFilter("processing"); }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Processing</p>
            <p className="text-2xl font-bold text-primary">{stats.processing}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { clearFilters(); setStatusFilter("shipped"); }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Shipped</p>
            <p className="text-2xl font-bold text-purple-600">{stats.shipped}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { clearFilters(); setStatusFilter("delivered"); }}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Delivered</p>
            <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, or order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="shipped">Shipped</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="cod">COD</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Date" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear filters">
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing {filtered.length} of {orders?.length || 0} orders
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <Badge variant="default" className="text-sm">{selectedIds.length} selected</Badge>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Set status to..." /></SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!bulkStatus || bulkUpdateStatusMutation.isPending}
            onClick={() => bulkUpdateStatusMutation.mutate(bulkStatus as any)}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelectedIds([])}>
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedIds.includes(o.id))}
                    onCheckedChange={(checked) => {
                      const ids = paginatedOrders.map(o => o.id);
                      if (checked) setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
                      else setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                    }}
                  />
                </TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.map((order) => {
                const customer = getCustomerInfo(order);
                const checked = selectedIds.includes(order.id);
                return (
                  <TableRow key={order.id} data-state={checked ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setSelectedIds(prev => c ? [...prev, order.id] : prev.filter(id => id !== order.id));
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => { setSelectedOrder(order); setOrderDetailsOpen(true); }}
                        className="font-mono text-xs text-primary hover:underline cursor-pointer"
                      >
                        {order.id.slice(0, 8)}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{customer.name}</div>
                      <div className="text-xs text-muted-foreground">{customer.email}</div>
                      {customer.type === "guest" && <Badge variant="outline" className="text-[10px] mt-0.5 px-1 py-0">Guest</Badge>}
                    </TableCell>
                    <TableCell className="font-bold">₹{Number(order.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={order.payment_status === "paid" ? "default" : "secondary"} className="text-xs">
                        {order.payment_status || "COD"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select value={order.status} onValueChange={(status) => updateOrderStatusMutation.mutate({ orderId: order.id, status: status as any })}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>
                              <span className="flex items-center gap-1.5">
                                <cfg.icon className={`h-3 w-3 ${cfg.iconClass}`} />
                                {cfg.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedOrder(order); setOrderDetailsOpen(true); }}>
                        <Eye className="h-4 w-4 mr-1" />Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No orders found</p>
                    <p className="text-xs">Try adjusting your filters</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} · {filtered.length} orders
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <OrderDetailsDialog
        order={selectedOrder}
        open={orderDetailsOpen}
        onOpenChange={setOrderDetailsOpen}
        getCustomerInfo={getCustomerInfo}
        statusVariant={(s) => statusConfig[s]?.variant || "secondary"}
      />
    </div>
  );
}