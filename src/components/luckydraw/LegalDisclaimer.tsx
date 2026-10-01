import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

export function LegalDisclaimer() {
  return (
    <section className="py-12 border-t">
      <div className="container px-4 max-w-3xl mx-auto">
        <div className="bg-muted/50 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Transparency & Compliance</h3>
          </div>

          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <div className="flex gap-2">
              <AlertTriangle className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
              <p>
                <strong className="text-foreground">No guarantee of winning.</strong> This is a promotional reward program, not gambling. 
                Participation does not guarantee any prize. Winners are selected through a transparent, 
                verifiable random algorithm.
              </p>
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p>
                <strong className="text-foreground">Free entry available.</strong> Every registered user receives 1 free entry per draw. 
                Paid entries are optional and for additional chances only.
              </p>
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p>
                Each draw has a unique Draw ID and hash for verification. All entries and results 
                are logged and auditable. View our{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and{" "}
                <Link to="/lucky-draw/rules" className="text-primary hover:underline">Contest Rules</Link> for details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
