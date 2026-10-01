import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/home/Footer";
import { Home, Search, ArrowLeft } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SEOHead title="Page Not Found — ShopHub" description="The page you're looking for doesn't exist." noindex />
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-in-up">
          <div className="text-8xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-4">
            404
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Page not found</h1>
          <p className="text-muted-foreground mb-8">
            The page you're looking for doesn't exist or may have been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/">
              <Button className="gap-2 w-full sm:w-auto">
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <Search className="h-4 w-4" />
                Browse Products
              </Button>
            </Link>
            <Button variant="ghost" className="gap-2" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default NotFound;
