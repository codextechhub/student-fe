import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

import { workboxOptions } from "./pwa.config";

/**
 * The XVS student app.
 *
 * It is served at the school's own address under `/student/`
 * (`bright-star.xvs.codexng.com/student/`), beside school-fe on the same
 * origin, so every asset and route lives under that base and nothing here may
 * claim a root path school-fe owns.
 *
 * Port 5175, strict: console-fe holds 5173 and school-fe 5174, and a server
 * that silently moved to the next free port would break every link built
 * against it. Open it as `http://<school-slug>.localhost:5175/student/`; the
 * school is read off the subdomain, as in production.
 *
 * `/v1` and `/media` are proxied to the API so cookies are first-party in
 * development, for the reason school-fe's config gives at length: the app at
 * `<slug>.localhost:5175` and the API at `localhost:8000` are different sites to
 * a browser. `changeOrigin` stays false so Django sees an Origin and Host that
 * agree. Point the proxy elsewhere with DEV_API_TARGET.
 */
const devApiTarget = process.env.DEV_API_TARGET ?? "http://localhost:8000";

export default defineConfig({
  base: "/student/",
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/v1": { target: devApiTarget, changeOrigin: false },
      "/media": { target: devApiTarget, changeOrigin: false },
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    tailwindcss(),
    VitePWA({
      // A new version waits for the pupil to accept it rather than swapping
      // the page underneath them mid-payment.
      registerType: "prompt",
      // The manifest is a file in public/, linked from index.html, so the
      // per-school manifest the backend serves can take its place at the same
      // address without a rebuild.
      manifest: false,
      workbox: workboxOptions,
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
