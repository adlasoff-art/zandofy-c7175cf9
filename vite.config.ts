import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(__dirname);
  const reactPath = path.resolve(rootDir, "node_modules/react");
  const reactDomPath = path.resolve(rootDir, "node_modules/react-dom");

  return {
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
      emptyOutDir: true,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    optimizeDeps: {
      force: true,
      include: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "recharts",
        "framer-motion",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-popover",
        "@radix-ui/react-dialog",
        "@radix-ui/react-tooltip",
        "@radix-ui/react-select",
        "@radix-ui/react-accordion",
        "@radix-ui/react-tabs",
      ],
      exclude: [],
    },
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom/client",
        "react-router-dom",
        "@tanstack/react-query",
        "@radix-ui/react-context",
        "@radix-ui/react-primitive",
        "@radix-ui/react-compose-refs",
        "@radix-ui/react-use-controllable-state",
        "@radix-ui/react-dismissable-layer",
        "@radix-ui/react-focus-scope",
        "@radix-ui/react-popper",
        "@radix-ui/react-portal",
        "@radix-ui/react-presence",
      ],
      alias: {
        "@": path.resolve(rootDir, "./frontend/src"),
        "react": reactPath,
        "react-dom": reactDomPath,
        "react/jsx-runtime": path.resolve(reactPath, "jsx-runtime"),
        "react/jsx-dev-runtime": path.resolve(reactPath, "jsx-dev-runtime"),
        "react-dom/client": path.resolve(reactDomPath, "client"),
      },
    },
  };
});
