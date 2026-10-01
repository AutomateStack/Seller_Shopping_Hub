import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export function useWishlist() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const { data: wishlistIds = [], isLoading } = useQuery({
    queryKey: ["wishlist", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("product_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return data.map((w) => w.product_id);
    },
  });

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("wishlist")
        .insert({ user_id: userId!, product_id: productId });
      if (error) throw error;
    },
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist", userId] });
      const prev = queryClient.getQueryData<string[]>(["wishlist", userId]) || [];
      queryClient.setQueryData(["wishlist", userId], [...new Set([...prev, productId])]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["wishlist", userId], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("wishlist")
        .delete()
        .eq("user_id", userId!)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onMutate: async (productId: string) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist", userId] });
      const prev = queryClient.getQueryData<string[]>(["wishlist", userId]) || [];
      queryClient.setQueryData(["wishlist", userId], prev.filter((id) => id !== productId));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["wishlist", userId], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wishlist"] }),
  });

  const toggle = (productId: string) => {
    if (!userId) return false;
    if (wishlistIds.includes(productId)) {
      removeMutation.mutate(productId);
    } else {
      addMutation.mutate(productId);
    }
    return true;
  };

  const isInWishlist = (productId: string) => wishlistIds.includes(productId);

  return { wishlistIds, isLoading, toggle, isInWishlist, isLoggedIn: !!userId };
}
