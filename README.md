# Central de Gestão do Marketing

Sistema web de gestão operacional do departamento de Marketing: pessoas, setores, 26 lojas (expansível), requisições, tarefas, calendário, arquivos no Google Drive, equipamentos, indicadores e auditoria.

A arquitetura aprovada está no documento **"Central de Gestão do Marketing — Arquitetura do Sistema"**; o resumo técnico está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Estado do projeto

| Etapa | Escopo | Situação |
| --- | --- | --- |
| 1 | Fundação, autenticação, usuários, setores, papéis e permissões, regiões e gerentes regionais, lojas e importação, base de auditoria e notificações | **Concluída** |
| 2 | Requisições e fluxo de aprovação | Próxima |
| 3–7 | Tarefas e calendário · Google Drive · Equipamentos · Dashboard e relatórios · Notificações em tempo real, segurança e testes completos | Planejadas |

O menu só mostra módulos já implementados.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · PostgreSQL 16 · Prisma 7 (driver adapter `pg`) · Zod 4 · Argon2id · Vitest · Playwright.

**Hospedagem: Cloudflare Workers** via vinext (Next.js sobre Vite), com Hyperdrive para o PostgreSQL e R2 para as fotos. Veja [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md). O mesmo código também roda em qualquer servidor Node (`pnpm build:node && pnpm start`).

## Como rodar localmente

Requisitos: Node 22+, pnpm 10+, PostgreSQL 16 (local ou Docker).

```bash
pnpm install
cp .env.example .env            # ajuste DATABASE_URL e o primeiro administrador
pnpm db:generate                # gera o Prisma Client
pnpm db:migrate:deploy          # aplica as migrações (ou pnpm db:migrate:local, ver abaixo)
pnpm db:seed                    # papéis, permissões, setores iniciais e o primeiro administrador
pnpm dev                        # http://localhost:3000 (vinext, runtime do Workers)
# ou: pnpm dev:node              # Next.js em Node
```

No primeiro acesso, o administrador criado pelo seed é obrigado a trocar a senha. Depois disso:

1. **Regiões e lojas**: em *Lojas → Importar planilha*, envie a planilha das 26 lojas (a coluna *Região* cria as regiões) ou cadastre uma a uma.
2. **Pessoas**: em *Usuários → Convidar usuário*. Sem e-mail configurado, o sistema mostra o link do convite para você copiar e enviar.
3. **Gerentes regionais**: convide com o papel *Gerente Regional* e vincule em *Regiões → (região) → Gerentes regionais*.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `DATABASE_URL` | sim | Conexão PostgreSQL |
| `APP_URL` | sim | URL pública (links de convite e redefinição) |
| `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | no primeiro seed | Primeiro administrador (só é criado se não houver administrador ativo) |
| `RESEND_API_KEY`, `EMAIL_FROM` | não | Envio de convites e redefinição de senha por e-mail |
| `CF_HYPERDRIVE_ID`, `APP_URL_PRODUCTION` | no deploy | ID do Hyperdrive e URL pública do Worker (ver `docs/deploy-cloudflare.md`) |

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm check` | Lint + tipos + verificação de migrações + testes (o mesmo que o CI) |
| `pnpm lint` / `pnpm typecheck` | ESLint (zero avisos) / `tsc --noEmit` |
| `pnpm test` | Testes de unidade e integração em PostgreSQL real (banco `central_marketing_test`, recriado a cada execução) |
| `pnpm test:e2e` | Testes ponta a ponta com Playwright (banco `central_marketing_e2e`, porta 3100). Padrão: Next.js em Node (`pnpm build:node` antes). Com `E2E_TARGET=workers`: build do Cloudflare dentro do workerd (`pnpm build` antes) |
| `pnpm build` / `pnpm deploy` | Build e deploy no Cloudflare Workers |
| `pnpm db:migrate:create <nome>` | Gera uma nova migração a partir do schema |
| `pnpm db:migrate:check` | Falha se o schema e as migrações divergirem |
| `pnpm db:verify` | Verificação de integridade dos dados |
| `pnpm docs:permissions` | Regenera `docs/permissoes.md` a partir do catálogo de permissões |

### Sobre `db:migrate:local` e `db:migrate:create`

O Prisma baixa o motor de migrações nativo de `binaries.prisma.sh`. No ambiente onde o projeto foi construído esse download é bloqueado, então `scripts/db-local.mjs` usa o **motor oficial em WebAssembly** (`@prisma/schema-engine-wasm`) para gerar as migrações e aplica os arquivos com o driver `pg`, gravando `_prisma_migrations` no mesmo formato e checksum do Prisma. Em máquinas com acesso normal e no CI, `pnpm db:migrate:deploy` (Prisma nativo) funciona com as mesmas migrações.

SQL que o Prisma não expressa (índice único parcial, `CHECK`, trigger de auditoria imutável, busca sem acento) fica em `prisma/sql/<nome>.sql` e é anexado à migração de mesmo nome.

## Estrutura

```
prisma/schema/*.prisma      schema por domínio          src/modules/<módulo>/   schemas · service · queries · actions
prisma/migrations/          migrações versionadas       src/lib/auth|authz/     sessão, senha, permissões, escopo de lojas
prisma/sql/                 SQL complementar            src/lib/audit.ts        auditoria na mesma transação
src/app/(auth)/             login, convite, senha        src/components/ui/      componentes shadcn/ui
src/app/(app)/              telas autenticadas           tests/unit|integration|e2e
```

Regras de arquitetura verificadas automaticamente:

- Telas, componentes, rotas e server actions **não importam o banco**; uma regra de lint bloqueia. Todo acesso passa pelos serviços dos módulos, que checam permissão e escopo.
- Toda escrita: sessão → Zod → `assertCan` → transação → `recordAudit` na mesma transação.
- Restrição regional: `src/lib/authz/stores.ts` é o único lugar que decide quais lojas um usuário vê (`visibleStoresWhere`, `assertStoresInScope`). Fora do escopo, a resposta é 404.

## Deploy

Cloudflare Workers: siga [`docs/deploy-cloudflare.md`](docs/deploy-cloudflare.md). Em resumo: banco PostgreSQL externo, `pnpm db:migrate:deploy`, `pnpm db:seed`, bucket R2, configuração Hyperdrive e `pnpm deploy`. Requer o plano **Workers Paid**.

Mais detalhes de operação em [`docs/operacao.md`](docs/operacao.md).
