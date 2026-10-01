import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock: number | null;
}

export function FeaturedCarousel({ products }: { products: Product[] }) {
  if (!products || products.length === 0) return null;

  return (
    <section className="py-16 md:py-20">
      <div className="container px-4">
        <div className="mb-10 text-center animate-fade-in-up">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
            Handpicked for you
          </p>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Featured Products</h2>
        </div>
        <div className="px-12">
          <Carousel opts={{ align: "start", loop: true, slidesToScroll: 1 }} className="w-full">
            <CarouselContent className="-ml-4">
              {products.map((product, i) => (
                <CarouselItem
                  key={product.id}
                  className="pl-4 basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                >
                  <div
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <Link to={`/products/${product.id}`}>
                      <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer h-full border-border/50 hover:border-primary/30 hover:-translate-y-1.5">
                        <div className="aspect-[4/5] overflow-hidden bg-muted relative">
                          <OptimizedImage
                            src={product.image_url}
                            alt={product.name}
                            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                            responsiveWidths={[300, 500, 700]}
                            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 40vw, 25vw"
                          />
                          {product.stock != null && product.stock <= 5 && product.stock > 0 && (
                            <span className="absolute top-3 right-3 bg-destructive text-destructive-foreground text-xs font-semibold px-2.5 py-1 rounded-full">
                              Only {product.stock} left
                            </span>
                          )}
                        </div>
                        <CardContent className="p-5">
                          <h3 className="font-semibold mb-1.5 line-clamp-2 group-hover:text-primary transition-colors text-base">
                            {product.name}
                          </h3>
                          <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-primary">
                              ₹{product.price.toFixed(2)}
                            </p>
                          </div>
                          {product.stock != null && product.stock > 0 ? (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1.5 flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                              In Stock
                            </p>
                          ) : (
                            <p className="text-sm text-destructive mt-1.5">Out of Stock</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
        <div className="mt-10 text-center">
          <Link to="/products">
            <Button size="lg" variant="premium">
              View All Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
