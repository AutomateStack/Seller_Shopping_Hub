import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Minus, Plus, ShoppingCart, Trash2, PackageCheck } from "lucide-react";

const db=supabase as any;
const KEY="shophub-marketplace-cart-v1";
type CartLine={product_id:string;quantity:number};
type Address={name:string;phone:string;address:string;city:string;state:string;postal_code:string};
const blank:Address={name:"",phone:"",address:"",city:"",state:"",postal_code:""};
function readCart():CartLine[]{try{const v=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(v)?v:[]}catch{return []}}
export default function MarketplaceCartCheckout(){
 const navigate=useNavigate(); const {toast}=useToast();
 const [lines,setLines]=useState<CartLine[]>([]); const [address,setAddress]=useState<Address>(blank); const [busy,setBusy]=useState(false); const [success,setSuccess]=useState<any[]>([]);
 const [userId,setUserId]=useState("");
 useEffect(()=>{setLines(readCart());supabase.auth.getUser().then(({data})=>setUserId(data.user?.id||""));},[]);
 const {data:products=[],isLoading}=useQuery({queryKey:["marketplace-cart-products",lines.map(x=>x.product_id).join(",")],enabled:lines.length>0,queryFn:async()=>{const {data,error}=await db.schema("catalog").from("products").select("id,title,price,mrp,stock_quantity,image_urls,status").in("id",lines.map(x=>x.product_id));if(error)throw error;return data||[];}});
 const rows=useMemo(()=>lines.map(line=>({...line,product:products.find((p:any)=>p.id===line.product_id)})).filter(x=>x.product),[lines,products]);
 const total=rows.reduce((s:any,x:any)=>s+Number(x.product.price)*x.quantity,0);
 const persist=(next:CartLine[])=>{setLines(next);localStorage.setItem(KEY,JSON.stringify(next));};
 const changeQty=(id:string,quantity:number)=>{if(quantity<1){persist(lines.filter(x=>x.product_id!==id));return;}persist(lines.map(x=>x.product_id===id?{...x,quantity:Math.min(quantity,99)}:x));};
 const update=(key:keyof Address,value:string)=>setAddress(a=>({...a,[key]:value}));
 const placeOrder=async()=>{if(!userId){toast({title:"Sign in required",description:"Please sign in before placing a marketplace order."});navigate("/auth");return;}
  if(!rows.length){toast({title:"Your cart is empty",variant:"destructive"});return;}
  if(!address.name.trim()||address.phone.trim().length<10||!address.address.trim()||!address.city.trim()||!address.state.trim()||!address.postal_code.trim()){toast({title:"Complete delivery details",description:"Enter all delivery fields and a phone number with at least 10 characters.",variant:"destructive"});return;}
  setBusy(true);try{const {data,error}=await supabase.rpc("place_marketplace_order",{p_items:rows.map((x:any)=>({product_id:x.product_id,quantity:x.quantity})),p_shipping_name:address.name,p_shipping_phone:address.phone,p_shipping_address:address.address,p_shipping_city:address.city,p_shipping_state:address.state,p_shipping_postal_code:address.postal_code});
   if(error)throw error;const created=data?.orders||[];setSuccess(created);persist([]);toast({title:"Order placed",description:"Your marketplace order was created with Cash on Delivery."});
  }catch(e:any){toast({title:"Could not place order",description:e.message||"Please check your cart and try again.",variant:"destructive"});}finally{setBusy(false);}
 };
 return <div className="min-h-screen flex flex-col bg-background"><Navbar/><main className="container mx-auto max-w-5xl flex-1 px-4 py-8">
 <Button variant="ghost" asChild className="mb-5"><Link to="/products"><ArrowLeft className="mr-2 h-4 w-4"/>Continue shopping</Link></Button>
 {success.length>0?<Card><CardContent className="p-8"><PackageCheck className="mb-3 h-12 w-12 text-primary"/><h1 className="text-2xl font-bold">Order placed successfully</h1><p className="mt-2 text-muted-foreground">Payment method: Cash on Delivery. Save your order number(s).</p><div className="my-5 space-y-2">{success.map(o=><div key={o.order_id} className="rounded-lg border p-3"><p className="font-semibold">{o.order_number}</p><p>₹{Number(o.total_amount).toFixed(2)}</p></div>)}</div><Button onClick={()=>navigate("/orders")}>View my orders</Button></CardContent></Card>:
 <><div className="mb-7"><h1 className="text-3xl font-bold">Marketplace cart</h1><p className="text-muted-foreground">Seller products · Cash on Delivery for testing</p></div>
 {!lines.length?<Card><CardContent className="p-10 text-center"><ShoppingCart className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><h2 className="text-xl font-semibold">Your marketplace cart is empty</h2><Button asChild className="mt-4"><Link to="/products">Browse products</Link></Button></CardContent></Card>:
 <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]"><div className="space-y-3">{isLoading?<p>Loading cart…</p>:rows.map((x:any)=><Card key={x.product_id}><CardContent className="flex gap-4 p-4"><img src={x.product.image_urls?.[0]||"/placeholder.svg"} alt={x.product.title} className="h-24 w-24 rounded-lg border object-cover"/><div className="min-w-0 flex-1"><h2 className="font-semibold">{x.product.title}</h2><p className="mt-1 font-bold text-primary">₹{Number(x.product.price).toFixed(2)}</p><p className="text-xs text-muted-foreground">{x.product.stock_quantity} in stock</p><div className="mt-3 flex items-center gap-2"><Button variant="outline" size="icon" onClick={()=>changeQty(x.product_id,x.quantity-1)}><Minus className="h-4 w-4"/></Button><span>{x.quantity}</span><Button variant="outline" size="icon" disabled={x.quantity>=Math.min(99,x.product.stock_quantity)} onClick={()=>changeQty(x.product_id,x.quantity+1)}><Plus className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>changeQty(x.product_id,0)}><Trash2 className="h-4 w-4"/></Button></div></div></CardContent></Card>)}
 <Card><CardContent className="space-y-4 p-5"><h2 className="text-xl font-semibold">Delivery details</h2><div className="grid gap-3 sm:grid-cols-2">{([["name","Full name"],["phone","Phone"],["address","Street address"],["city","City"],["state","State"],["postal_code","PIN / postal code"]] as [keyof Address,string][]).map(([key,label])=><div key={key} className={key==="address"?"sm:col-span-2":""}><Label htmlFor={key}>{label}</Label><Input id={key} value={address[key]} onChange={e=>update(key,e.target.value)} autoComplete={key==="name"?"name":key==="phone"?"tel":key==="address"?"street-address":key==="postal_code"?"postal-code":"off"} /></div>)}</div></CardContent></Card>
 </div><Card className="h-fit"><CardContent className="space-y-4 p-5"><h2 className="text-xl font-semibold">Order summary</h2><div className="flex justify-between"><span>Items ({rows.reduce((s:any,x:any)=>s+x.quantity,0)})</span><span>₹{total.toFixed(2)}</span></div><div className="flex justify-between text-sm text-muted-foreground"><span>Shipping</span><span>₹0.00 (testing)</span></div><div className="border-t pt-3 flex justify-between text-lg font-bold"><span>Total</span><span>₹{total.toFixed(2)}</span></div><p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Cash on Delivery only. Payment is not collected online. Stock is checked and reduced when the order is placed.</p><Button className="w-full" disabled={busy||isLoading||!rows.length||rows.some((x:any)=>x.product.status!=="approved"||x.quantity>x.product.stock_quantity)} onClick={placeOrder}>{busy?"Placing order…":"Place COD order"}</Button><p className="text-xs text-muted-foreground">Sign in is required. Items are stored in this browser until checkout.</p></CardContent></Card></div>}
 </>}
 </main><Footer/></div>;
}