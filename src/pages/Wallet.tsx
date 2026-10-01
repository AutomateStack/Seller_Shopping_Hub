import { Navbar } from "@/components/Navbar";
import { SEOHead } from "@/components/SEOHead";
import { Footer } from "@/components/home/Footer";
import { WalletDashboard } from "@/components/luckydraw/WalletDashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function Wallet() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth"); return; }
      setUser(session.user);
    });
  }, [navigate]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="My Wallet | ShopHub" description="Manage your ShopHub wallet" canonical="/wallet" />
      <Navbar />
      <div className="container px-4 py-8">
        <WalletDashboard userId={user.id} />
      </div>
      <Footer />
    </div>
  );
}
