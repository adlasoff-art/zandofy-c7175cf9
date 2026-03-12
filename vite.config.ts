import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  root: "frontend",
  envDir: "..",
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: "::",
    port: 5173,
  },
  build: {
    outDir: "../dist",
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
      "recharts",
    ],
    exclude: [],
  },
  resolve: {
    dedupe: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
    ],
    alias: {
      "@": path.resolve(__dirname, "./frontend/src"),
    },
  },
}));
