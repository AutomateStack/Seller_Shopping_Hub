import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Search, Plus, X, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlogManager } from "@/components/BlogManager";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminCustomers } from "@/components/admin/AdminCustomers";
import { AdminInventory } from "@/components/admin/AdminInventory";
import { AdminCoupons } from "@/components/admin/AdminCoupons";
import { AdminOrders } from "@/components/admin/AdminOrders";
import { AdminLuckyDraw } from "@/components/admin/AdminLuckyDraw";
import { AdminQuizzes } from "@/components/admin/AdminQuizzes";
import { AdminQuestions } from "@/components/admin/AdminQuestions";
import { BulkProductActions } from "@/components/admin/BulkProductActions";
import { ProductCSVTools } from "@/components/admin/ProductCSVTools";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichDescriptionEditor } from "@/components/admin/RichDescriptionEditor";
import { AdminCategories } from "@/components/admin/AdminCategories";
import { AdminCampaigns } from "@/components/admin/AdminCampaigns";
import { AdminStockNotifications } from "@/components/admin/AdminStockNotifications";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";
import { useCategories } from "@/hooks/use-categories";

interface ProductForm {
  name: string;
  description: string;
  price: string;
  stock: string;
  category: string;
  subcategory_id: string;
  image_url: string;
  featured: boolean;
  volume_tiers: { min_qty: number; discount_percent: number }[];
}

interface VariantRow {
  id?: string;
  variant_type: string;
  variant_value: string;
  price_adjustment: string;
  stock: string;
}

