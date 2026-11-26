import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

/**
 * Build para Cloudflare Workers com vinext (Next.js sobre Vite).
 * O alias troca o adaptador de ambiente Node (`src/lib/runtime.ts`) pela versão Workers
 * (Hyperdrive para o banco e R2 para arquivos).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/lib\/runtime$/, replacement: fileURLToPath(new URL("./src/lib/runtime.workers.ts", import.meta.url)) },
      // Prisma Client gerado com runtime "workerd" (WebAssembly carregado por import estático).
      { find: /^@\/generated\/prisma\//, replacement: fileURLToPath(new URL("./src/generated/prisma-workers/", import.meta.url)) },
    ],
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
    }),
  ],
});
