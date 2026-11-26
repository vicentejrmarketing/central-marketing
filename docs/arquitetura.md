# Arquitetura — resumo técnico

O documento completo e aprovado é o **"Central de Gestão do Marketing — Arquitetura do Sistema"** (Claude Docs). Este arquivo resume o que está implementado e é atualizado a cada etapa.

## Camadas

```
Navegador ──HTTPS + cookie de sessão──▶ Next.js 16
  proxy.ts            checagem otimista (sem cookie → /login)
  páginas (RSC)       leituras via src/modules/*/queries|service
  server actions      escritas via src/modules/*/service (formAction/jsonAction)
  route handlers      /api/search, /api/notifications, /api/files/avatar, /api/health
        │
        ▼
Camada de domínio: requireCtx → Zod → assertCan/scope → $transaction → recordAudit → notify
        │
        ▼
PostgreSQL via Hyperdrive (Prisma 7 + @prisma/adapter-pg) · R2 privado (fotos) — no Cloudflare Workers
```

## Etapa 1 — implementado

| Área | Implementação |
| --- | --- |
| Sessões | Tabela `Session`; token aleatório de 32 bytes no cookie `__Host-cm_session` (HttpOnly, Secure, SameSite=Lax); banco guarda só o SHA-256. Validade 30 dias com renovação, expira após 7 dias sem uso. Logout, troca de senha e desativação apagam as sessões. |
| Senhas | Argon2id (19 MiB, t=2, p=1), mínimo de 10 caracteres, lista de senhas comuns, rehash automático se os parâmetros mudarem. |
| Força bruta | `LoginAttempt`: 5 falhas por e-mail ou 30 por IP em 15 minutos bloqueiam; mensagem genérica; tempo constante quando o e-mail não existe. |
| Convites e redefinição | `AuthToken` de uso único (convite 72 h, redefinição 1 h). Sem e-mail configurado, o admin copia o link. "Esqueci minha senha" não revela se o e-mail existe. |
| Permissões | Catálogo em `src/lib/authz/catalog.ts` (31 permissões). Efetiva = papel + GRANT − DENY (DENY vence). Escopos OWN, SECTOR, STORES, ALL. Papéis personalizados. Administrador sempre mantém `users.manage` e `permissions.manage`; sempre existe pelo menos um admin ativo. |
| Restrição regional | `Region`, `RegionManager` (com histórico), `Store.regionId`. `storeIdsFor`, `visibleStoresWhere`, `assertStoresInScope`. Fora do escopo → 404. Mudança de vínculo ou de região tem efeito imediato. |
| Lojas | Cadastro, edição com lock otimista (`version`), histórico na página da loja, importação XLSX/CSV com pré-visualização, reconhecimento de colunas por nome, criação de regiões e vínculo de gerentes regionais pela planilha. |
| Auditoria | `AuditLog` gravado na mesma transação; só campos alterados; campos sensíveis removidos. Trigger no PostgreSQL recusa UPDATE, DELETE e TRUNCATE. |
| Notificações | Central in-app, sino com atualização a cada 60 s e ao focar a janela; marcar como lida; histórico paginado. Tempo real (SSE) na Etapa 7. |
| Busca global | Ctrl+K; lojas, regiões, pessoas e setores, sem acentos, respeitando permissões e escopo. |

## Testes da Etapa 1

- **Unidade** (Vitest): cálculo de permissões, escopos, matriz padrão, Argon2id, política de senha, tokens, diff de auditoria.
- **Integração** (Vitest + PostgreSQL real): convite → senha → login; força bruta; sessões; redefinição; último administrador; lock otimista; exceções individuais; auditoria imutável no banco; restrição regional em listas, detalhes, regiões, busca, validação de lojas, histórico; vínculo e desvínculo imediatos; troca de região da loja; matriz de 14 operações × 5 papéis; importação XLSX/CSV.
- **Ponta a ponta** (Playwright, Chrome): primeiro acesso com troca obrigatória de senha; cadastro de região e loja; importação; convite e vínculo de gerente regional; o gerente só vê as próprias lojas (inclusive por URL direta e pela API de busca); auditoria; 401/redirect sem sessão; navegação no celular.
