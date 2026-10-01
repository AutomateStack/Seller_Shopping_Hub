import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Core React stays in the critical path
          if (/react-router|react-dom|\/react\//.test(id)) return "react-vendor";
          if (id.includes("@tanstack/react-query")) return "query-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          // Icon library is large and shared widely — split it out
          if (id.includes("lucide-react")) return "icons-vendor";
          // All Radix primitives bundled together (dedupes runtime deps)
          if (id.includes("@radix-ui")) return "ui-vendor";
          // Heavy/optional libraries — only pulled in by their pages
          // NOTE: do NOT manually chunk recharts/d3 — they have circular
          // internal imports that trigger a TDZ ReferenceError when split.
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("date-fns")) return "date-vendor";
          if (id.includes("react-hook-form") || id.includes("zod") || id.includes("@hookform")) return "form-vendor";
          if (id.includes("embla-carousel")) return "carousel-vendor";
          if (id.includes("@cashfreepayments")) return "payments-vendor";
        },
      },
    },
  },
}));
