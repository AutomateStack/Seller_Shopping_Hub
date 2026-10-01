import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, Copy, Search } from "lucide-react";
import { format } from "date-fns";

interface CouponForm {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_discount_amount: string;
  usage_limit: string;
  is_active: boolean;
  expires_at: string;
}

const emptyForm: CouponForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  max_discount_amount: "",
  usage_limit: "",
  is_active: true,
  expires_at: "",
};

export function AdminCoupons() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : 0,
        max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
        usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
        is_active: form.is_active,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      if (form.discount_type === "percentage" && (payload.discount_value < 1 || payload.discount_value > 100)) {
        throw new Error("Percentage must be between 1 and 100");
      }

      if (editingId) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: editingId ? "Coupon updated" : "Coupon created" });
      setIsDialogOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Coupon deleted" });
    },
  });

  const handleEdit = (coupon: any) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      description: coupon.description || "",
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_amount: coupon.min_order_amount ? String(coupon.min_order_amount) : "",
      max_discount_amount: coupon.max_discount_amount ? String(coupon.max_discount_amount) : "",
      usage_limit: coupon.usage_limit ? String(coupon.usage_limit) : "",
      is_active: coupon.is_active,
      expires_at: coupon.expires_at ? coupon.expires_at.substring(0, 16) : "",
    });
    setIsDialogOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: `${code} copied to clipboard` });
  };

  const filtered = coupons?.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase())
  );

  const activeCoupons = coupons?.filter(c => c.is_active).length || 0;
  const totalUsage = coupons?.reduce((sum, c) => sum + (c.used_count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Coupons & Discounts</h1>
        <p className="text-muted-foreground">Create and manage promotional codes.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Coupons</p>
          <p className="text-2xl font-bold">{coupons?.length || 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Active</p>
          <p className="text-2xl font-bold text-primary">{activeCoupons}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Redemptions</p>
          <p className="text-2xl font-bold">{totalUsage}</p>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <Card><CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search coupons..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setForm(emptyForm); setEditingId(null); }}>
                <Plus className="h-4 w-4 mr-1" /> Create Coupon
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Coupon" : "Create New Coupon"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Coupon Code *</Label>
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE20" maxLength={30} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. 20% off on first order" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Discount Type *</Label>
                    <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Discount Value *</Label>
                    <Input type="number" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 100"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Order Amount (₹)</Label>
                    <Input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} placeholder="0" />
                  </div>
                  <div>
                    <Label>Max Discount (₹)</Label>
                    <Input type="number" value={form.max_discount_amount} onChange={e => setForm({ ...form, max_discount_amount: e.target.value })} placeholder="No limit" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Usage Limit</Label>
                    <Input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} placeholder="Unlimited" />
                  </div>
                  <div>
                    <Label>Expires At</Label>
                    <Input type="datetime-local" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                  <Label>Active</Label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => saveMutation.mutate()} disabled={!form.code || !form.discount_value || saveMutation.isPending}>
                  {editingId ? "Update" : "Create"} Coupon
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent></Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead className="hidden md:table-cell">Min Order</TableHead>
                <TableHead className="hidden md:table-cell">Usage</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.map(coupon => {
                const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
                const isExhausted = coupon.usage_limit && coupon.used_count >= coupon.usage_limit;
                return (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-primary" />
                        <span className="font-mono font-bold text-sm">{coupon.code}</span>
                        <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      {coupon.description && <p className="text-xs text-muted-foreground mt-0.5">{coupon.description}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">
                        {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}
                      </span>
                      {coupon.max_discount_amount && coupon.discount_type === "percentage" && (
                        <p className="text-xs text-muted-foreground">Max ₹{coupon.max_discount_amount}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {coupon.min_order_amount ? `₹${coupon.min_order_amount}` : "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {coupon.used_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ""}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {coupon.expires_at ? format(new Date(coupon.expires_at), "dd MMM yyyy") : "Never"}
                    </TableCell>
                    <TableCell>
                      {!coupon.is_active ? (
                        <Badge variant="secondary">Inactive</Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : isExhausted ? (
                        <Badge variant="secondary">Exhausted</Badge>
                      ) : (
                        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(coupon)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this coupon?")) deleteMutation.mutate(coupon.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!filtered || filtered.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {isLoading ? "Loading..." : "No coupons found. Create your first one!"}
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
