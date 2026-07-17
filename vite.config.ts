import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cache-Control": "no-store",
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    target: 'es2020',
    // Keep CommonJS helpers out of route chunks. Rollup can otherwise place
    // them inside a lazy page chunk (e.g. admin-pages), making vendor code import
    // back from that page chunk and triggering production TDZ crashes such as
    // "Cannot access 'gr' before initialization" on Android Chrome.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Keep CommonJS helpers inside vendor. This check must run before the
          // node_modules guard because Rollup emits the helper as a virtual id.
          if (id.includes('commonjsHelpers')) return 'vendor';
          if (!id.includes('node_modules')) return undefined;

          // Heavy, lazy-only libraries: let Rollup place them INSIDE the async
          // chunks that import them (games, admin invoices, STL viewer, QR).
          // Returning undefined bypasses the vendor mega-chunk so a visitor
          // hitting the homepage doesn't parse Three.js / jsPDF / recharts.
          // Test on iOS Safari after any change here — an earlier attempt to
          // split these into standalone manual chunks caused TDZ crashes.
          if (
            /[\\/]node_modules[\\/](three|three-stdlib|three-mesh-bvh|@react-three[\\/][^\\/]+|jspdf|html2canvas|html5-qrcode|recharts|d3-[a-z-]+|react-image-crop|embla-carousel[a-z-]*|qrcode\.react)[\\/]/.test(id)
          ) {
            return undefined;
          }

          // Keep React runtime in the same vendor chunk as Radix and other UI
          // libraries. Splitting React separately can create a production-only
          // circular dependency where vendor imports React while React imports
          // vendor helpers, leaving React.forwardRef undefined at startup.
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('scheduler')
          ) {
            return 'vendor';
          }
          return 'vendor';
        },
      },
    },

  },
  esbuild: mode === 'production'
    ? { drop: ['console', 'debugger'], legalComments: 'none' }
    : undefined,
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "react-router-dom"],
  },
}));
