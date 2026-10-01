import { Button } from "@/components/ui/button";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useRef } from "react";

interface Props {
  products: any[] | undefined;
}

function escapeCsv(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* ignore */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.length && r.some(v => v !== ""));
}

export function ProductCSVTools({ products }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const exportCSV = () => {
    if (!products?.length) {
      toast({ title: "No products to export" });
      return;
    }
    const headers = ["id", "name", "description", "price", "stock", "category", "image_url", "featured"];
    const rows = products.map(p => headers.map(h => escapeCsv((p as any)[h])));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) throw new Error("CSV must have header + at least one row");
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const required = ["name", "price"];
      for (const r of required) {
        if (!headers.includes(r)) throw new Error(`Missing required column: ${r}`);
      }
      const idx = (col: string) => headers.indexOf(col);
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rec: any = {
          name: row[idx("name")]?.trim(),
          description: idx("description") >= 0 ? row[idx("description")] || null : null,
          price: parseFloat(row[idx("price")]) || 0,
          stock: idx("stock") >= 0 ? parseInt(row[idx("stock")]) || 0 : 0,
          category: idx("category") >= 0 ? row[idx("category")] || null : null,
          image_url: idx("image_url") >= 0 ? row[idx("image_url")] || null : null,
          featured: idx("featured") >= 0 ? /^(true|1|yes)$/i.test(row[idx("featured")] || "") : false,
        };
        if (!rec.name) continue;
        const existingId = idx("id") >= 0 ? row[idx("id")]?.trim() : "";
        if (existingId) toUpdate.push({ id: existingId, ...rec });
        else toInsert.push(rec);
      }
      if (toInsert.length) {
        const { error } = await supabase.from("products").insert(toInsert);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { id, ...rest } = u;
        const { error } = await supabase.from("products").update(rest).eq("id", id);
        if (error) throw error;
      }
      return { inserted: toInsert.length, updated: toUpdate.length };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Import complete", description: `${r.inserted} added, ${r.updated} updated` });
    },
    onError: (e: any) => toast({ title: "Import failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importMutation.mutate(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={importMutation.isPending}>
        <Upload className="h-4 w-4 mr-1" /> {importMutation.isPending ? "Importing..." : "Import CSV"}
      </Button>
      <Button variant="outline" size="sm" onClick={exportCSV}>
        <Download className="h-4 w-4 mr-1" /> Export CSV
      </Button>
    </div>
  );
}