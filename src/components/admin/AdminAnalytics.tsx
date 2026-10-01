import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR, formatNumber } from "@/lib/format";
import { UserInsights, type UserAnalytics } from "@/components/admin/UserInsights";
import {
  TrendingUp, Undo2, Package, IndianRupee, Users, Eye, Timer, MousePointerClick, Download, RefreshCw,
} from "lucide-react";

const RANGES = [7, 30, 90, 365];

type Sales = {
  units_sold: number; revenue: number; orders: number;
  returns_units: number; returns_count: number; returns_cost: number;
  avg_return_cost: number; return_rate: number | null; return_cost_per_unit_sold: number | null;
  top_sellers: { product_id: string | null; product_name: string; units: number; revenue: number }[];
  top_returned: { product_id: string | null; product_name: string; units: number; cost: number; return_rate: number | null }[];
  daily: { day: string; revenue: number; orders: number }[];
};

type Traffic = {
  page_views: number; sessions: number; known_users: number;
  avg_session_seconds: number; bounce_rate: number;
  funnel: { viewed: number; carted: number; checkout: number; purchased: number };
  top_products: { product_id: string; product_name: string | null; views: number; sessions: number; avg_dwell_ms: number | null }[];
  longest_dwell: { product_id: string; product_name: string | null; views: number; avg_dwell_ms: number | null }[];
  top_paths: { path: string; views: number; sessions: number }[];
  top_searches: { query: string; count: number }[];
  shares: { channel: string; count: number }[];
  daily: { day: string; page_views: number; sessions: number }[];
};

