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
  build: {
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    cssMinify: true,
    target: 'es2020',
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "./node_modules/react/jsx-runtime.js"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "./node_modules/react/jsx-dev-runtime.js"),
    },
    // Prevent multiple React copies in the bundle
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    exclude: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
