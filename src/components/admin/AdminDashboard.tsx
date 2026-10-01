import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, ShoppingCart, Clock, Package, Users, Gift, Brain, TrendingUp, Ticket, Trophy, Receipt, Layers, Repeat, Filter, Sparkles, Eye, MousePointerClick, CreditCard, BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, LineChart, Line, Legend, ComposedChart } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LowStockAlerts } from "@/components/admin/LowStockAlerts";
import { OpsSnapshot } from "@/components/admin/OpsSnapshot";

interface AdminDashboardProps {
  orders: any[] | undefined;
  products: any[] | undefined;
}

function exportOrdersCsv(orders: any[] | undefined) {
  if (!orders || orders.length === 0) return;
  const headers = [
    "Order ID", "Date", "Status", "Payment", "Total", "Discount", "Coupon",
    "Customer", "Email", "City", "State",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = orders.map((o) => [
    o.id,
    new Date(o.created_at).toISOString(),
    o.status,
    o.payment_status ?? "",
    Number(o.total_amount ?? 0).toFixed(2),
    Number(o.discount_amount ?? 0).toFixed(2),
    o.coupon_code ?? "",
    o.guest_name ?? o.profiles?.full_name ?? "",
    o.guest_email ?? o.profiles?.email ?? "",
    o.city ?? "",
    o.state ?? "",
  ]);
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AdminDashboard({ orders, products }: AdminDashboardProps) {
  const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
  const pendingOrders = orders?.filter(o => o.status === "pending").length || 0;
  const totalOrders = orders?.length || 0;
  const totalProducts = products?.length || 0;
  const deliveredOrders = orders?.filter(o => o.status === "delivered").length || 0;
  const cancelledOrders = orders?.filter(o => o.status === "cancelled").length || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const fulfillmentRate = totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

  // Client analytics: last 30 days conversion funnel from analytics_events
  const { data: analyticsFunnel } = useQuery<Record<string, number | string>>({
    queryKey: ["admin-analytics-funnel-30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data } = await supabase
        .from("analytics_events")
        .select("event_name")
        .gte("created_at", since.toISOString())
        .in("event_name", ["page_view", "view_product", "add_to_cart", "begin_checkout", "purchase"]);
      const counts = (data || []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.event_name] = (acc[row.event_name] || 0) + 1;
        return acc;
      }, {});
      const views = counts["page_view"] || 0;
      const purchases = counts["purchase"] || 0;
      const cvr = views > 0 ? ((purchases / views) * 100).toFixed(2) : "0.00";
      return { ...counts, views, purchases, cvr } as Record<string, number | string>;
    },
  });

  // Last 30 days daily revenue
  const dailyRevenueData = (() => {
    const days: { date: string; revenue: number; orders: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: 0,
        orders: 0,
      });
    }
    const idxByLabel = new Map(days.map((d, i) => [d.date, i]));
    orders?.forEach((o) => {
      const od = new Date(o.created_at);
      od.setHours(0, 0, 0, 0);
      const label = od.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const idx = idxByLabel.get(label);
      if (idx !== undefined && (today.getTime() - od.getTime()) <= 30 * 24 * 60 * 60 * 1000) {
        days[idx].revenue += Number(o.total_amount);
        days[idx].orders += 1;
      }
    });
    return days;
  })();

  // Fetch engagement metrics
  const { data: drawStats } = useQuery({
    queryKey: ["admin-draw-stats"],
    queryFn: async () => {
      const [draws, entries, winners] = await Promise.all([
        supabase.from("draws").select("id, status").then(r => r.data || []),
        supabase.from("draw_entries").select("id, entry_type, created_at").then(r => r.data || []),
        supabase.from("draw_winners").select("id, prize_amount").then(r => r.data || []),
      ]);
      return {
        totalDraws: draws.length,
        activeDraws: draws.filter(d => d.status === "active" || d.status === "upcoming").length,
        totalEntries: entries.length,
        freeEntries: entries.filter(e => e.entry_type === "free").length,
        paidEntries: entries.filter(e => e.entry_type === "paid").length,
        quizEntries: entries.filter(e => e.entry_type === "quiz").length,
        referralEntries: entries.filter(e => e.entry_type === "referral").length,
        totalWinners: winners.length,
        totalPrizesPaid: winners.reduce((sum, w) => sum + Number(w.prize_amount), 0),
      };
    },
  });

  const { data: quizStats } = useQuery({
    queryKey: ["admin-quiz-stats"],
    queryFn: async () => {
      const [quizzes, attempts] = await Promise.all([
        supabase.from("quizzes").select("id, is_active").then(r => r.data || []),
        supabase.from("quiz_attempts").select("id, score, total_questions, prize_won, created_at").then(r => r.data || []),
      ]);
      const passRate = attempts.length > 0
        ? Math.round((attempts.filter(a => a.prize_won).length / attempts.length) * 100)
        : 0;
      return {
        totalQuizzes: quizzes.length,
        activeQuizzes: quizzes.filter(q => q.is_active).length,
        totalAttempts: attempts.length,
        passRate,
        avgScore: attempts.length > 0
          ? (attempts.reduce((sum, a) => sum + (a.score / a.total_questions) * 100, 0) / attempts.length).toFixed(0)
          : "0",
      };
    },
  });

  const { data: customerCount } = useQuery({
    queryKey: ["admin-customer-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: newsletterCount } = useQuery({
    queryKey: ["admin-newsletter-count"],
    queryFn: async () => {
      const { count } = await supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).eq("is_active", true);
      return count || 0;
    },
  });

  const { data: topProducts } = useQuery({
    queryKey: ["admin-top-products"],
    queryFn: async () => {
      const { data } = await supabase.from("order_items").select("product_name, quantity");
      if (!data) return [];
      const productMap: Record<string, number> = {};
      data.forEach(item => {
        productMap[item.product_name] = (productMap[item.product_name] || 0) + item.quantity;
      });
      return Object.entries(productMap)
        .map(([name, sold]) => ({ name, sold }))
        .sort((a, b) => b.sold - a.sold)
        .slice(0, 5);
    },
  });

  // Top categories by revenue
  const { data: topCategories } = useQuery({
    queryKey: ["admin-top-categories"],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("order_items")
        .select("subtotal, product_id, products:product_id(category)");
      if (!items) return [];
      const map: Record<string, number> = {};
      items.forEach((it: any) => {
        const cat = it.products?.category || "Uncategorized";
        map[cat] = (map[cat] || 0) + Number(it.subtotal || 0);
      });
      return Object.entries(map)
        .map(([category, revenue]) => ({ category, revenue: Math.round(revenue) }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);
    },
  });

  // Repeat customer rate (proxy: users with >1 order / total customers with orders)
  const repeatCustomerStats = (() => {
    if (!orders) return { repeatRate: 0, totalBuyers: 0, repeatBuyers: 0 };
    const counts: Record<string, number> = {};
    orders.forEach((o) => {
      const key = o.user_id || `guest:${o.guest_email}`;
      if (!key || key === "guest:null") return;
      counts[key] = (counts[key] || 0) + 1;
    });
    const buyers = Object.values(counts);
    const repeatBuyers = buyers.filter((c) => c > 1).length;
    return {
      totalBuyers: buyers.length,
      repeatBuyers,
      repeatRate: buyers.length > 0 ? Math.round((repeatBuyers / buyers.length) * 100) : 0,
    };
  })();

  // Checkout funnel
  const { data: funnelData } = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: async () => {
      const [carts, ordersAll, paid] = await Promise.all([
        supabase.from("cart").select("user_id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
      ]);
      return {
        carts: carts.count || 0,
        orders: ordersAll.count || 0,
        paid: paid.count || 0,
      };
    },
  });

  const funnelChart = funnelData ? [
    { stage: "Active Carts", value: funnelData.carts, color: "hsl(195, 85%, 41%)" },
    { stage: "Orders Placed", value: funnelData.orders, color: "hsl(40, 96%, 55%)" },
    { stage: "Paid Orders", value: funnelData.paid, color: "hsl(145, 63%, 42%)" },
  ] : [];

  const cartToOrderRate = funnelData && funnelData.carts > 0
    ? Math.round((funnelData.orders / (funnelData.carts + funnelData.orders)) * 100)
    : 0;
  const orderToPaidRate = funnelData && funnelData.orders > 0
    ? Math.round((funnelData.paid / funnelData.orders) * 100)
    : 0;

  // Cohort retention (signups per month + % who placed an order)
  const { data: cohorts } = useQuery({
    queryKey: ["admin-cohorts"],
    queryFn: async () => {
      const [profilesRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("id, created_at"),
        supabase.from("orders").select("user_id").not("user_id", "is", null),
      ]);
      const profiles = profilesRes.data || [];
      const buyersSet = new Set((ordersRes.data || []).map((o: any) => o.user_id));
      const buckets: Record<string, { signups: number; buyers: number }> = {};
      profiles.forEach((p: any) => {
        const d = new Date(p.created_at);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        if (!buckets[key]) buckets[key] = { signups: 0, buyers: 0 };
        buckets[key].signups += 1;
        if (buyersSet.has(p.id)) buckets[key].buyers += 1;
      });
      return Object.entries(buckets)
        .map(([cohort, v]) => ({
          cohort,
          signups: v.signups,
          buyers: v.buyers,
          retention: v.signups > 0 ? Math.round((v.buyers / v.signups) * 100) : 0,
        }))
        .slice(-6);
    },
  });

  // Lucky Draw revenue trend (paid entry fees per month, last 6)
  const { data: drawRevenue } = useQuery({
    queryKey: ["admin-draw-revenue"],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("draw_entries")
        .select("created_at, draw_id, is_paid, draws:draw_id(entry_fee)")
        .eq("is_paid", true);
      if (!entries) return [];
      const map: Record<string, { revenue: number; entries: number }> = {};
      entries.forEach((e: any) => {
        const d = new Date(e.created_at);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        if (!map[key]) map[key] = { revenue: 0, entries: 0 };
        map[key].revenue += Number(e.draws?.entry_fee || 0);
        map[key].entries += 1;
      });
      return Object.entries(map)
        .map(([month, v]) => ({ month, revenue: Math.round(v.revenue), entries: v.entries }))
        .slice(-6);
    },
  });

  // Revenue by month
  const monthlyRevenue = orders?.reduce((acc: any, order) => {
    const month = new Date(order.created_at).toLocaleString("default", { month: "short", year: "2-digit" });
    acc[month] = (acc[month] || 0) + Number(order.total_amount);
    return acc;
  }, {}) || {};
  const revenueData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({ month, revenue })).slice(-6);

  // Orders by status
  const statusCounts = orders?.reduce((acc: any, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {}) || {};
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const COLORS = ["hsl(195, 85%, 41%)", "hsl(40, 96%, 55%)", "hsl(145, 63%, 42%)", "hsl(262, 83%, 58%)", "hsl(0, 84%, 60%)"];

  // Entry type distribution
  const entryTypeData = drawStats ? [
    { name: "Free", value: drawStats.freeEntries },
    { name: "Paid", value: drawStats.paidEntries },
    { name: "Quiz", value: drawStats.quizEntries },
    { name: "Referral", value: drawStats.referralEntries },
  ].filter(d => d.value > 0) : [];

  const stats = [
    { label: "Total Revenue", value: `₹${totalRevenue.toFixed(0)}`, icon: DollarSign, desc: "All time", color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
    { label: "Total Orders", value: totalOrders, icon: ShoppingCart, desc: `${deliveredOrders} delivered`, color: "text-primary bg-primary/10" },
    { label: "Pending Orders", value: pendingOrders, icon: Clock, desc: "Needs attention", color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30" },
      { label: "Products", value: totalProducts, icon: Package, desc: "In catalog", color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
      { label: "Customers", value: customerCount || 0, icon: Users, desc: `${newsletterCount || 0} subscribers`, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
    ];

  const performanceStats = [
    { label: "Avg Order Value", value: `₹${avgOrderValue.toFixed(0)}`, icon: Receipt, desc: `${totalOrders} orders`, color: "text-primary bg-primary/10" },
    { label: "Fulfillment Rate", value: `${fulfillmentRate}%`, icon: TrendingUp, desc: `${deliveredOrders}/${totalOrders} delivered`, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
    { label: "Repeat Buyers", value: `${repeatCustomerStats.repeatRate}%`, icon: Repeat, desc: `${repeatCustomerStats.repeatBuyers}/${repeatCustomerStats.totalBuyers} customers`, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
    { label: "Cancelled", value: cancelledOrders, icon: Layers, desc: `${totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0}% of orders`, color: "text-red-500 bg-red-100 dark:bg-red-900/30" },
  ];

  const engagementStats = [
    { label: "Draw Entries", value: drawStats?.totalEntries || 0, icon: Ticket, desc: `${drawStats?.activeDraws || 0} active draws`, color: "text-primary bg-primary/10" },
    { label: "Quiz Attempts", value: quizStats?.totalAttempts || 0, icon: Brain, desc: `${quizStats?.passRate || 0}% pass rate`, color: "text-secondary bg-secondary/10" },
    { label: "Prizes Paid", value: `₹${drawStats?.totalPrizesPaid?.toFixed(0) || 0}`, icon: Trophy, desc: `${drawStats?.totalWinners || 0} winners`, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
    { label: "Avg Quiz Score", value: `${quizStats?.avgScore || 0}%`, icon: TrendingUp, desc: `${quizStats?.activeQuizzes || 0} active quizzes`, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your store overview.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => exportOrdersCsv(orders)}
          disabled={!orders || orders.length === 0}
        >
          <Download className="h-4 w-4" />
          Export orders CSV
        </Button>
      </div>

      <OpsSnapshot orders={orders} products={products} />

      {/* Core Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                </div>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Engagement & Rewards
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {engagementStats.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Client Analytics — last 30 days */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Site Analytics — Last 30 Days
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Page Views", value: analyticsFunnel?.views ?? 0, icon: Eye, desc: "All routes", color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30" },
            { label: "Product Views", value: analyticsFunnel?.view_product ?? 0, icon: Package, desc: "Product detail loads", color: "text-primary bg-primary/10" },
            { label: "Add to Cart", value: analyticsFunnel?.add_to_cart ?? 0, icon: MousePointerClick, desc: "Cart additions", color: "text-orange-500 bg-orange-100 dark:bg-orange-900/30" },
            { label: "Begin Checkout", value: analyticsFunnel?.begin_checkout ?? 0, icon: CreditCard, desc: "Checkout starts", color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30" },
            { label: "Conversion Rate", value: `${analyticsFunnel?.cvr ?? "0.00"}%`, icon: TrendingUp, desc: `${analyticsFunnel?.purchases ?? 0} purchases`, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
          ].map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Performance Stats */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Performance Metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {performanceStats.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.desc}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Daily revenue last 30 days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Revenue & Orders (Last 30 Days)</CardTitle>
          <CardDescription>Track day-over-day store performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            {dailyRevenueData.some(d => d.revenue > 0 || d.orders > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" fontSize={11} interval="preserveStartEnd" />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <Tooltip formatter={(val: number, name: string) => name === "Revenue" ? `₹${val.toFixed(0)}` : val} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(195, 85%, 41%)" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="orders" name="Orders" stroke="hsl(40, 96%, 55%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No orders in the last 30 days</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(195, 85%, 41%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(195, 85%, 41%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(val: number) => `₹${val.toFixed(0)}`} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(195, 85%, 41%)" fill="url(#revenueGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order Status</CardTitle>
            <CardDescription>Distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entry Type Distribution + Quiz Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Entry Sources
            </CardTitle>
            <CardDescription>How users earn Lucky Draw entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {entryTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={entryTypeData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {entryTypeData.map((_, i) => (
                        <Cell key={i} fill={["hsl(145, 63%, 42%)", "hsl(195, 85%, 41%)", "hsl(40, 96%, 55%)", "hsl(262, 83%, 58%)"][i % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No entries yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <LowStockAlerts />
      </div>

      {/* Top Categories by Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Top Categories by Revenue
          </CardTitle>
          <CardDescription>Where your sales are coming from</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            {topCategories && topCategories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="category" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(val: number) => `₹${val.toFixed(0)}`} />
                  <Bar dataKey="revenue" fill="hsl(262, 83%, 58%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No category sales yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Selling Products</CardTitle>
          <CardDescription>By units sold</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {topProducts && topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={12} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={120} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip />
                  <Bar dataKey="sold" fill="hsl(195, 85%, 41%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No sales data yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checkout Funnel + Cohort Retention */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Checkout Funnel
            </CardTitle>
            <CardDescription>
              {funnelData ? `Cart → Order: ${cartToOrderRate}% · Order → Paid: ${orderToPaidRate}%` : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              {funnelChart.length > 0 && funnelChart.some(f => f.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={funnelChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis type="category" dataKey="stage" fontSize={11} width={110} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funnelChart.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">No funnel data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Cohort Retention
            </CardTitle>
            <CardDescription>Signups vs. paying customers per month</CardDescription>
          </CardHeader>
          <CardContent>
            {cohorts && cohorts.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-4 text-xs font-medium text-muted-foreground border-b pb-2">
                  <span>Cohort</span>
                  <span className="text-right">Signups</span>
                  <span className="text-right">Buyers</span>
                  <span className="text-right">Retention</span>
                </div>
                {cohorts.map((c) => (
                  <div key={c.cohort} className="grid grid-cols-4 text-sm items-center py-1.5 border-b last:border-0">
                    <span className="font-medium">{c.cohort}</span>
                    <span className="text-right tabular-nums">{c.signups}</span>
                    <span className="text-right tabular-nums">{c.buyers}</span>
                    <span className="text-right">
                      <Badge variant={c.retention >= 30 ? "default" : c.retention >= 10 ? "secondary" : "outline"} className="tabular-nums">
                        {c.retention}%
                      </Badge>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">No cohort data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lucky Draw Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Lucky Draw Revenue Trend
          </CardTitle>
          <CardDescription>Paid entry revenue & entry count by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            {drawRevenue && drawRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={drawRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis yAxisId="left" fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" fontSize={11} />
                  <Tooltip formatter={(val: number, name: string) => name === "Revenue" ? `₹${val}` : val} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="hsl(40, 96%, 55%)" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="entries" name="Entries" stroke="hsl(195, 85%, 41%)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">No paid draw entries yet</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
          <CardDescription>Latest 5 orders</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orders?.slice(0, 5).map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-sm">{order.guest_name || order.guest_email || "Guest"}</p>
                  <p className="text-xs text-muted-foreground">₹{Number(order.total_amount).toFixed(2)}</p>
                </div>
                <Badge variant={order.status === "delivered" ? "default" : "secondary"} className="text-xs">
                  {order.status}
                </Badge>
              </div>
            ))}
            {!orders?.length && <p className="text-sm text-muted-foreground">No orders yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