function pct(v: number | null | undefined) {
  if (v == null || !isFinite(Number(v))) return "—";
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function duration(ms: number | null | undefined) {
  if (!ms) return "—";
  const s = Math.round(Number(ms) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="surface-elevated">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  return (
    <div className="flex items-end gap-0.5 h-16" aria-hidden="true">
      {points.map((p, i) => (
        <div key={i} className="flex-1 bg-primary/70 rounded-sm" style={{ height: `${Math.max(2, (p / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export function AdminAnalytics() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-advanced-analytics", days],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-analytics", { body: { days } });
      if (error) throw error;
      return data as { sales: Sales; traffic: Traffic; users: UserAnalytics };
    },
  });

  const sales = data?.sales;
  const traffic = data?.traffic;
  const users = data?.users;

  const exportCsv = () => {
    if (!sales) return;
    const rows: string[][] = [
      ["Metric", "Value"],
      ["Range (days)", String(days)],
      ["Units sold", String(sales.units_sold)],
      ["Revenue", String(sales.revenue)],
      ["Orders", String(sales.orders)],
      ["Returns (units)", String(sales.returns_units)],
      ["Return rate", pct(sales.return_rate)],
      ["Total return cost", String(sales.returns_cost)],
      ["Avg cost per returned unit", String(sales.avg_return_cost)],
      ["Return cost per unit sold", String(sales.return_cost_per_unit_sold ?? 0)],
      [],
      ["Top selling product", "Units", "Revenue"],
      ...sales.top_sellers.map((s) => [s.product_name, String(s.units), String(s.revenue)]),
      [],
      ["Most returned product", "Units", "Cost", "Return rate"],
      ...sales.top_returned.map((s) => [s.product_name, String(s.units), String(s.cost), pct(s.return_rate)]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shophub-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Advanced Analytics</h2>
          <p className="text-sm text-muted-foreground">Sales, returns and on-site behaviour — computed in the database, so the storefront stays fast.</p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button key={r} size="sm" variant={days === r ? "default" : "outline"} onClick={() => setDays(r)}>
              {r === 365 ? "1y" : `${r}d`}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5" disabled={!sales}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card><CardContent className="p-6 text-sm text-destructive">Could not load analytics. Please try again.</CardContent></Card>
      )}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      )}

      {sales && traffic && (
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales &amp; Returns</TabsTrigger>
            <TabsTrigger value="behaviour">Visitor Behaviour</TabsTrigger>
            <TabsTrigger value="users">Users / Visitors</TabsTrigger>
          </TabsList>

          <TabsContent value="sales" className="space-y-6 mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Package} label="Units sold" value={formatNumber(sales.units_sold)} sub={`${formatNumber(sales.orders)} orders`} />
              <Stat icon={IndianRupee} label="Revenue" value={formatINR(sales.revenue, { compact: true })} />
              <Stat icon={Undo2} label="Returns" value={formatNumber(sales.returns_units)} sub={`Return rate ${pct(sales.return_rate)}`} />
              <Stat icon={TrendingUp} label="Return cost" value={formatINR(sales.returns_cost, { compact: true })} sub={`Avg ${formatINR(sales.avg_return_cost)} / returned unit`} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Stat icon={IndianRupee} label="Return cost per unit sold" value={formatINR(sales.return_cost_per_unit_sold ?? 0)} sub="Overall sold-level average return cost" />
              <Stat icon={Undo2} label="Return requests" value={formatNumber(sales.returns_count)} sub="Excludes rejected requests" />
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Revenue trend</CardTitle></CardHeader>
              <CardContent>
                <Sparkline points={sales.daily.map((d) => Number(d.revenue))} />
                <p className="text-xs text-muted-foreground mt-2">{sales.daily.length} days with sales in this range</p>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Best sellers</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sales.top_sellers.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm">No sales in this range.</TableCell></TableRow>}
                      {sales.top_sellers.map((s, i) => (
                        <TableRow key={`${s.product_id}-${i}`}>
                          <TableCell className="font-medium">{s.product_name}</TableCell>
                          <TableCell className="text-right">{formatNumber(s.units)}</TableCell>
                          <TableCell className="text-right">{formatINR(s.revenue, { compact: true })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Most returned</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Rate</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sales.top_returned.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">No returns recorded in this range.</TableCell></TableRow>}
                      {sales.top_returned.map((s, i) => (
                        <TableRow key={`${s.product_id}-${i}`}>
                          <TableCell className="font-medium">{s.product_name || "—"}</TableCell>
                          <TableCell className="text-right">{formatNumber(s.units)}</TableCell>
                          <TableCell className="text-right">{formatINR(s.cost, { compact: true })}</TableCell>
                          <TableCell className="text-right">{pct(s.return_rate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="behaviour" className="space-y-6 mt-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Eye} label="Page views" value={formatNumber(traffic.page_views)} />
              <Stat icon={Users} label="Sessions" value={formatNumber(traffic.sessions)} sub={`${formatNumber(traffic.known_users)} signed-in users`} />
              <Stat icon={Timer} label="Avg session" value={duration(traffic.avg_session_seconds * 1000)} />
              <Stat icon={MousePointerClick} label="Bounce rate" value={pct(traffic.bounce_rate)} />
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Shopping funnel (sessions)</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-4">
                {[
                  ["Viewed product", traffic.funnel.viewed],
                  ["Added to cart", traffic.funnel.carted],
                  ["Started checkout", traffic.funnel.checkout],
                  ["Purchased", traffic.funnel.purchased],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-xl bg-accent/40 p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{formatNumber(v as number)}</p>
                    <p className="text-xs text-muted-foreground">
                      {pct(traffic.funnel.viewed ? (v as number) / traffic.funnel.viewed : null)} of viewers
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Most interesting products</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-right">Visitors</TableHead><TableHead className="text-right">Avg time</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {traffic.top_products.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground text-sm">No product views yet.</TableCell></TableRow>}
                      {traffic.top_products.map((p) => (
                        <TableRow key={p.product_id}>
                          <TableCell className="font-medium">{p.product_name || p.product_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-right">{formatNumber(p.views)}</TableCell>
                          <TableCell className="text-right">{formatNumber(p.sessions)}</TableCell>
                          <TableCell className="text-right">{duration(p.avg_dwell_ms)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Top pages</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Path</TableHead><TableHead className="text-right">Views</TableHead><TableHead className="text-right">Visitors</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {traffic.top_paths.map((p) => (
                        <TableRow key={p.path}>
                          <TableCell className="font-mono text-xs">{p.path}</TableCell>
                          <TableCell className="text-right">{formatNumber(p.views)}</TableCell>
                          <TableCell className="text-right">{formatNumber(p.sessions)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Top searches</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {traffic.top_searches.length === 0 && <p className="text-sm text-muted-foreground">No searches recorded.</p>}
                  {traffic.top_searches.map((s) => (
                    <Badge key={s.query} variant="secondary">{s.query} · {s.count}</Badge>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Shares by channel (virality)</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {traffic.shares.length === 0 && <p className="text-sm text-muted-foreground">No shares recorded yet.</p>}
                  {traffic.shares.map((s) => (
                    <Badge key={s.channel} variant="secondary">{s.channel} · {s.count}</Badge>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Traffic trend</CardTitle></CardHeader>
              <CardContent>
                <Sparkline points={traffic.daily.map((d) => d.page_views)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            {users ? <UserInsights data={users} /> : (
              <Card><CardContent className="p-6 text-sm text-muted-foreground">No visitor data available yet.</CardContent></Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
