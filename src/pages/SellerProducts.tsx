import { ChangeEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ImagePlus, Loader2, Package, Plus, Send, Trash2, AlertTriangle, Boxes, CircleAlert, Save, Pause, Play, Archive } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { SellerPortalLayout } from "@/components/seller/SellerPortalLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const db = supabase as any;
type Product = { id:string; title:string; description:string; category:string; brand:string; sku:string|null; price:number; mrp:number|null; stock_quantity:number; image_urls:string[]; status:string; created_at:string };
const emptyForm = { title:"", description:"", category:"", brand:"", sku:"", price:"", mrp:"", stock_quantity:"0" };
const productCategories = ["Fashion & Clothing","Jewellery & Accessories","Beauty & Personal Care","Home & Kitchen","Kitchen & Dining","Grocery & Food","Electronics","Mobile Accessories","Toys & Games","Baby & Kids","Bags & Luggage","Footwear","Sports & Fitness","Automotive","Books & Stationery","Pet Supplies","Handmade & Crafts","Other"];
const pretty = (s:string) => s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());

export default function SellerProducts() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId,setUserId] = useState("");
  const [sellerId,setSellerId] = useState("");
  const [editingId,setEditingId] = useState<string | null>(null);
  const [products,setProducts] = useState<Product[]>([]);
  const [form,setForm] = useState(emptyForm);
  const [images,setImages] = useState<string[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [uploading,setUploading] = useState(false);
  const [error,setError] = useState("");
  const [formOpen,setFormOpen] = useState(false);
  const [stockDrafts,setStockDrafts] = useState<Record<string,string>>({});
  const [savingStockId,setSavingStockId] = useState<string | null>(null);
  const [inventoryHistory,setInventoryHistory] = useState<Record<string,any[]>>({});
  const [confirmAction,setConfirmAction] = useState<{product:Product;action:"pause"|"resume"|"archive"}|null>(null);
  const [statusBusy,setStatusBusy] = useState(false);
  const [expandedProductId,setExpandedProductId] = useState<string|null>(null);
  const [changeSummary,setChangeSummary] = useState("");
  const [reviewConfirmOpen,setReviewConfirmOpen] = useState(false);

  async function load() {
    setLoading(true); setError("");
    const {data:{session}} = await supabase.auth.getSession();
    if (!session) { navigate("/auth?next=/seller/products",{replace:true}); return; }
    setUserId(session.user.id);
    const {data:seller,error:sellerError} = await db.schema("seller").from("seller_profiles").select("id,onboarding_status,account_status").eq("user_id",session.user.id).maybeSingle();
    if (sellerError) { setError(sellerError.message); setLoading(false); return; }
    if (!seller) { navigate("/seller/onboarding",{replace:true}); return; }
    if (seller.onboarding_status !== "approved" || seller.account_status !== "active") { navigate("/seller/onboarding",{replace:true}); return; }
    setSellerId(seller.id);
    const {data,error:productError} = await db.schema("catalog").from("products").select("id,seller_id,title,description,category,brand,sku,price,mrp,stock_quantity,image_urls,status,created_at,updated_at").eq("seller_id",seller.id).order("created_at",{ascending:false});
    if (productError) setError(productError.message); else { const rows=(data ?? []) as Product[]; setProducts(rows); if(rows.length){ const {data:movements}=await db.schema("catalog").from("inventory_movements").select("id,product_id,quantity_before,quantity_after,quantity_delta,movement_type,created_at").in("product_id",rows.map(p=>p.id)).order("created_at",{ascending:false}).limit(200); const grouped:Record<string,any[]>={}; (movements||[]).forEach((m:any)=>{(grouped[m.product_id] ||= []).push(m);}); setInventoryHistory(grouped); }}
    setLoading(false);
  }

  useEffect(()=>{ void load(); },[]);

  async function uploadImages(event:ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    if (images.length + files.length > 5) { toast({title:"Maximum 5 images",description:"Choose up to five product images.",variant:"destructive"}); event.target.value=""; return; }
    setUploading(true);
    try {
      const urls:string[] = [];
      for (const file of files) {
        if (!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Use JPG, PNG, or WebP images.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Each image must be 5 MB or smaller.");
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
        const path = userId + "/" + crypto.randomUUID() + "-" + safeName;
        const {error:uploadError} = await supabase.storage.from("product-images").upload(path,file,{upsert:false,contentType:file.type});
        if (uploadError) throw uploadError;
        urls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      }
      setImages(prev=>[...prev,...urls]);
      toast({title:"Images uploaded",description:`${urls.length} image(s) added to this draft.`});
    } catch (e) {
      toast({title:"Image upload failed",description:e instanceof Error?e.message:"Please try again.",variant:"destructive"});
    } finally { setUploading(false); event.target.value=""; }
  }

  async function saveProduct(submit:boolean, confirmedSummary?:string) {
    if (!sellerId) return;
    const price = Number(form.price), mrp = form.mrp ? Number(form.mrp) : null, stock = Number(form.stock_quantity);
    if (form.title.trim().length < 3 || !form.category.trim() || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      toast({title:"Check required fields",description:"Enter a product name, category, valid price, and non-negative whole-number stock.",variant:"destructive"}); return;
    }
    if (mrp !== null && (!Number.isFinite(mrp) || mrp < price)) {
      toast({title:"Check MRP",description:"MRP must be greater than or equal to the selling price.",variant:"destructive"}); return;
    }
    setSaving(true);
    const payload = {title:form.title.trim(),description:form.description.trim(),category:form.category.trim(),brand:form.brand.trim(),sku:form.sku.trim()||null,price,mrp,image_urls:images};
    const editingProduct = editingId ? products.find(p=>p.id===editingId) : null;
    const majorChanged = !!editingProduct && (
      editingProduct.title !== payload.title || editingProduct.category !== payload.category ||
      Number(editingProduct.price) !== price ||
      (editingProduct.mrp == null ? null : Number(editingProduct.mrp)) !== mrp ||
      JSON.stringify(editingProduct.image_urls||[]) !== JSON.stringify(images)
    );
    const approvedEdit = !!editingProduct && ["approved","paused"].includes(editingProduct.status);
    const detailChanged = !!editingProduct && (
      editingProduct.title !== payload.title ||
      (editingProduct.description ?? "") !== payload.description ||
      editingProduct.category !== payload.category ||
      (editingProduct.brand ?? "") !== payload.brand ||
      (editingProduct.sku ?? null) !== payload.sku ||
      Number(editingProduct.price) !== price ||
      (editingProduct.mrp == null ? null : Number(editingProduct.mrp)) !== mrp ||
      JSON.stringify(editingProduct.image_urls||[]) !== JSON.stringify(images)
    );
    if (approvedEdit && detailChanged && !submit) {
      toast({title:"Review required",description:"Submit product detail changes for admin review. The approved listing will remain unchanged until approval.",variant:"destructive"});
      setSaving(false);
      return;
    }
    if (approvedEdit && detailChanged && submit && !confirmedSummary) {
      setReviewConfirmOpen(true);
      setSaving(false);
      return;
    }

    if (approvedEdit && detailChanged && submit) {
      const {error:revisionError} = await db.rpc("submit_seller_product_revision",{
        p_product_id:editingId,
        p_proposed_data:payload,
        p_change_summary:confirmedSummary?.trim()
      });
      if (revisionError) {
        toast({title:"Could not submit revision",description:revisionError.message,variant:"destructive"});
        setSaving(false);
        return;
      }
      setForm(emptyForm); setImages([]); setEditingId(null); setFormOpen(false); setReviewConfirmOpen(false); setChangeSummary("");
      await load();
      toast({title:"Changes submitted for review",description:"Your approved listing remains unchanged until an admin approves this revision."});
      setSaving(false);
      return;
    }

    const query = editingId
      ? db.schema("catalog").from("products").update({...payload,stock_quantity:stock,status:submit?"pending_review":editingProduct?.status||"draft"}).eq("id",editingId).eq("seller_id",sellerId)
      : db.schema("catalog").from("products").insert({...payload,seller_id:sellerId,stock_quantity:stock,status:submit?"pending_review":"draft"});
    const {data,error:saveError} = await query.select("*").single();
    if (saveError) {
      toast({title:"Could not save product",description:saveError.message,variant:"destructive"});
    } else {
      const saved = data as Product;
      setProducts(prev=>editingId ? prev.map(p=>p.id===saved.id?saved:p) : [saved,...prev]);
      setForm(emptyForm); setImages([]); setEditingId(null); setFormOpen(false); setReviewConfirmOpen(false); setChangeSummary("");
      toast({title:submit?"Product submitted for review":editingId?"Product updated":"Draft saved",description:submit?"Your updated product has been submitted for admin review.":editingId?"Product updated.":"You can edit and submit it later."});
    }
    setSaving(false);
  }

  function editProduct(product:Product) {
    setFormOpen(true);
    setEditingId(product.id);
    setForm({title:product.title,description:product.description??"",category:product.category??"",brand:product.brand??"",sku:product.sku??"",price:String(product.price),mrp:product.mrp==null?"":String(product.mrp),stock_quantity:String(product.stock_quantity)});
    setImages(product.image_urls??[]);
    window.scrollTo({top:0,behavior:"smooth"});
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); setImages([]); setFormOpen(false); setReviewConfirmOpen(false); setChangeSummary(""); }

  async function saveStock(product:Product) {
    const raw = stockDrafts[product.id] ?? String(product.stock_quantity);
    const stock = Number(raw);
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      toast({title:"Invalid stock quantity",description:"Enter a whole number from 0 to 1,000,000.",variant:"destructive"});
      return;
    }
    setSavingStockId(product.id);
    const {data,error:stockError} = await db.rpc("update_seller_product_stock",{p_product_id:product.id,p_stock_quantity:stock});
    if (stockError) {
      toast({title:"Could not update stock",description:stockError.message,variant:"destructive"});
    } else {
      const updated = data as Product;
      setProducts(prev=>prev.map(p=>p.id===product.id?{...p,stock_quantity:updated.stock_quantity,updated_at:updated.updated_at}:p));
      setStockDrafts(prev=>({...prev,[product.id]:String(updated.stock_quantity)}));
      toast({title:"Inventory updated",description:`${product.title}: ${updated.stock_quantity} units available. Listing approval was preserved.`});
    }
    setSavingStockId(null);
  }

  async function changeListingStatus(product:Product, action:"pause"|"resume"|"archive") {
    setStatusBusy(true);
    const {data,error:statusError} = await db.rpc("manage_seller_product_listing",{p_product_id:product.id,p_action:action});
    if (statusError) {
      toast({title:"Could not update listing",description:statusError.message,variant:"destructive"});
      setStatusBusy(false); setConfirmAction(null); return;
    }
    const nextStatus = typeof data === "string" ? data : data?.status;
    if (!nextStatus) {
      toast({title:"Could not confirm listing status",description:"Refresh your products and check the current status.",variant:"destructive"});
      await load(); setStatusBusy(false); setConfirmAction(null); return;
    }
    setProducts(prev=>prev.map(p=>p.id===product.id?{...p,status:nextStatus}:p));
    toast({title:action==="pause"?"Listing paused":action==="resume"?"Listing resumed":"Listing archived",description:action==="archive"?"The listing is hidden; existing order records are preserved.":"Your listing status has been updated."});
    setStatusBusy(false); setConfirmAction(null);
  }

  async function submitDraft(product:Product) {
    const {error:updateError} = await db.schema("catalog").from("products").update({status:"pending_review"}).eq("id",product.id);
    if (updateError) toast({title:"Could not submit product",description:updateError.message,variant:"destructive"});
    else { toast({title:"Submitted for review"}); await load(); }
  }

  const lowStockProducts = products.filter(p => p.status === "approved" && p.stock_quantity > 0 && p.stock_quantity <= 5);
  const outOfStockProducts = products.filter(p => p.status === "approved" && p.stock_quantity === 0);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  return <SellerPortalLayout><main className="min-h-screen bg-background">
    <SEOHead title="My Products | Seller Shopping Hub" description="Manage your seller product listings." noindex />
    <Dialog open={reviewConfirmOpen} onOpenChange={open=>{if(!saving)setReviewConfirmOpen(open);}}>
      <DialogContent>
        <DialogHeader><DialogTitle>Describe your changes</DialogTitle><DialogDescription>Major changes will be sent to the admin for review. Explain what changed and why. The listing will remain unavailable until approved.</DialogDescription></DialogHeader>
        <Textarea value={changeSummary} onChange={e=>setChangeSummary(e.target.value)} maxLength={1500} rows={4} placeholder="Describe the changes and why they are needed."/>
        <p className="text-xs text-muted-foreground">{changeSummary.trim().length}/1500 characters · At least 5 characters required</p>
        <DialogFooter><Button variant="outline" onClick={()=>setReviewConfirmOpen(false)} disabled={saving}>Cancel</Button><Button disabled={saving||changeSummary.trim().length<5} onClick={()=>void saveProduct(true,changeSummary.trim())}>{saving?"Submitting…":"Save and submit for review"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmAction} onOpenChange={open=>{if(!open&&!statusBusy)setConfirmAction(null);}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmAction?.action==="pause"?"Pause listing?":confirmAction?.action==="resume"?"Resume listing?":"Archive listing?"}</DialogTitle>
          <DialogDescription>
            {confirmAction?.action==="pause" ? "Shoppers will no longer be able to buy " + confirmAction.product.title + ". Existing orders will remain unchanged." :
             confirmAction?.action==="resume" ? "Make " + confirmAction.product.title + " available to shoppers again. It must have stock." :
             "Hide " + (confirmAction?.product.title||"this listing") + " from shoppers. Existing order history is preserved, and archiving cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={statusBusy} onClick={()=>setConfirmAction(null)}>Cancel</Button>
          <Button variant={confirmAction?.action==="archive"?"destructive":"default"} disabled={statusBusy} onClick={()=>confirmAction&&void changeListingStatus(confirmAction.product,confirmAction.action)}>{statusBusy?"Please wait…":confirmAction?.action==="pause"?"Pause listing":confirmAction?.action==="resume"?"Resume listing":"Archive listing"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="container mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3"><Package className="h-7 w-7 text-primary"/></div><div><p className="text-sm text-muted-foreground">SELLER PORTAL</p><h1 className="text-3xl font-bold">My Products</h1><p className="text-muted-foreground">Create listings and submit them for admin approval.</p></div></div>
        <Button variant="outline" asChild><Link to="/seller/dashboard"><ArrowLeft className="mr-2 h-4 w-4"/> Seller dashboard</Link></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Boxes className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Total listings</p><p className="text-2xl font-bold">{products.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-500/10 p-2 text-amber-600"><AlertTriangle className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Low stock (1–5)</p><p className="text-2xl font-bold">{lowStockProducts.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-destructive/10 p-2 text-destructive"><CircleAlert className="h-5 w-5"/></div><div><p className="text-sm text-muted-foreground">Out of stock</p><p className="text-2xl font-bold">{outOfStockProducts.length}</p></div></CardContent></Card>
      </div>
      {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && <Card className="border-amber-500/40"><CardContent className="flex gap-3 p-4"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"/><div><p className="font-semibold">Inventory needs attention</p><p className="text-sm text-muted-foreground">{outOfStockProducts.length > 0 ? `${outOfStockProducts.length} approved product(s) are out of stock. ` : ""}{lowStockProducts.length > 0 ? `${lowStockProducts.length} approved product(s) have 5 or fewer units remaining.` : ""} Edit the listing to update stock after replenishment.</p></div></CardContent></Card>}
      {error && <Card className="border-destructive"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
      {formOpen ? <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5"/> {editingId?"Edit product":"Add a product"}</CardTitle><CardDescription>{editingId ? "Minor changes to description, brand, or SKU save without review. Changes to product details require admin review. Approved listing data remains live until the revision is approved. Stock is managed separately." : "Products remain unpublished until an admin approves them. Use accurate product details and images you have rights to use."}</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="product-title">Product name *</Label><Input id="product-title" maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Natural Coir Scrubber Pack of 5"/></div>
            <div className="space-y-2"><Label htmlFor="product-category">Category *</Label><Select value={form.category} onValueChange={value=>setForm({...form,category:value})}><SelectTrigger id="product-category"><SelectValue placeholder="Choose a product category"/></SelectTrigger><SelectContent>{productCategories.map(category=><SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>{form.category&&!productCategories.includes(form.category)&&<p className="text-xs text-muted-foreground">Existing category: {form.category}. Choose a category to change it.</p>}</div>
            <div className="space-y-2"><Label htmlFor="product-brand">Brand</Label><Input id="product-brand" value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})} placeholder="Brand name"/></div>
            <div className="space-y-2"><Label htmlFor="product-sku">Seller SKU (optional)</Label><Input id="product-sku" value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="Your internal SKU"/></div>
            <div className="space-y-2"><Label htmlFor="product-price">Selling price (₹) *</Label><Input id="product-price" type="number" min="0.01" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="199.00"/></div>
            <div className="space-y-2"><Label htmlFor="product-mrp">MRP (₹)</Label><Input id="product-mrp" type="number" min="0.01" step="0.01" value={form.mrp} onChange={e=>setForm({...form,mrp:e.target.value})} placeholder="249.00"/></div>
            {!(editingId && products.some(p=>p.id===editingId && ["approved","paused"].includes(p.status)))&&<div className="space-y-2"><Label htmlFor="product-stock">Available stock *</Label><Input id="product-stock" type="number" min="0" step="1" value={form.stock_quantity} onChange={e=>setForm({...form,stock_quantity:e.target.value})}/></div>}
            <div className="space-y-2 md:col-span-2"><Label htmlFor="product-description">Description</Label><Textarea id="product-description" rows={4} maxLength={5000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Features, size, material, what's included…"/></div>
          </div>
          <div className="space-y-2"><Label htmlFor="product-images">Product images (up to 5, JPG/PNG/WebP, max 5 MB each)</Label><Input id="product-images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading||images.length>=5} onChange={uploadImages}/>{uploading&&<p className="text-sm text-muted-foreground">Uploading images…</p>}
            {images.length>0&&<div className="flex flex-wrap gap-3">{images.map((url,i)=><div key={url} className="relative"><img src={url} alt={`Product image ${i+1}`} className="h-20 w-20 rounded-md border object-cover"/><Button type="button" size="icon" variant="destructive" className="absolute -right-2 -top-2 h-6 w-6" onClick={()=>setImages(prev=>prev.filter(x=>x!==url))} aria-label="Remove image"><Trash2 className="h-3 w-3"/></Button></div>)}</div>}
            <p className="text-xs text-muted-foreground">Images are uploaded privately by seller folder and served from the product image bucket.</p>
          </div>
          <div className="flex flex-wrap gap-2">{!(editingId && products.some(p=>p.id===editingId && ["approved","paused"].includes(p.status)))&&<Button onClick={()=>void saveProduct(false)} disabled={saving||uploading}><Plus className="mr-2 h-4 w-4"/>{saving?"Saving…":editingId?"Save changes":"Save draft"}</Button>}{editingId && products.some(p=>p.id===editingId && ["approved","paused"].includes(p.status)) ? <Button onClick={()=>void saveProduct(true)} disabled={saving||uploading}><Send className="mr-2 h-4 w-4"/>{saving?"Submitting…":"Save & submit for review"}</Button> : <Button variant="outline" onClick={()=>void saveProduct(true)} disabled={saving||uploading}><Send className="mr-2 h-4 w-4"/>Submit for review</Button>}{editingId&&<Button variant="ghost" onClick={cancelEdit} disabled={saving||uploading}>Cancel edit</Button>}</div>
        </CardContent>
      </Card> : <Button type="button" className="w-full sm:w-auto" onClick={()=>{setEditingId(null);setForm(emptyForm);setImages([]);setFormOpen(true);}}><Plus className="mr-2 h-4 w-4"/> Add a product</Button>}
      <section className="space-y-3"><div><h2 className="text-xl font-bold">Your listings ({products.length})</h2><p className="text-sm text-muted-foreground">Only your own products are shown here.</p></div>
        {products.length===0?<Card className="border-dashed"><CardContent className="py-10 text-center"><ImagePlus className="mx-auto h-8 w-8 text-muted-foreground"/><p className="mt-2 font-medium">No products yet</p><p className="text-sm text-muted-foreground">Create your first listing above.</p></CardContent></Card>:products.map(p=><Card key={p.id}><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          {p.image_urls?.[0]?<img src={p.image_urls[0]} alt={p.title} className="h-24 w-24 rounded-lg border object-cover"/>:<div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted"><Package className="h-8 w-8 text-muted-foreground"/></div>}
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{p.title}</h3><Badge variant={p.status==="approved"?"default":p.status==="rejected"?"destructive":p.status==="paused"?"outline":"secondary"}>{pretty(p.status)}</Badge></div><p className="text-sm text-muted-foreground">{p.category}{p.brand? ` · ${p.brand}`:""}{p.sku? ` · SKU ${p.sku}`:""}</p><p className="mt-1 font-semibold">₹{Number(p.price).toFixed(2)}{p.mrp? <span className="ml-2 text-sm font-normal text-muted-foreground line-through">₹{Number(p.mrp).toFixed(2)}</span>:null}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">Available stock: {p.stock_quantity}</span>{p.status === "approved" && p.stock_quantity === 0 && <Badge variant="destructive">Out of stock</Badge>}{p.status === "approved" && p.stock_quantity > 0 && p.stock_quantity <= 5 && <Badge variant="secondary" className="border-amber-500/40 text-amber-700">Low stock</Badge>}</div>
          <div className="mt-3"><Button size="sm" variant="outline" onClick={()=>setExpandedProductId(expandedProductId===p.id?null:p.id)}>{expandedProductId===p.id?"Hide details":"Details"} {expandedProductId===p.id?"↑":"↓"}</Button></div>
          {expandedProductId===p.id&&<div className="mt-3 space-y-3 border-t pt-3">
          {p.status==="paused"&&<p className="text-sm text-amber-700">Paused — hidden from shoppers. Existing orders are unaffected.</p>}
          {p.status==="archived"&&<p className="mt-2 text-sm text-muted-foreground">Archived — hidden from shoppers. Order history is preserved.</p>}
          {(p.status==="approved"||p.status==="paused")&&<div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={()=>editProduct(p)}><Package className="mr-2 h-4 w-4"/>Edit details</Button>
            {p.status==="approved"&&<Button size="sm" variant="outline" onClick={()=>setConfirmAction({product:p,action:"pause"})}><Pause className="mr-2 h-4 w-4"/>Pause listing</Button>}
            {p.status==="paused"&&<Button size="sm" onClick={()=>setConfirmAction({product:p,action:"resume"})} disabled={p.stock_quantity<1}><Play className="mr-2 h-4 w-4"/>Resume listing</Button>}
            <Button size="sm" variant="outline" onClick={()=>setConfirmAction({product:p,action:"archive"})}><Archive className="mr-2 h-4 w-4"/>Archive</Button>
          </div>}
          {p.status === "approved" && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"><div className="space-y-1"><Label htmlFor={`stock-${p.id}`}>Update available stock</Label><Input id={`stock-${p.id}`} className="w-36" type="number" min="0" max="1000000" step="1" value={stockDrafts[p.id] ?? String(p.stock_quantity)} onChange={e=>setStockDrafts(prev=>({...prev,[p.id]:e.target.value}))} /></div><Button size="sm" onClick={()=>void saveStock(p)} disabled={savingStockId===p.id || Number(stockDrafts[p.id] ?? p.stock_quantity)===p.stock_quantity}><Save className="mr-2 h-4 w-4"/>{savingStockId===p.id?"Saving…":"Save stock"}</Button><p className="basis-full text-xs text-muted-foreground">Updates inventory only; product approval and listing details stay unchanged.</p><details className="mt-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Stock movement history ({(inventoryHistory[p.id]||[]).length})</summary><div className="mt-3 space-y-2">{(inventoryHistory[p.id]||[]).map((m:any)=><div key={m.id} className="flex justify-between gap-3 border-b pb-2 text-sm"><div><p className="font-medium">{m.movement_type==="manual_adjustment"?"Manual adjustment":m.movement_type==="order_deduction"?"Order deduction":m.movement_type==="order_cancellation_restore"?"Cancellation restore":m.movement_type==="return_restock"?"Return restock":m.movement_type==="initial_stock"?"Initial stock":"Stock change"}</p><p className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString()}</p>{m.source_order_id&&<p className="text-xs text-muted-foreground">Order {m.source_order_id}</p>}{m.note&&<p className="text-xs text-muted-foreground">{m.note}</p>}</div><div className="text-right"><p className="font-semibold">{m.quantity_delta>0?"+":""}{m.quantity_delta} units</p><p className="text-xs text-muted-foreground">{m.quantity_before} → {m.quantity_after}</p></div></div>)}{!(inventoryHistory[p.id]||[]).length&&<p className="text-sm text-muted-foreground">No recorded stock changes yet.</p>}</div></details></div>}
          {(p.status==="draft"||p.status==="rejected"||p.status==="changes_requested")&&<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>editProduct(p)}><Package className="mr-2 h-4 w-4"/>Edit product</Button><Button variant="outline" onClick={()=>void submitDraft(p)}><Send className="mr-2 h-4 w-4"/>Submit for review</Button></div>}
          </div>}
          </div>
        </CardContent></Card>)}
      </section>
    </div>
  </main></SellerPortalLayout>;
}
