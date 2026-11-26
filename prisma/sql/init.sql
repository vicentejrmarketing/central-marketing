-- Regras de integridade que o Prisma não expressa no schema.

-- Um usuário só pode ter um vínculo VIGENTE com cada região.
CREATE UNIQUE INDEX "RegionManager_active_unique"
  ON "RegionManager" ("regionId", "userId")
  WHERE "endsAt" IS NULL;

-- Vínculo encerrado precisa terminar depois de começar.
ALTER TABLE "RegionManager"
  ADD CONSTRAINT "RegionManager_period_check" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt");

-- UF com duas letras maiúsculas.
ALTER TABLE "Store"
  ADD CONSTRAINT "Store_state_check" CHECK ("state" ~ '^[A-Z]{2}$');

-- Trilha de auditoria somente-inserção: UPDATE e DELETE são recusados no banco,
-- inclusive para quem tiver acesso direto ao SQL com o usuário da aplicação.
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog é somente-inserção (operação % recusada)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_log_immutable();

-- Busca sem acentos: função imutável usada nas consultas de busca global.
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS
$$ SELECT public.unaccent('public.unaccent', $1) $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE INDEX "Store_search_trgm" ON "Store"
  USING gin (immutable_unaccent(lower("name" || ' ' || "code" || ' ' || "city")) gin_trgm_ops);
CREATE INDEX "User_search_trgm" ON "User"
  USING gin (immutable_unaccent(lower("name" || ' ' || "email")) gin_trgm_ops);
