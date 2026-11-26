# Manual de operação

## Primeiro acesso em produção

1. Defina `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL` e `SEED_ADMIN_PASSWORD` e rode `pnpm db:seed`. O seed só cria o administrador se não houver nenhum administrador ativo.
2. Entre com esse e-mail. O sistema obriga a troca de senha no primeiro acesso.
3. Remova `SEED_ADMIN_PASSWORD` das variáveis de ambiente depois do primeiro acesso.

## Pessoas

- **Convidar:** *Usuários → Convidar usuário*. Com `RESEND_API_KEY` configurada, o convite vai por e-mail; sem ela, copie o link mostrado na tela (vale por 72 horas).
- **Esqueceu a senha:** no cadastro da pessoa, *Gerar link de redefinição de senha* (vale por 1 hora). A pessoa também pode usar "Esqueci minha senha" no login quando o e-mail estiver configurado.
- **Saiu da empresa:** *Desativar*. O acesso cai na hora, as sessões são encerradas e o histórico é mantido. Usuários nunca são excluídos.
- **Gerente regional:** convide com o papel *Gerente Regional* (setor opcional) e vincule em *Regiões*. Desvincular encerra o acesso às lojas daquela região na hora e mantém o histórico do vínculo.

## Lojas e regiões

- **Planilha:** *Lojas → Importar planilha*. A prévia mostra o que será criado, atualizado ou ignorado. Lojas existentes são atualizadas pelo código. Linhas com erro não são importadas e ficam registradas no histórico da importação.
- **Mudar a loja de região:** edite a loja. Os gerentes regionais das duas regiões são notificados, e o acesso muda na hora.
- **Arquivar região:** só é permitido sem lojas ativas.

## Verificações

- `pnpm db:verify`: checa integridade (administrador ativo, setores obrigatórios, vínculos coerentes, triggers de auditoria) e avisa sobre regiões sem gerente regional e convites pendentes.
- `GET /api/health`: retorna `{"status":"ok"}` quando a aplicação e o banco respondem.

## Backup e restauração

- Neon: use os *branches* e o *point-in-time restore* do próprio Neon. Mantenha a retenção de histórico em pelo menos 7 dias.
- Exportação manual: `pg_dump --format=custom "$DATABASE_URL" > backup.dump`. Restauração: `pg_restore --clean --no-owner -d "$DATABASE_URL" backup.dump`.
- A trilha de auditoria é somente-inserção. Para restaurar um backup sobre um banco existente, use um banco novo e troque a `DATABASE_URL`.

## Migrações

- Produção e CI: `pnpm db:migrate:deploy` (Prisma nativo).
- Nova migração: altere `prisma/schema/*.prisma`, rode `pnpm db:migrate:create <nome>` e confira o SQL gerado. SQL complementar vai em `prisma/sql/<nome>.sql`.
- Nunca edite uma migração já aplicada; o runner recusa migrações com checksum diferente.
