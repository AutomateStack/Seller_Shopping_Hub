import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Store, Package, ShoppingBag, Settings, ExternalLink, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function SellerPortalLayout({children,storeName="Seller workspace"}:{children:ReactNode;storeName?:string}) {
  const location=useLocation();
  const navigate=useNavigate();
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem("seller-sidebar-collapsed")==="true"}catch{return false}});
  const toggle=()=>setCollapsed(value=>{const next=!value;try{localStorage.setItem("seller-sidebar-collapsed",String(next))}catch{}return next});
  const signOut=async()=>{await supabase.auth.signOut();navigate("/")};
  const links=[{to:"/seller/dashboard",label:"Dashboard",icon:LayoutDashboard},{to:"/seller/orders",label:"Orders",icon:ShoppingBag},{to:"/seller/products",label:"My products",icon:Package},{to:"/seller/storefront",label:"Storefront",icon:Store},{to:"/seller/onboarding",label:"Store details",icon:Settings}];
  return <div className={`min-h-screen bg-muted/30 lg:grid ${collapsed?"lg:grid-cols-[76px_minmax(0,1fr)]":"lg:grid-cols-[250px_minmax(0,1fr)]"}`}>
    <aside className={`hidden border-r bg-card lg:flex lg:min-h-screen lg:flex-col ${collapsed?"items-center":""}`}>
      <div className={`flex h-20 w-full items-center border-b ${collapsed?"justify-center px-2":"gap-3 px-5"}`}><div className="rounded-xl bg-primary p-2 text-primary-foreground"><Store className="h-5 w-5"/></div>{!collapsed&&<div className="min-w-0"><p className="font-bold">ShopHub</p><p className="text-xs text-muted-foreground">Seller portal</p></div>}</div>
      {!collapsed&&<div className="w-full border-b px-5 py-4"><p className="truncate font-semibold">{storeName}</p><p className="mt-1 text-xs text-muted-foreground">Seller workspace</p></div>}
      <nav className={`w-full flex-1 space-y-1 p-3 ${collapsed?"px-2":""}`} aria-label="Seller navigation">{links.filter(link=>link.to!=="/seller/storefront").map(({to,label,icon:Icon})=><Link key={to} title={collapsed?label:undefined} to={to} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${location.pathname===to?"bg-primary/10 font-medium text-primary":"text-foreground hover:bg-muted"} ${collapsed?"justify-center px-2":""}`}><Icon className="h-4 w-4 shrink-0"/>{!collapsed&&<span>{label}</span>}</Link>)}
      <Link title={collapsed?"Storefront":undefined} to="/" className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted ${collapsed?"justify-center px-2":""}`}><Store className="h-4 w-4 shrink-0"/>{!collapsed&&<span>View marketplace</span>}</Link></nav>
      <div className={`w-full space-y-1 border-t p-3 ${collapsed?"px-2":""}`}><Button variant="ghost" className={`w-full ${collapsed?"justify-center px-2":"justify-start"}`} title={collapsed?"Expand sidebar":"Collapse sidebar"} onClick={toggle}>{collapsed?<PanelLeftOpen className="h-4 w-4"/>:<><PanelLeftClose className="mr-2 h-4 w-4"/>Collapse menu</>}</Button><Button variant="ghost" className={`w-full text-muted-foreground ${collapsed?"justify-center px-2":"justify-start"}`} title={collapsed?"Sign out":undefined} onClick={signOut}><LogOut className="h-4 w-4 shrink-0"/>{!collapsed&&<span className="ml-2">Sign out</span>}</Button></div>
    </aside>
    <div className="min-w-0"><div className="border-b bg-card px-4 py-3 lg:hidden"><div className="flex items-center justify-between"><p className="font-semibold">ShopHub Seller</p><Button variant="outline" size="sm" onClick={toggle}>{collapsed?<PanelLeftOpen className="mr-2 h-4 w-4"/>:<PanelLeftClose className="mr-2 h-4 w-4"/>}{collapsed?"Show menu":"Hide menu"}</Button></div>{!collapsed&&<nav className="mt-3 flex flex-wrap gap-2">{links.filter(link=>link.to!=="/seller/storefront").map(({to,label})=><Button key={to} asChild size="sm" variant={location.pathname===to?"default":"outline"}><Link to={to}>{label}</Link></Button>)}</nav>}</div>{children}</div>
  </div>;
}
