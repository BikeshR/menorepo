import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      // React 18 configuration
      jsxRuntime: "automatic",
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/services": path.resolve(__dirname, "./src/services"),
      "@/store": path.resolve(__dirname, "./src/store"),
      "@/types": path.resolve(__dirname, "./src/types"),
      "@/contexts": path.resolve(__dirname, "./src/contexts"),
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
          query: ["@tanstack/react-query"],
          charts: ["chart.js", "react-chartjs-2"],
          ui: ["@headlessui/react", "@heroicons/react"],
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
