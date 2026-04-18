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
    sourcemap: mode === "development",
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    cssMinify: true,
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Heavy libs into their own chunks (loaded only when their feature is used)
          if (id.includes('html2canvas')) return 'vendor-html2canvas';
          if (id.includes('jspdf')) return 'vendor-jspdf';
          if (id.includes('three') || id.includes('@react-three')) return 'vendor-three';
          if (id.includes('html5-qrcode') || id.includes('jsqr')) return 'vendor-qr';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
          // Split the remaining catch-all `vendor` chunk to avoid loading unused JS up-front
          if (id.includes('@supabase') || id.includes('postgrest') || id.includes('gotrue') || id.includes('realtime-js')) return 'vendor-supabase';
          if (id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-icons';
          if (id.includes('date-fns') || id.includes('dayjs')) return 'vendor-date';
          if (id.includes('zod') || id.includes('react-hook-form') || id.includes('@hookform')) return 'vendor-forms';
          if (id.includes('embla-carousel') || id.includes('swiper')) return 'vendor-carousel';
          if (id.includes('dompurify') || id.includes('sanitize-html')) return 'vendor-sanitize';
          if (id.includes('sonner') || id.includes('cmdk') || id.includes('vaul') || id.includes('input-otp')) return 'vendor-ui';
          if (id.includes('@capacitor')) return 'vendor-capacitor';
          return 'vendor';
        },
      },
    },
  },
  esbuild: mode === 'production'
    ? { drop: ['console', 'debugger'] }
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
    force: true,
  },
}));
