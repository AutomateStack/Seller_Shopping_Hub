import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useToast } from "@/hooks/use-toast";
import { Loader2, User, Mail, Phone, MapPin, LogOut } from "lucide-react";
import { AddressBook } from "@/components/profile/AddressBook";
import { LoyaltyCard } from "@/components/profile/LoyaltyCard";
import { RedeemPoints } from "@/components/profile/RedeemPoints";


interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
}

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    getProfile();
  }, []);

  const getProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/auth"); return; }
    setUser(session.user);

    const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    if (error && error.code !== "PGRST116") {
      toast({ title: "Error", description: "Failed to load profile", variant: "destructive" });
    } else {
      setProfile(data || { id: session.user.id, email: session.user.email || "", full_name: null, phone: null, address: null, city: null, state: null, zip_code: null });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert(profile);
    toast(error ? { title: "Error", description: "Failed to save profile", variant: "destructive" } : { title: "Success", description: "Profile updated successfully" });
    setSaving(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleChange = (field: keyof Profile, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : profile?.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="My Profile — ShopHub" description="Manage your ShopHub account information." canonical="/profile" />
      <Navbar />

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Avatar Header */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{profile?.full_name || "Your Profile"}</h1>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Personal Information</CardTitle>
              <CardDescription>Update your account details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                    <Input id="email" type="email" value={profile?.email || ""} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="full_name" className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Full Name</Label>
                    <Input id="full_name" value={profile?.full_name || ""} onChange={(e) => handleChange("full_name", e.target.value)} placeholder="Enter your full name" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                  <Input id="phone" value={profile?.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+91 98765 43210" className="mt-1" />
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3"><MapPin className="h-3.5 w-3.5" /> Address</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="address">Street Address</Label>
                      <Input id="address" value={profile?.address || ""} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Street, Area" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={profile?.city || ""} onChange={(e) => handleChange("city", e.target.value)} placeholder="City" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input id="state" value={profile?.state || ""} onChange={(e) => handleChange("state", e.target.value)} placeholder="State" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="zip_code">ZIP Code</Label>
                        <Input id="zip_code" value={profile?.zip_code || ""} onChange={(e) => handleChange("zip_code", e.target.value)} placeholder="400001" className="mt-1" />
                      </div>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          {user && <LoyaltyCard userId={user.id} />}

          {user && <RedeemPoints userId={user.id} />}


          {user && <AddressBook userId={user.id} />}
        </div>
      </div>

      <Footer />
    </div>
  );
}
