import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  display_order: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  icon: string | null;
  subcategories: Subcategory[];
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories-with-subs"],
    staleTime: 10 * 60 * 1000, // 10 min — taxonomy rarely changes
    queryFn: async (): Promise<Category[]> => {
      const [catsRes, subsRes] = await Promise.all([
        supabase.from("categories").select("*").order("display_order"),
        supabase.from("subcategories").select("*").order("display_order"),
      ]);
      if (catsRes.error) throw catsRes.error;
      if (subsRes.error) throw subsRes.error;
      const subs = (subsRes.data as Subcategory[]) || [];
      return ((catsRes.data as Omit<Category, "subcategories">[]) || []).map((c) => ({
        ...c,
        subcategories: subs.filter((s) => s.category_id === c.id),
      }));
    },
  });
}
