import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, PackageX, CheckCircle, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState, useMemo } from "react";

interface AdminInventoryProps {
  products: any[] | undefined;
}

export function AdminInventory({ products }: AdminInventoryProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const categories = Array.from(new Set(products?.map(p => p.category).filter(Boolean))) || [];

  const outOfStock = products?.filter(p => (p.stock ?? 0) === 0) || [];
  const lowStock = products?.filter(p => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 10) || [];
  const healthyStock = products?.filter(p => (p.stock ?? 0) >= 10) || [];
  const maxStock = Math.max(...(products?.map(p => p.stock ?? 0) || [1]));

  const filtered = useMemo(() => {
    const sorted = [...(products || [])].sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
    return sorted.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const stock = p.stock ?? 0;
      const matchesStock =
        stockFilter === "all" ||
        (stockFilter === "out" && stock === 0) ||
        (stockFilter === "low" && stock > 0 && stock < 10) ||
        (stockFilter === "ok" && stock >= 10);
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory Alerts</h1>
        <p className="text-muted-foreground">Monitor stock levels across all products.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-destructive/30 bg-destructive/5 cursor-pointer" onClick={() => setStockFilter(stockFilter === "out" ? "all" : "out")}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
              <PackageX className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{outOfStock.length}</p>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-300/30 bg-orange-50 cursor-pointer" onClick={() => setStockFilter(stockFilter === "low" ? "all" : "low")}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{lowStock.length}</p>
              <p className="text-xs text-muted-foreground">Low Stock (&lt;10)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-300/30 bg-green-50 cursor-pointer" onClick={() => setStockFilter(stockFilter === "ok" ? "all" : "ok")}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{healthyStock.length}</p>
              <p className="text-xs text-muted-foreground">Healthy Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base">Stock Levels</CardTitle>
              <CardDescription>{filtered.length} product{filtered.length !== 1 ? "s" : ""} shown</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => <SelectItem key={cat} value={cat!}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stock" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="out">Out of Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="ok">Healthy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((product) => {
                const stock = product.stock ?? 0;
                const pct = maxStock > 0 ? (stock / maxStock) * 100 : 0;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{product.category || "—"}</TableCell>
                    <TableCell className="font-semibold">{stock}</TableCell>
                    <TableCell className="w-32">
                      <Progress value={pct} className="h-2" />
                    </TableCell>
                    <TableCell>
                      {stock === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : stock < 10 ? (
                        <Badge className="bg-orange-500 text-white">Low</Badge>
                      ) : (
                        <Badge className="bg-green-600 text-white">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No products match filters</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}