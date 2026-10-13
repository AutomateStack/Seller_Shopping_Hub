import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { NewsletterSignup } from "./NewsletterSignup";

export function CTASection() {
  return (
    <section className="py-20 bg-gradient-to-br from-[#fffafd] via-[#fff0f6] to-[#ffdce9] relative overflow-hidden border-y border-[#f9a8c8]/50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-[#f9a8c8]/35 blur-[60px] animate-hero-pulse-slow" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-[#f472b6]/20 blur-[60px] animate-hero-pulse-slow-alt" />
      </div>
      <div className="container px-4 relative z-10">
        <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
          <h2 className="mb-4 text-3xl font-bold text-[#24151c] md:text-4xl">
            Stay in the Loop
          </h2>
          <p className="mb-8 text-lg text-[#59404b]">
            Subscribe for exclusive deals, new arrivals, and shopping tips — straight to your inbox.
          </p>
          <div className="flex justify-center mb-8">
            <NewsletterSignup />
          </div>
          <Link to="/products">
            <Button
              size="lg"
              variant="outline"
              className="bg-primary text-primary-foreground border-primary hover:bg-primary-hover px-8"
            >
              Explore Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
