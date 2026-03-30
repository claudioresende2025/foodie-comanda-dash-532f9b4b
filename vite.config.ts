import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins: PluginOption[] = [
    react(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["pwa-icon.png", "pwa-icon-192.png", "pwa-icon-512.png", "apple-touch-icon.png"],
      devOptions: {
        enabled: false,
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,jpg,jpeg,webp}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 604800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: "Food Comanda Pro",
        short_name: "Food Comanda",
        description: "Sistema completo de gestão para restaurantes - Comanda digital, delivery e muito mais",
        theme_color: "#22c55e",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["food", "business", "productivity"],
        lang: "pt-BR",
        dir: "ltr",
        icons: [
          {
            src: "/pwa-icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "apple touch icon"
          }
        ],
        screenshots: [
          {
            src: "/pwa-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "wide"
          }
        ]
      }
    })
  ];

  // lovable-tagger removido para não exibir badge "Edit with Lovable"

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins,
    define: {
      '__BUILD_TIMESTAMP__': JSON.stringify(Date.now().toString()),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ['react', 'react-dom'],
    },
  };
});
