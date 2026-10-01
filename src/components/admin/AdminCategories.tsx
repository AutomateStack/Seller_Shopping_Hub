import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-categories";

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function AdminCategories() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories } = useCategories();

  const [catDialog, setCatDialog] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "", display_order: "0", icon: "" });

  const [subDialog, setSubDialog] = useState(false);
  const [editSub, setEditSub] = useState<any>(null);
  const [subForm, setSubForm] = useState({ name: "", slug: "", category_id: "", display_order: "0" });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["categories-with-subs"] });

  const saveCat = useMutation({
    mutationFn: async () => {
      const payload = {
        name: catForm.name.trim(),
        slug: catForm.slug.trim() || slugify(catForm.name),
        display_order: parseInt(catForm.display_order) || 0,
        icon: catForm.icon.trim() || null,
      };
      if (editCat) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setCatDialog(false);
      setEditCat(null);
      setCatForm({ name: "", slug: "", display_order: "0", icon: "" });
      toast({ title: editCat ? "Category updated" : "Category added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Category deleted" });
    },
  });

  const saveSub = useMutation({
    mutationFn: async () => {
      const payload = {
        category_id: subForm.category_id,
        name: subForm.name.trim(),
        slug: subForm.slug.trim() || slugify(subForm.name),
        display_order: parseInt(subForm.display_order) || 0,
      };
      if (editSub) {
        const { error } = await supabase.from("subcategories").update(payload).eq("id", editSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subcategories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      setSubDialog(false);
      setEditSub(null);
      setSubForm({ name: "", slug: "", category_id: "", display_order: "0" });
      toast({ title: editSub ? "Subcategory updated" : "Subcategory added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Subcategory deleted" });
    },
  });

  const openNewCat = () => {
    setEditCat(null);
    setCatForm({ name: "", slug: "", display_order: "0", icon: "" });
    setCatDialog(true);
  };
  const openEditCat = (c: any) => {
    setEditCat(c);
    setCatForm({ name: c.name, slug: c.slug, display_order: String(c.display_order), icon: c.icon || "" });
    setCatDialog(true);
  };
  const openNewSub = (categoryId?: string) => {
    setEditSub(null);
    setSubForm({ name: "", slug: "", category_id: categoryId || categories?.[0]?.id || "", display_order: "0" });
    setSubDialog(true);
  };
  const openEditSub = (s: any) => {
    setEditSub(s);
    setSubForm({ name: s.name, slug: s.slug, category_id: s.category_id, display_order: String(s.display_order) });
    setSubDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Categories & Subcategories</h1>
          <p className="text-muted-foreground">Organize your product taxonomy.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openNewSub()} disabled={!categories?.length}>
            <Plus className="h-4 w-4 mr-1" /> Add Subcategory
          </Button>
          <Button onClick={openNewCat}>
            <Plus className="h-4 w-4 mr-1" /> Add Category
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {categories?.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{cat.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    /{cat.slug} · order {cat.display_order} · {cat.subcategories.length} subcategories
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openNewSub(cat.id)} aria-label="Add subcategory">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)} aria-label="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Delete "${cat.name}" and all its subcategories?`)) deleteCat.mutate(cat.id);
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {cat.subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {cat.subcategories.map((s) => (
                    <div
                      key={s.id}
                      className="group flex items-center gap-1 bg-muted rounded-full pl-3 pr-1 py-1 text-sm"
                    >
                      <span>{s.name}</span>
                      <button
                        onClick={() => openEditSub(s)}
                        className="ml-1 h-6 w-6 rounded-full hover:bg-background flex items-center justify-center"
                        aria-label="Edit subcategory"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete "${s.name}"?`)) deleteSub.mutate(s.id);
                        }}
                        className="h-6 w-6 rounded-full hover:bg-background flex items-center justify-center"
                        aria-label="Delete subcategory"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name *</Label>
              <Input
                value={catForm.name}
                onChange={(e) =>
                  setCatForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))
                }
              />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={catForm.slug} onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Display order</Label>
                <Input
                  type="number"
                  value={catForm.display_order}
                  onChange={(e) => setCatForm((f) => ({ ...f, display_order: e.target.value }))}
                />
              </div>
              <div>
                <Label>Icon (lucide name)</Label>
                <Input
                  placeholder="Shirt, Gem, Smartphone, Home..."
                  value={catForm.icon}
                  onChange={(e) => setCatForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
            </div>
            <Button onClick={() => saveCat.mutate()} disabled={!catForm.name.trim() || saveCat.isPending} className="w-full">
              {editCat ? "Update" : "Add"} Category
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory dialog */}
      <Dialog open={subDialog} onOpenChange={setSubDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editSub ? "Edit Subcategory" : "Add Subcategory"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Parent category *</Label>
              <Select
                value={subForm.category_id}
                onValueChange={(v) => setSubForm((f) => ({ ...f, category_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Name *</Label>
              <Input
                value={subForm.name}
                onChange={(e) =>
                  setSubForm((f) => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))
                }
              />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={subForm.slug} onChange={(e) => setSubForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <Label>Display order</Label>
              <Input
                type="number"
                value={subForm.display_order}
                onChange={(e) => setSubForm((f) => ({ ...f, display_order: e.target.value }))}
              />
            </div>
            <Button
              onClick={() => saveSub.mutate()}
              disabled={!subForm.name.trim() || !subForm.category_id || saveSub.isPending}
              className="w-full"
            >
              {editSub ? "Update" : "Add"} Subcategory
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
