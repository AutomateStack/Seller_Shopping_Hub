import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { NewsletterSignup } from "./NewsletterSignup";

export function CTASection() {
  return (
    <section className="py-20 bg-gradient-hero relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-primary-foreground/5 blur-[60px] animate-hero-pulse-slow" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-secondary/10 blur-[60px] animate-hero-pulse-slow-alt" />
      </div>
      <div className="container px-4 relative z-10">
        <div className="mx-auto max-w-2xl text-center animate-fade-in-up">
          <h2 className="mb-4 text-3xl font-bold text-primary-foreground md:text-4xl">
            Stay in the Loop
          </h2>
          <p className="mb-8 text-lg text-primary-foreground/80">
            Subscribe for exclusive deals, new arrivals, and shopping tips — straight to your inbox.
          </p>
          <div className="flex justify-center mb-8">
            <NewsletterSignup />
          </div>
          <Link to="/products">
            <Button
              size="lg"
              variant="outline"
              className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20 px-8"
            >
              Explore Products <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
