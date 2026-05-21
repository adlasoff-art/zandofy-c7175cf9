import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
    exclude: [],
  },
  build: {
    rollupOptions: {
      output: {
        // Optional heavy libs only. Do NOT split react/react-dom/radix/recharts — Rollup can
        // create circular chunks (react-vendor ↔ radix-vendor) and the app never mounts in preview/CI.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion")) return "motion-vendor";
          if (id.includes("react-qrcode-logo") || id.includes("/qrcode")) return "qrcode-vendor";
          if (id.includes("lucide-react")) return "lucide-vendor";
          if (id.includes("@tanstack/react-query")) return "query-vendor";
          if (id.includes("@supabase")) return "supabase-vendor";
          return undefined;
        },
      },
    },
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "framer-motion",
    ],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
