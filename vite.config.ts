import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig, type ProxyOptions } from "vite";
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

/**
 * `/student/manifest.webmanifest` is the school's own manifest (its name, and
 * icons drawn from its crest), which the backend serves per school.
 *
 * In production the host passes the address through to
 * `/v1/portal/student/app/<slug>/manifest.webmanifest`, with the slug taken
 * from the school's address. This does the same in development, reading the
 * slug from the Host header (`lagoon-view.localhost:5175`), and answers with the
 * app's own XVS manifest in `public/` when the backend cannot be reached or
 * the address names no school.
 */
const fallbackManifest = () => readFileSync(path.resolve(__dirname, "public/manifest.webmanifest"));

const schoolManifest: ProxyOptions = {
  target: devApiTarget,
  changeOrigin: false,
  configure: (proxy) => {
    proxy.on("proxyReq", (proxyReq, req) => {
      const host = (req.headers.host ?? "").split(":")[0].toLowerCase();
      const slug = host.endsWith(".localhost") ? host.slice(0, -".localhost".length) : "";
      proxyReq.path = `/v1/portal/student/app/${encodeURIComponent(slug || "_")}/manifest.webmanifest`;
    });
    proxy.on("proxyRes", (proxyRes, _req, res) => {
      if ((proxyRes.statusCode ?? 500) < 400) {
        res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
        proxyRes.pipe(res);
        return;
      }
      proxyRes.resume();
      res.writeHead(200, { "Content-Type": "application/manifest+json" });
      res.end(fallbackManifest());
    });
    proxy.on("error", (_error, _req, res) => {
      if ("writeHead" in res && !res.headersSent) {
        res.writeHead(200, { "Content-Type": "application/manifest+json" });
        res.end(fallbackManifest());
      }
    });
  },
  selfHandleResponse: true,
};

export default defineConfig({
  base: "/student/",
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/student/manifest.webmanifest": schoolManifest,
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
