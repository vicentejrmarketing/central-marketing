import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Arquitetura: telas, componentes, rotas e server actions NÃO acessam o banco diretamente.
    // Todo acesso passa pelos serviços/consultas dos módulos, que aplicam permissão e escopo de lojas.
    files: ["src/app/**", "src/components/**", "src/modules/*/actions.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@/lib/db", message: "Use as consultas/serviços do módulo (src/modules/*/service.ts ou queries.ts)." },
            { name: "@/generated/prisma/client", message: "Use as consultas/serviços do módulo." },
          ],
        },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([".next/**", ".cloudflare/**", "dist/**", ".vinext/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
