import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Users, Download, ArrowUp, ArrowDown, ArrowUpDown, KeyRound } from "lucide-react";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AdminCustomersProps {
  orders: any[] | undefined;
}

type SortKey = "name" | "email" | "totalOrders" | "totalSpent" | "lastOrder";
type SortDir = "asc" | "desc";

export function AdminCustomers({ orders }: AdminCustomersProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalSpent");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [resetEmail, setResetEmail] = useState("");
  const [sending, setSending] = useState<string | null>(null);
  const { toast } = useToast();

  const sendReset = async (email: string) => {
    if (!email || email === "N/A") {
      toast({ title: "No email", description: "This customer has no email on file.", variant: "destructive" });
      return;
    }
    setSending(email);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(null);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Reset link sent",
      description: `If ${email} has an account, they'll receive a password reset email.`,
    });
  };

  const customers = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, { name: string; email: string; phone: string; totalOrders: number; totalSpent: number; lastOrder: string }>();
    orders.forEach((order) => {
      const key = order.guest_email || order.user_id || order.id;
      const existing = map.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += Number(order.total_amount);
        if (new Date(order.created_at) > new Date(existing.lastOrder)) existing.lastOrder = order.created_at;
      } else {
        map.set(key, {
          name: order.guest_name || "Guest",
          email: order.guest_email || "N/A",
          phone: order.guest_phone || "N/A",
          totalOrders: 1,
          totalSpent: Number(order.total_amount),
          lastOrder: order.created_at,
        });
      }
    });
    return Array.from(map.values());
  }, [orders]);

  const filtered = useMemo(() => {
    const list = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "lastOrder") {
        cmp = new Date(a.lastOrder).getTime() - new Date(b.lastOrder).getTime();
      } else if (sortKey === "totalOrders" || sortKey === "totalSpent") {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      } else {
        cmp = String(a[sortKey] || "").localeCompare(String(b[sortKey] || ""));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [customers, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "email" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 opacity-40" aria-hidden="true" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
      : <ArrowDown className="h-3 w-3" aria-hidden="true" />;
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ["Name", "Email", "Phone", "Total Orders", "Total Spent", "Last Order"];
    const rows = filtered.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.email,
      c.phone,
      c.totalOrders,
      c.totalSpent.toFixed(2),
      new Date(c.lastOrder).toISOString().slice(0, 10),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">View and manage your customer base.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length} className="min-h-[44px]">
          <Download className="h-4 w-4 mr-1" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{customers.length}</p>
              <p className="text-xs text-muted-foreground">Total Customers</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <span className="text-lg font-bold">₹</span>
            </div>
            <div>
              <p className="text-2xl font-bold">
                ₹{customers.length > 0 ? (customers.reduce((s, c) => s + c.totalSpent, 0) / customers.length).toFixed(0) : 0}
              </p>
              <p className="text-xs text-muted-foreground">Avg. Customer Value</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <span className="text-lg font-bold">#</span>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {customers.filter(c => c.totalOrders > 1).length}
              </p>
              <p className="text-xs text-muted-foreground">Repeat Customers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" aria-hidden="true" /> Send password reset
          </CardTitle>
          <CardDescription>
            Email a secure reset link to any registered customer. They set the new password themselves — you never see it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col sm:flex-row gap-3"
            onSubmit={(e) => { e.preventDefault(); sendReset(resetEmail.trim()); }}
          >
            <Input
              type="email"
              placeholder="customer@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
              className="sm:max-w-sm"
            />
            <Button type="submit" variant="outline" className="min-h-[44px]" disabled={sending !== null}>
              {sending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Customer List</CardTitle>
              <CardDescription>
                {filtered.length} customer{filtered.length !== 1 ? "s" : ""} • click headers to sort
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                    Name <SortIcon column="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("email")} className="flex items-center gap-1 hover:text-foreground">
                    Email <SortIcon column="email" />
                  </button>
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("totalOrders")} className="flex items-center gap-1 hover:text-foreground">
                    Orders <SortIcon column="totalOrders" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("totalSpent")} className="flex items-center gap-1 hover:text-foreground">
                    Total Spent <SortIcon column="totalSpent" />
                  </button>
                </TableHead>
                <TableHead>
                  <button onClick={() => toggleSort("lastOrder")} className="flex items-center gap-1 hover:text-foreground">
                    Last Order <SortIcon column="lastOrder" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-sm">{customer.email}</TableCell>
                  <TableCell className="text-sm">{customer.phone}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{customer.totalOrders}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">₹{customer.totalSpent.toFixed(0)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(customer.lastOrder).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendReset(customer.email)}
                      disabled={sending !== null || customer.email === "N/A"}
                      title="Send password reset link"
                    >
                      <KeyRound className="h-4 w-4 mr-1" aria-hidden="true" />
                      Reset
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
