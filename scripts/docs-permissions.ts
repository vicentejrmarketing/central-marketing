/** Gera docs/permissoes.md a partir do catálogo em código (fonte da verdade). Uso: pnpm docs:permissions */
import fs from "node:fs";
import { PERMISSIONS, SCOPE_LABELS, SYSTEM_ROLE_DEFS } from "../src/lib/authz/catalog";

const roles = Object.values(SYSTEM_ROLE_DEFS);
const lines = [
  "# Permissões (gerado automaticamente)",
  "",
  "> Gerado por `pnpm docs:permissions` a partir de `src/lib/authz/catalog.ts`. Não edite à mão.",
  "> Esta é a matriz **padrão** aplicada quando os papéis de sistema são criados; o administrador pode alterá-la na tela Papéis e permissões.",
  "",
  "Escopos: " +
    Object.entries(SCOPE_LABELS)
      .map(([k, v]) => `**${k}** = ${v}`)
      .join(" · "),
  "",
  `| Permissão | Chave | ${roles.map((r) => r.name).join(" | ")} |`,
  `| --- | --- | ${roles.map(() => "---").join(" | ")} |`,
  ...PERMISSIONS.map((p) => {
    const cells = roles.map((r) => {
      const s = (r.permissions as Record<string, keyof typeof SCOPE_LABELS>)[p.key];
      return s ? (p.scoped ? SCOPE_LABELS[s] : "✓") : "—";
    });
    return `| ${p.module}: ${p.label} | \`${p.key}\` | ${cells.join(" | ")} |`;
  }),
  "",
];
fs.writeFileSync("docs/permissoes.md", lines.join("\n"));
console.log("docs/permissoes.md atualizado.");