interface GalleryUpload {
  file: File;
  alt_text: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [productForm, setProductForm] = useState<ProductForm>({
    name: "", description: "", price: "", stock: "", category: "", subcategory_id: "", image_url: "", featured: false, volume_tiers: [],
  });
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [additionalImageFiles, setAdditionalImageFiles] = useState<GalleryUpload[]>([]);
  const [existingAdditionalImages, setExistingAdditionalImages] = useState<any[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role", "admin").maybeSingle();
      if (!data) navigate("/");
      else setIsAdmin(true);
      setAuthChecking(false);
    });
  }, [navigate]);

  const { data: products } = useQuery({
    queryKey: ["admin-products"], enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      return data;
    },
  });

  const { data: taxonomy = [] } = useCategories();

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"], enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*, order_items(*, products:product_id(id, image_url, category, description))").order("created_at", { ascending: false });
      return data;
    },
  });

  const predefinedCategories = ["Electronics", "Clothing", "Home & Kitchen", "Books", "Sports", "Beauty", "Toys", "Food", "Accessories", "Health", "Footwear", "Jewelry", "Furniture"];
  const dbCategories = Array.from(new Set(products?.map(p => p.category).filter(Boolean))) || [];
  const taxonomyCategories = taxonomy.map((category) => category.name);
  const categories = Array.from(new Set([...taxonomyCategories, ...dbCategories, ...predefinedCategories]));
  const selectedTaxonomyCategory = taxonomy.find((category) => category.name === productForm.category);
  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `products/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
    return publicUrl;
  };

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      let imageUrl = productForm.image_url;
      if (imageFile) imageUrl = await uploadImage(imageFile);
      const productData = {
        name: productForm.name, description: productForm.description,
        price: parseFloat(productForm.price), stock: parseInt(productForm.stock),
        category: productForm.category, subcategory_id: productForm.subcategory_id || null,
        image_url: imageUrl, featured: productForm.featured,
        volume_tiers: productForm.volume_tiers
          .filter((t) => t.min_qty > 0 && t.discount_percent > 0)
          .sort((a, b) => a.min_qty - b.min_qty),
      };

      let productId: string;
      if (editingProduct) {
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
        if (error) throw error;
        productId = editingProduct.id;
      } else {
        const { data, error } = await supabase.from("products").insert(productData).select("id").single();
        if (error) throw error;
        productId = data.id;
      }

      // Upload additional images
      for (let i = 0; i < additionalImageFiles.length; i++) {
        const image = additionalImageFiles[i];
        const url = await uploadImage(image.file);
        const { error: imageError } = await supabase.from("product_images").insert({
          product_id: productId,
          image_url: url,
          display_order: existingAdditionalImages.length + i,
          alt_text: image.alt_text.trim() || null,
        });
        if (imageError) throw imageError;
      }

      // Save variants - delete old ones and re-insert
      if (editingProduct) {
        await supabase.from("product_variants").delete().eq("product_id", productId);
      }
      const validVariants = variants.filter(v => v.variant_type && v.variant_value);
      if (validVariants.length > 0) {
        const { error: variantError } = await supabase.from("product_variants").insert(
          validVariants.map(v => ({
            product_id: productId,
            variant_type: v.variant_type,
            variant_value: v.variant_value,
            price_adjustment: parseFloat(v.price_adjustment) || 0,
            stock: parseInt(v.stock) || 0,
          }))
        );
        if (variantError) throw variantError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: editingProduct ? "Product updated" : "Product added" });
      resetForm(); setIsDialogOpen(false);
    },
    onError: (error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast({ title: "Product deleted" }); },
  });

  const deleteAdditionalImage = async (imageId: string) => {
    await supabase.from("product_images").delete().eq("id", imageId);
    setExistingAdditionalImages(prev => prev.filter(img => img.id !== imageId));
    toast({ title: "Image removed" });
  };

  const resetForm = () => {
    setProductForm({ name: "", description: "", price: "", stock: "", category: "", subcategory_id: "", image_url: "", featured: false, volume_tiers: [] });
    setEditingProduct(null); setImageFile(null); setAdditionalImageFiles([]); setExistingAdditionalImages([]); setVariants([]);
  };

  const handleEdit = async (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name, description: product.description || "", price: product.price.toString(),
      stock: product.stock.toString(), category: product.category || "", subcategory_id: product.subcategory_id || "",
      image_url: product.image_url || "", featured: product.featured || false,
      volume_tiers: Array.isArray(product.volume_tiers) ? product.volume_tiers : [],
    });

    // Load existing additional images
    const { data: images } = await supabase.from("product_images").select("*").eq("product_id", product.id).order("display_order");
    setExistingAdditionalImages(images || []);

    // Load existing variants
    const { data: existingVariants } = await supabase.from("product_variants").select("*").eq("product_id", product.id);
    setVariants((existingVariants || []).map(v => ({
      id: v.id,
      variant_type: v.variant_type,
      variant_value: v.variant_value,
      price_adjustment: v.price_adjustment.toString(),
      stock: v.stock.toString(),
    })));

    setIsDialogOpen(true);
  };

  const addVariantRow = () => {
    setVariants(prev => [...prev, { variant_type: "", variant_value: "", price_adjustment: "0", stock: "0" }]);
  };

  const updateVariant = (index: number, field: keyof VariantRow, value: string) => {
    setVariants(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
  };

  const removeVariant = (index: number) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="sr-only">Verifying admin access…</span>
      </div>
    );
  }
  if (!isAdmin) return null;

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <AdminDashboard orders={orders} products={products} />;
      case "analytics":
        return <AdminAnalytics />;
      case "customers":
        return <AdminCustomers orders={orders} />;
      case "inventory":
        return <AdminInventory products={products} />;
      case "stock-alerts":
        return <AdminStockNotifications />;
      case "campaigns":
        return <AdminCampaigns />;
      case "coupons":
        return <AdminCoupons />;
      case "categories":
        return <AdminCategories />;
      case "orders":
        return <AdminOrders orders={orders} />;
      case "luckydraw":
        return <AdminLuckyDraw />;
      case "quizzes":
        return <AdminQuizzes />;
      case "questions":
        return <AdminQuestions />;
      case "blog":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Blog Management</h1>
              <p className="text-muted-foreground">Create and manage blog posts.</p>
            </div>
            <BlogManager />
          </div>
        );
      case "products":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Products</h1>
              <p className="text-muted-foreground">Manage your product catalog.</p>
            </div>
            <BulkProductActions
              selectedIds={selectedProductIds}
              categories={categories.filter(Boolean) as string[]}
              onClear={() => setSelectedProductIds([])}
            />
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => <SelectItem key={cat} value={cat!}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <ProductCSVTools products={products || undefined} />
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild><Button onClick={resetForm}>Add Product</Button></DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader><DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
                      <Tabs defaultValue="details" className="mt-2">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="images">Images</TabsTrigger>
                          <TabsTrigger value="variants">Variants</TabsTrigger>
                          <TabsTrigger value="volume">Volume</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4 mt-4">
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div><Label>Name *</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="Product name" /></div>
                            <div>
                              <Label>Category *</Label>
                              <Select
                                value={productForm.category || "__none"}
                                onValueChange={(v) => setProductForm({ ...productForm, category: v === "__none" ? "" : v, subcategory_id: "" })}
                              >
                                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none" disabled>Select category</SelectItem>
                                  {categories.map(cat => <SelectItem key={cat} value={cat!}>{cat}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Subcategory</Label>
                              <Select
                                value={productForm.subcategory_id || "__none"}
                                disabled={!selectedTaxonomyCategory}
                                onValueChange={(v) => setProductForm({ ...productForm, subcategory_id: v === "__none" ? "" : v })}
                              >
                                <SelectTrigger><SelectValue placeholder={selectedTaxonomyCategory ? "Select subcategory" : "Select a category first"} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">No subcategory</SelectItem>
                                  {selectedTaxonomyCategory?.subcategories.map((sub) => (
                                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">Manage these options in Admin → Categories.</p>
                            </div>
                            <div><Label>Price (₹) *</Label><Input type="number" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} placeholder="0.00" /></div>
                            <div><Label>Stock *</Label><Input type="number" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} placeholder="0" /></div>
                          </div>
                          <div>
                            <Label>Description</Label>
                            <RichDescriptionEditor
                              value={productForm.description}
                              onChange={(val) => setProductForm({ ...productForm, description: val })}
                            />
                          </div>
                          <div className="flex items-center gap-2"><Switch checked={productForm.featured} onCheckedChange={(checked) => setProductForm({ ...productForm, featured: checked })} /><Label>Featured Product</Label></div>
                        </TabsContent>

                        <TabsContent value="images" className="space-y-4 mt-4">
                          <div>
                            <Label>Main Image</Label>
                            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                            <p className="text-xs text-muted-foreground mt-1">This is the primary product image</p>
                          </div>
                          <div><Label>Or Main Image URL</Label><Input value={productForm.image_url} onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })} placeholder="https://example.com/image.jpg" /></div>

                          {/* Existing additional images */}
                          {existingAdditionalImages.length > 0 && (
                            <div>
                              <Label>Gallery Images</Label>
                              <p className="text-xs text-muted-foreground mt-1">Type the variant name (e.g. Red) under an image to show it automatically when that option is picked.</p>
                              <div className="grid grid-cols-4 gap-3 mt-2">
                                {existingAdditionalImages.map((img) => (
                                  <div key={img.id} className="space-y-1">
                                    <div className="relative group rounded-lg overflow-hidden border border-border">
                                      <img src={img.image_url} alt={img.alt_text || ""} className="w-full aspect-square object-cover" />
                                      <button
                                        onClick={() => deleteAdditionalImage(img.id)}
                                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="Variant / label"
                                      value={img.alt_text || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setExistingAdditionalImages(prev => prev.map(x => x.id === img.id ? { ...x, alt_text: val } : x));
                                      }}
                                      onBlur={async (e) => {
                                        await supabase.from("product_images").update({ alt_text: e.target.value || null }).eq("id", img.id);
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <Label>Add More Gallery Images</Label>
                            <Input
                              type="file" accept="image/*" multiple
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                setAdditionalImageFiles(prev => [...prev, ...files.map((file) => ({ file, alt_text: "" }))]);
                              }}
                            />
                            {additionalImageFiles.length > 0 && (
                              <div className="space-y-2 mt-2">
                                {additionalImageFiles.map((image, i) => (
                                  <div key={`${image.file.name}-${i}`} className="flex gap-2 items-center rounded-md border p-2">
                                    <Badge variant="secondary" className="gap-1 shrink-0">
                                      <ImageIcon className="h-3 w-3" />
                                      {image.file.name}
                                    </Badge>
                                    <Input
                                      className="h-8 text-xs"
                                      value={image.alt_text}
                                      placeholder="Color / variant label, e.g. Red"
                                      onChange={(e) => setAdditionalImageFiles(prev => prev.map((item, idx) => idx === i ? { ...item, alt_text: e.target.value } : item))}
                                    />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setAdditionalImageFiles(prev => prev.filter((_, idx) => idx !== i))} aria-label={`Remove ${image.file.name}`}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">For color variants, enter the exact color name here (for example, “Red”). Selecting that color on the product page will switch to this image.</p>
                          </div>
                        </TabsContent>

                        <TabsContent value="variants" className="space-y-4 mt-4">
                          <p className="text-sm text-muted-foreground">Add size, color, or other variant options for this product.</p>
                          
                          {variants.map((variant, index) => (
                            <div key={index} className="flex gap-2 items-end border border-border rounded-lg p-3">
                              <div className="flex-1">
                                <Label className="text-xs">Type</Label>
                                <Select value={variant.variant_type} onValueChange={(v) => updateVariant(index, "variant_type", v)}>
                                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="size">Size</SelectItem>
                                    <SelectItem value="color">Color</SelectItem>
                                    <SelectItem value="material">Material</SelectItem>
                                    <SelectItem value="style">Style</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Value</Label>
                                <Input value={variant.variant_value} onChange={(e) => updateVariant(index, "variant_value", e.target.value)} placeholder="e.g., XL, Red" />
                              </div>
                              <div className="w-24">
                                <Label className="text-xs">+Price (₹)</Label>
                                <Input type="number" value={variant.price_adjustment} onChange={(e) => updateVariant(index, "price_adjustment", e.target.value)} placeholder="0" />
                              </div>
                              <div className="w-20">
                                <Label className="text-xs">Stock</Label>
                                <Input type="number" value={variant.stock} onChange={(e) => updateVariant(index, "stock", e.target.value)} placeholder="0" />
                              </div>
                              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => removeVariant(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}

                          <Button variant="outline" onClick={addVariantRow} className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Add Variant
                          </Button>
                        </TabsContent>

                        <TabsContent value="volume" className="space-y-4 mt-4">
                          <p className="text-sm text-muted-foreground">Offer automatic discounts when shoppers buy more quantity.</p>
                          {productForm.volume_tiers.map((tier, index) => (
                            <div key={index} className="flex gap-2 items-end border border-border rounded-lg p-3">
                              <div className="flex-1">
                                <Label className="text-xs">Min Quantity</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={tier.min_qty}
                                  onChange={(e) => {
                                    const qty = Math.max(1, parseInt(e.target.value) || 0);
                                    setProductForm(prev => ({
                                      ...prev,
                                      volume_tiers: prev.volume_tiers.map((t, i) => i === index ? { ...t, min_qty: qty } : t),
                                    }));
                                  }}
                                  placeholder="e.g., 2"
                                />
                              </div>
                              <div className="flex-1">
                                <Label className="text-xs">Discount %</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={tier.discount_percent}
                                  onChange={(e) => {
                                    const pct = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                    setProductForm(prev => ({
                                      ...prev,
                                      volume_tiers: prev.volume_tiers.map((t, i) => i === index ? { ...t, discount_percent: pct } : t),
                                    }));
                                  }}
                                  placeholder="e.g., 10"
                                />
                              </div>
                              <div className="text-sm text-muted-foreground pt-5">
                                ₹{(parseFloat(productForm.price || "0") * (1 - tier.discount_percent / 100)).toFixed(2)} / unit
                              </div>
                              <Button variant="ghost" size="icon" className="flex-shrink-0" onClick={() => setProductForm(prev => ({ ...prev, volume_tiers: prev.volume_tiers.filter((_, i) => i !== index) }))}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="outline"
                            onClick={() => setProductForm(prev => ({ ...prev, volume_tiers: [...prev.volume_tiers, { min_qty: 2, discount_percent: 10 }] }))}
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" /> Add Volume Tier
                          </Button>
                        </TabsContent>
                      </Tabs>

                      <div className="flex gap-2 justify-end mt-4">
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={() => saveProductMutation.mutate()} disabled={!productForm.name || !productForm.price || !productForm.stock || saveProductMutation.isPending}>
                          {saveProductMutation.isPending ? "Saving..." : editingProduct ? "Update" : "Add"} Product
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts?.map((product) => (
                <Card key={product.id} className={`overflow-hidden ${selectedProductIds.includes(product.id) ? "ring-2 ring-primary" : ""}`}>
                  {product.image_url && (
                    <div className="aspect-video overflow-hidden bg-muted relative">
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm rounded p-1">
                        <Checkbox
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={(c) => setSelectedProductIds(prev =>
                            c ? [...prev, product.id] : prev.filter(id => id !== product.id)
                          )}
                        />
                      </div>
                    </div>
                  )}
                  <CardContent className="p-4">
                    {!product.image_url && (
                      <div className="mb-2">
                        <Checkbox
                          checked={selectedProductIds.includes(product.id)}
                          onCheckedChange={(c) => setSelectedProductIds(prev =>
                            c ? [...prev, product.id] : prev.filter(id => id !== product.id)
                          )}
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{product.name}</h3>
                        {product.category && <Badge variant="secondary" className="text-xs mt-1">{product.category}</Badge>}
                      </div>
                      {product.featured && <Badge variant="default" className="ml-2">Featured</Badge>}
                    </div>
                    <p className="text-primary font-bold text-lg">₹{product.price}</p>
                    <p className="text-sm text-muted-foreground">Stock: {product.stock}</p>
                    {product.description && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{product.description}</p>}
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(product)} className="flex-1"><Pencil className="h-4 w-4 mr-1" />Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => { if (confirm("Delete this product?")) deleteProductMutation.mutate(product.id); }} className="flex-1"><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-4 border-b bg-background px-4 sticky top-0 z-40">
            <SidebarTrigger />
            <h2 className="font-semibold text-sm capitalize">{activeTab}</h2>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
