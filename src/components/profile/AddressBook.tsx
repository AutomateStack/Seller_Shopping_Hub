import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MapPin, Star, Loader2 } from "lucide-react";

interface Address {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

const empty = { label: "Home", recipient_name: "", phone: "", address: "", city: "", state: "", zip_code: "", is_default: false };

export function AddressBook({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [form, setForm] = useState<typeof empty>(empty);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["saved-addresses", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_addresses")
        .select("*")
        .eq("user_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Address[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from("saved_addresses").update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_addresses").insert({ ...form, user_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-addresses", userId] });
      setOpen(false);
      setEditing(null);
      setForm(empty);
      toast({ title: editing ? "Address updated" : "Address added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to save address", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-addresses", userId] });
      toast({ title: "Address removed" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("saved_addresses").update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-addresses", userId] }),
  });

  const openEdit = (a: Address) => {
    setEditing(a);
    setForm({ label: a.label, recipient_name: a.recipient_name, phone: a.phone, address: a.address, city: a.city, state: a.state, zip_code: a.zip_code, is_default: a.is_default });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2"><MapPin className="h-5 w-5" /> Address Book</h2>
            <p className="text-sm text-muted-foreground">Manage your saved shipping addresses</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit Address" : "New Address"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Label</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home, Office..." required /></div>
                  <div><Label>Recipient Name</Label><Input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} required /></div>
                </div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required /></div>
                <div><Label>Street Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></div>
                  <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} required /></div>
                  <div><Label>ZIP</Label><Input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} required /></div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} />
                  Set as default address
                </label>
                <Button type="submit" disabled={saveMutation.isPending} className="w-full">
                  {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Update" : "Save"} Address
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading addresses...</div>
        ) : !addresses?.length ? (
          <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-lg">
            No saved addresses yet. Add one to speed up checkout.
          </div>
        ) : (
          <div className="space-y-3">
            {addresses.map(a => (
              <div key={a.id} className="border rounded-lg p-3 flex items-start gap-3 hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-medium text-sm">{a.label}</span>
                    {a.is_default && <Badge variant="secondary" className="text-xs gap-1"><Star className="h-3 w-3 fill-current" />Default</Badge>}
                  </div>
                  <p className="text-sm">{a.recipient_name} • {a.phone}</p>
                  <p className="text-sm text-muted-foreground">{a.address}, {a.city}, {a.state} {a.zip_code}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {!a.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => setDefaultMutation.mutate(a.id)} className="text-xs h-7">
                      Set default
                    </Button>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}