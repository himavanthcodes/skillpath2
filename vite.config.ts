// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "roadmap-api-dev",
        configureServer(server) {
          const env = loadEnv(server.config.mode || "development", process.cwd(), "");
          if (env["GROQ_API_KEY"] && !process.env["GROQ_API_KEY"]) {
            process.env["GROQ_API_KEY"] = env["GROQ_API_KEY"];
          }
          if (env["GROQ_MODEL"] && !process.env["GROQ_MODEL"]) {
            process.env["GROQ_MODEL"] = env["GROQ_MODEL"];
          }

          server.middlewares.use(async (req, res, next) => {
            const path = (req.url ?? "").split("?")[0];
            if (path === "/api/roadmap/generate" && req.method === "POST") {
              try {
                const mod = (await server.ssrLoadModule("/src/server/roadmap-api.ts")) as {
                  handleNodeRequest: (req: unknown, res: unknown) => Promise<void>;
                };
                await mod.handleNodeRequest(req, res);

              } catch (err) {
                console.error("Roadmap API error in dev middleware:", err);
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "We couldn't generate your roadmap right now. Please try again." }));
                }
              }
              return;
            }
            next();
          });
        },
      },
    ],
  },
});

