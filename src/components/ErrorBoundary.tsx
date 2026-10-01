import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log so it surfaces in the console / monitoring tools
    console.error("ErrorBoundary caught:", error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleHome = () => {
    window.location.assign("/");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 px-4 text-center"
        >
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-muted-foreground max-w-md">
            An unexpected error occurred. You can try again, or head back to the home page.
          </p>
          {this.state.error?.message && (
            <p className="text-xs text-muted-foreground/80 max-w-md break-words">
              {this.state.error.message}
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-center">
            <Button onClick={this.handleRetry} className="min-h-[44px]">
              <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" /> Try again
            </Button>
            <Button variant="outline" onClick={this.handleHome} className="min-h-[44px]">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" /> Go home
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
