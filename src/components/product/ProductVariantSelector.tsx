import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

import { Check } from "lucide-react";

interface ProductVariantSelectorProps {
  productId: string;
  selectedVariants: Record<string, string>;
  onVariantChange: (type: string, value: string, priceAdjustment: number) => void;
}

// Common color mappings for visual swatches
const COLOR_MAP: Record<string, string> = {
  red: "bg-red-500", blue: "bg-blue-500", green: "bg-green-500",
  black: "bg-black", white: "bg-white border-2 border-border",
  yellow: "bg-yellow-400", pink: "bg-pink-400", purple: "bg-purple-500",
  orange: "bg-orange-500", gray: "bg-gray-400", grey: "bg-gray-400",
  navy: "bg-blue-900", brown: "bg-amber-800", beige: "bg-amber-100",
  maroon: "bg-red-900", teal: "bg-teal-500", coral: "bg-orange-400",
};

export function ProductVariantSelector({ productId, selectedVariants, onVariantChange }: ProductVariantSelectorProps) {
  const { data: variants } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("variant_type", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (!variants?.length) return null;

  // Group variants by type
  const grouped = variants.reduce((acc, v) => {
    if (!acc[v.variant_type]) acc[v.variant_type] = [];
    acc[v.variant_type].push(v);
    return acc;
  }, {} as Record<string, typeof variants>);

  return (
    <div className="space-y-5 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
      {Object.entries(grouped).map(([type, options]) => {
        const isColor = type.toLowerCase() === "color" || type.toLowerCase() === "colour";
        const selectedValue = selectedVariants[type];

        return (
          <div key={type}>
            <label className="block text-sm font-semibold text-foreground mb-2.5 uppercase tracking-wide">
              {type}
              {selectedValue && (
                <span className="ml-2 text-muted-foreground font-normal normal-case tracking-normal">
                  — {selectedValue}
                </span>
              )}
            </label>

            <div className="flex flex-wrap gap-2">
              {options.map((variant) => {
                const isSelected = selectedValue === variant.variant_value;
                const colorClass = isColor ? COLOR_MAP[variant.variant_value.toLowerCase()] : null;
                const isOutOfStock = variant.stock === 0;

                if (isColor && colorClass) {
                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && onVariantChange(type, variant.variant_value, variant.price_adjustment)}
                      disabled={isOutOfStock}
                      className={cn(
                        "relative h-10 w-10 rounded-full transition-all",
                        colorClass,
                        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                        isOutOfStock && "opacity-30 cursor-not-allowed",
                        !isOutOfStock && !isSelected && "hover:ring-2 hover:ring-muted-foreground/40 hover:ring-offset-2 hover:ring-offset-background"
                      )}
                      title={`${variant.variant_value}${isOutOfStock ? " (Out of Stock)" : ""}${variant.price_adjustment ? ` (+₹${variant.price_adjustment})` : ""}`}
                    >
                      {isSelected && (
                        <Check className={cn(
                          "h-4 w-4 absolute inset-0 m-auto",
                          variant.variant_value.toLowerCase() === "white" || variant.variant_value.toLowerCase() === "beige"
                            ? "text-foreground"
                            : "text-white"
                        )} />
                      )}
                      {isOutOfStock && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="block w-[140%] h-px bg-destructive rotate-45 absolute" />
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <button
                    key={variant.id}
                    onClick={() => !isOutOfStock && onVariantChange(type, variant.variant_value, variant.price_adjustment)}
                    disabled={isOutOfStock}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all min-w-[3rem]",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-muted-foreground/40",
                      isOutOfStock && "opacity-40 cursor-not-allowed line-through"
                    )}
                  >
                    {variant.variant_value}
                    {variant.price_adjustment > 0 && (
                      <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                        +₹{variant.price_adjustment}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
