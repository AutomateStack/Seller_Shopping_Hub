import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/lib/analytics";

/**
 * Mounts once inside <BrowserRouter> and fires a `page_view` event
 * each time the route changes.
 */
export function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView({ pathname: location.pathname });
  }, [location.pathname]);

  return null;
}