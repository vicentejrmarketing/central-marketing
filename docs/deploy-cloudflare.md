# Deploy no Cloudflare Workers

O sistema roda no Cloudflare Workers com o **vinext** (a implementação do Next.js sobre Vite recomendada pelo Cloudflare). O mesmo código continua rodando em Node (`pnpm build:node` / `pnpm start`).

## Arquitetura no Cloudflare

| Peça | Serviço | Observação |
| --- | --- | --- |
| Aplicação | Worker `central-marketing` | `cloudflare.config.ts` é a fonte da verdade |
| Banco | PostgreSQL externo + **Hyperdrive** (binding `HYPERDRIVE`) | O Cloudflare não hospeda Postgres; o Hyperdrive faz o pool de conexões perto do banco |
| Fotos | **R2** privado `central-marketing-files` (binding `FILES`) | Servidas só pela rota protegida `/api/files/avatar/...` |
| URL pública | `APP_URL` (texto) | Usada nos links de convite e redefinição de senha |
| E-mail (opcional) | segredos `RESEND_API_KEY` e `EMAIL_FROM` | Sem eles, o admin copia os links na tela |

### Plano necessário: Workers Paid

A senha usa Argon2id com os parâmetros da OWASP (19 MiB). Cada login gasta cerca de 270 ms de CPU, e o plano gratuito permite só 10 ms por requisição. O **Workers Paid** (US$ 5/mês) permite até 30 s, por padrão. O Worker compactado tem cerca de 2,1 MB.

### O que muda no código entre Node e Workers

O `vite.config.ts` troca dois módulos no build do Workers. O resto do código é o mesmo:

- `src/lib/runtime.ts` → `src/lib/runtime.workers.ts`: banco pelo Hyperdrive e arquivos no R2, em vez de `DATABASE_URL` e pasta local.
- `src/generated/prisma` → `src/generated/prisma-workers`: Prisma Client gerado com `runtime = "workerd"`. O Workers não permite compilar WebAssembly em tempo de execução, então esse client carrega o compilador de consultas por import estático.

No Workers, o banco usa **um cliente por requisição**: conexões não podem ser reaproveitadas entre requisições, e o Hyperdrive mantém o pool de verdade.

## Passo a passo (primeiro deploy)

Pré-requisitos: um banco PostgreSQL 16 acessível pela internet, com SSL (Supabase, Neon ou outro), e um API token do Cloudflare com as permissões de conta **Workers Scripts: Edit**, **Workers R2 Storage: Edit**, **Hyperdrive: Edit** e **Account Settings: Read**.

```bash
export CLOUDFLARE_API_TOKEN=...        # token acima
export CLOUDFLARE_ACCOUNT_ID=...       # ID da conta (painel do Cloudflare)

# 1. Banco: migrações e configuração inicial (use a conexão DIRETA do banco, não a de pooler)
DATABASE_URL="postgresql://..." pnpm db:migrate:deploy
DATABASE_URL="postgresql://..." SEED_ADMIN_NAME="..." SEED_ADMIN_EMAIL="..." SEED_ADMIN_PASSWORD="..." pnpm db:seed

# 2. Recursos no Cloudflare
npx cf r2 buckets create central-marketing-files
npx cf hyperdrive create        # informe a conexão do banco; anote o ID criado

# 3. Build e deploy
export CF_HYPERDRIVE_ID=<id do Hyperdrive>
export APP_URL_PRODUCTION=https://central-marketing.<subdominio>.workers.dev   # ou o domínio próprio
pnpm deploy

# 4. (Opcional) e-mail
npx cf workers secrets update     # RESEND_API_KEY e EMAIL_FROM no Worker central-marketing
```

Depois do primeiro deploy, confira `https://<url>/api/health` (deve responder `{"status":"ok"}`) e entre com o administrador do seed. A troca de senha é obrigatória no primeiro acesso.

## Deploys seguintes

```bash
pnpm db:migrate:deploy   # só quando houver migração nova
pnpm deploy
```

## Testar localmente no runtime do Workers

```bash
DATABASE_URL=postgresql://.../central_marketing_e2e APP_URL_PRODUCTION=http://localhost:3100 pnpm build
E2E_TARGET=workers pnpm test:e2e     # roda os testes ponta a ponta dentro do workerd (vite preview)
```

O R2 e o Hyperdrive são simulados localmente; o Hyperdrive usa o `DATABASE_URL` informado no build.
