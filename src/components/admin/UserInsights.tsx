import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatINR, formatNumber } from "@/lib/format";
import { Users, Timer, Flame, UserCheck, Download } from "lucide-react";

export type VisitorRow = {
  visitor_key: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  sessions: number;
  page_views: number;
  first_seen: string;
  last_seen: string;
  active_secs: number;
  dwell_ms: number;
  add_to_cart: number;
  checkouts: number;
  purchases: number;
  searches: number;
  shares: number;
  orders: number;
  spend: number;
  interest: "customer" | "hot" | "interested" | "browsing" | "bounced";
  top_products: { product_id: string; product_name: string | null; views: number; dwell_ms: number }[];
  top_paths: { path: string; views: number }[];
};

export type UserAnalytics = {
  days: number;
  total_visitors: number;
  signed_in_visitors: number;
  buckets: Record<string, number> | null;
  users: VisitorRow[];
};

const INTEREST_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  customer: { label: "Customer", variant: "default" },
  hot: { label: "Hot lead", variant: "default" },
  interested: { label: "Interested", variant: "secondary" },
  browsing: { label: "Browsing", variant: "outline" },
  bounced: { label: "Not interested", variant: "destructive" },
};

function secs(v: number | null | undefined) {
  const s = Math.round(Number(v ?? 0));
  if (!s) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ms(v: number | null | undefined) {
  return secs(Number(v ?? 0) / 1000);
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

export function UserInsights({ data }: { data: UserAnalytics }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<VisitorRow | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data.users || []).filter((u) => {
      if (filter !== "all" && u.interest !== filter) return false;
      if (!needle) return true;
      return (
        (u.email || "").toLowerCase().includes(needle) ||
        (u.full_name || "").toLowerCase().includes(needle) ||
        u.visitor_key.toLowerCase().includes(needle) ||
        u.top_products.some((p) => (p.product_name || "").toLowerCase().includes(needle))
      );
    });
  }, [data.users, q, filter]);

  const exportCsv = () => {
    const head = [
      "Visitor", "Email", "Name", "Interest", "Sessions", "Page views",
      "Time on site (s)", "Product dwell (s)", "Add to cart", "Checkouts",
      "Orders", "Spend", "Searches", "Shares", "First seen", "Last seen", "Most viewed products",
    ];
    const body = rows.map((u) => [
      u.visitor_key, u.email ?? "guest", u.full_name ?? "", INTEREST_LABEL[u.interest]?.label ?? u.interest,
      u.sessions, u.page_views, Math.round(u.active_secs), Math.round(u.dwell_ms / 1000),
      u.add_to_cart, u.checkouts, u.orders, u.spend, u.searches, u.shares,
      u.first_seen, u.last_seen,
      u.top_products.map((p) => `${p.product_name ?? p.product_id} (${Math.round(p.dwell_ms / 1000)}s)`).join(" | "),
    ]);
    const csv = [head, ...body]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `shophub-visitors-${data.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const b = data.buckets || {};

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Visitors tracked" value={formatNumber(data.total_visitors)} sub={`${formatNumber(data.signed_in_visitors)} signed in`} />
        <Stat icon={Flame} label="Hot leads" value={formatNumber((b.hot ?? 0) + (b.customer ?? 0))} sub="Added to cart / bought" />
        <Stat icon={UserCheck} label="Interested" value={formatNumber(b.interested ?? 0)} sub="Long dwell or many pages" />
        <Stat icon={Timer} label="Not interested" value={formatNumber(b.bounced ?? 0)} sub="Left within seconds" />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Per-visitor activity</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email, name or product"
              className="h-9 w-56"
              aria-label="Search visitors"
            />
            {["all", "customer", "hot", "interested", "browsing", "bounced"].map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : INTEREST_LABEL[f].label}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!rows.length}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No visitor activity recorded for this range yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Interest</TableHead>
                  <TableHead className="text-right">Time on site</TableHead>
                  <TableHead className="text-right">Product time</TableHead>
                  <TableHead className="text-right">Pages</TableHead>
                  <TableHead className="text-right">Cart</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead>Most interested in</TableHead>
                  <TableHead className="text-right">Last seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.visitor_key} className="cursor-pointer" onClick={() => setSelected(u)}>
                    <TableCell className="max-w-[220px]">
                      <p className="font-medium truncate">{u.email ?? "Guest visitor"}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.full_name ?? u.visitor_key}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={INTEREST_LABEL[u.interest]?.variant ?? "outline"}>
                        {INTEREST_LABEL[u.interest]?.label ?? u.interest}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{secs(u.active_secs)}</TableCell>
                    <TableCell className="text-right">{ms(u.dwell_ms)}</TableCell>
                    <TableCell className="text-right">{formatNumber(u.page_views)}</TableCell>
                    <TableCell className="text-right">{formatNumber(u.add_to_cart)}</TableCell>
                    <TableCell className="text-right">{formatNumber(u.orders)}</TableCell>
                    <TableCell className="text-right">{u.spend ? formatINR(u.spend) : "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {u.top_products[0]?.product_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(u.last_seen).toLocaleString("en-IN")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.email ?? "Guest visitor"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><p className="text-xs text-muted-foreground">Time on site</p><p className="font-semibold">{secs(selected.active_secs)}</p></div>
                <div><p className="text-xs text-muted-foreground">Sessions</p><p className="font-semibold">{selected.sessions}</p></div>
                <div><p className="text-xs text-muted-foreground">Page views</p><p className="font-semibold">{selected.page_views}</p></div>
                <div><p className="text-xs text-muted-foreground">Searches</p><p className="font-semibold">{selected.searches}</p></div>
                <div><p className="text-xs text-muted-foreground">Add to cart</p><p className="font-semibold">{selected.add_to_cart}</p></div>
                <div><p className="text-xs text-muted-foreground">Checkouts</p><p className="font-semibold">{selected.checkouts}</p></div>
                <div><p className="text-xs text-muted-foreground">Orders</p><p className="font-semibold">{selected.orders}</p></div>
                <div><p className="text-xs text-muted-foreground">Spend</p><p className="font-semibold">{formatINR(selected.spend || 0)}</p></div>
              </div>

              <div>
                <p className="font-medium mb-1">Products they spent the most time on</p>
                {selected.top_products.length === 0 ? (
                  <p className="text-muted-foreground">No product views recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {selected.top_products.map((p) => (
                      <li key={p.product_id} className="flex justify-between gap-3">
                        <span className="truncate">{p.product_name ?? p.product_id}</span>
                        <span className="text-muted-foreground shrink-0">{p.views} views · {ms(p.dwell_ms)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="font-medium mb-1">Where they spent their time</p>
                {selected.top_paths.length === 0 ? (
                  <p className="text-muted-foreground">No page views recorded.</p>
                ) : (
                  <ul className="space-y-1">
                    {selected.top_paths.map((p) => (
                      <li key={p.path} className="flex justify-between gap-3">
                        <span className="truncate">{p.path}</span>
                        <span className="text-muted-foreground shrink-0">{p.views} views</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                First seen {new Date(selected.first_seen).toLocaleString("en-IN")} · Last seen {new Date(selected.last_seen).toLocaleString("en-IN")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
