import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}

type CheckState = "checking" | "authorized" | "unauthorized";

export function ProtectedRoute({ children, requireAdmin = false, redirectTo = "/auth" }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [state, setState] = useState<CheckState>("checking");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session) {
        setState("unauthorized");
        navigate(redirectTo, { replace: true });
        return;
      }

      if (requireAdmin) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (cancelled) return;

        if (!data) {
          setState("unauthorized");
          navigate("/", { replace: true });
          return;
        }
      }

      setState("authorized");
    })();

    return () => { cancelled = true; };
  }, [navigate, requireAdmin, redirectTo]);

  if (state !== "authorized") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" aria-hidden="true" />
        <span className="text-sm text-muted-foreground">
          {state === "checking" ? "Verifying access…" : "Redirecting…"}
        </span>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return <>{children}</>;
}
