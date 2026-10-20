import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { roomPlugin } from './server/rooms.mjs';

export default defineConfig({
  resolve: { preserveSymlinks: true },
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), roomPlugin()],
});
