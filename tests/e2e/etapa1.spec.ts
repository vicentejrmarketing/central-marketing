/**
 * Fluxo completo da Etapa 1 no navegador:
 * primeiro acesso do admin → regiões e lojas (cadastro e planilha) → convite de gerente regional →
 * vínculo à região → o gerente só vê as lojas dele, mesmo acessando URLs diretamente.
 */
import { test, expect, type Browser } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { ADMIN, expectToast, login } from "./helpers";

test.describe.configure({ mode: "serial" });

let inviteUrl = "";
let otherStoreUrl = "";

async function adminPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL("/");
  return page;
}

test("primeiro acesso exige troca de senha e só então libera o sistema", async ({ page }) => {
  await login(page, ADMIN.email, "senha-errada-123");
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await login(page, ADMIN.email, ADMIN.initial);
  await expect(page).toHaveURL(/\/trocar-senha/);
  await page.goto("/lojas");
  await expect(page).toHaveURL(/\/trocar-senha/);
  await page.getByLabel("Senha atual").fill(ADMIN.initial);
  await page.getByLabel("Nova senha", { exact: true }).fill(ADMIN.password);
  await page.getByLabel("Repita a nova senha").fill(ADMIN.password);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Admin");
});

test("administrador cria região e loja pelo formulário", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto("/regioes");
  await page.getByRole("button", { name: "Nova região" }).click();
  await page.getByLabel("Nome").fill("Norte SC");
  await page.getByRole("button", { name: "Criar região" }).click();
  await expectToast(page, "Região Norte SC criada");
  await expect(page.getByRole("link", { name: "Norte SC" })).toBeVisible();

  await page.goto("/lojas/nova");
  await page.getByLabel("Código").fill("JVL01");
  await page.getByLabel("Nome da loja").fill("Joinville 01");
  await page.getByLabel("Cidade").fill("Joinville");
  await page.getByLabel("UF").selectOption("SC");
  await page.getByLabel("Região").selectOption({ label: "Norte SC" });
  await page.getByLabel("Gerente da loja").fill("Carlos Souza");
  await page.getByRole("button", { name: "Cadastrar loja" }).click();
  await expect(page).toHaveURL(/\/lojas\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Joinville 01");
  await expect(page.getByText("cadastrou a loja Joinville 01")).toBeVisible();

  // validação no servidor: código duplicado
  await page.goto("/lojas/nova");
  await page.getByLabel("Código").fill("jvl01");
  await page.getByLabel("Nome da loja").fill("Outra");
  await page.getByLabel("Cidade").fill("Joinville");
  await page.getByLabel("UF").selectOption("SC");
  await page.getByLabel("Região").selectOption({ label: "Norte SC" });
  await page.getByRole("button", { name: "Cadastrar loja" }).click();
  await expect(page.getByText("Já existe uma loja com este código.").first()).toBeVisible();
});

test("importação de planilha com pré-visualização e região nova", async ({ browser }) => {
  const page = await adminPage(browser);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "e2e-")), "lojas.csv");
  fs.writeFileSync(
    file,
    "Código;Loja;Cidade;UF;Região\nJGS01;Jaraguá 01;Jaraguá do Sul;SC;Norte SC\nFLN01;Florianópolis 01;Florianópolis;SC;Grande Florianópolis\nERR;;;SC;\n",
  );
  await page.goto("/lojas/importar");
  await page.getByLabel(/Planilha/).setInputFiles(file);
  await page.getByRole("button", { name: "Pré-visualizar" }).click();
  await expect(page.getByText("2 nova(s)")).toBeVisible();
  await expect(page.getByText("1 com erro")).toBeVisible();
  await expect(page.getByText("1 região(ões) nova(s)")).toBeVisible();
  await page.getByRole("button", { name: /Confirmar importação de 2 loja/ }).click();
  await expect(page.getByText(/Importação concluída: 2 criada/).first()).toBeVisible();
  await page.goto("/lojas");
  await expect(page.getByRole("link", { name: "Florianópolis 01" })).toBeVisible();
  otherStoreUrl = (await page.getByRole("link", { name: "Florianópolis 01" }).getAttribute("href"))!;
});

test("convite de gerente regional e vínculo à região", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto("/configuracoes/usuarios/novo");
  await page.getByLabel("Nome completo").fill("Rita Regional");
  await page.getByLabel("E-mail").fill("rita.regional@empresa.com.br");
  await page.getByLabel("Papel").selectOption({ label: "Gerente Regional" });
  await expect(page.getByText("Opcional: gerentes regionais")).toBeVisible();
  await page.getByRole("button", { name: "Criar e convidar" }).click();
  await expect(page.getByText("Copie o link do convite e envie para a pessoa (vale por 72 horas)")).toBeVisible();
  inviteUrl = await page.getByLabel("Link do convite").inputValue();
  expect(inviteUrl).toMatch(/\/convite\//);

  await page.goto("/regioes");
  await page.getByRole("link", { name: "Norte SC" }).click();
  await page.getByLabel("Gerente regional").selectOption({ label: "Rita Regional (rita.regional@empresa.com.br)" });
  await page.getByRole("button", { name: "Vincular" }).click();
  await expectToast(page, "Gerente regional vinculado");
  await expect(page.getByText("rita.regional@empresa.com.br")).toBeVisible();
});

test("gerente regional aceita o convite e só vê as lojas da sua região", async ({ page }) => {
  await page.goto(inviteUrl);
  await page.getByLabel("Nova senha", { exact: true }).fill("senha-da-rita-2026");
  await page.getByLabel("Repita a nova senha").fill("senha-da-rita-2026");
  await page.getByRole("button", { name: "Definir senha e entrar" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Gerente Regional · Norte SC")).toBeVisible();

  // Menu reduzido, sem administração
  await expect(page.getByRole("link", { name: "Minhas lojas" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);

  await page.goto("/lojas");
  await expect(page.getByRole("link", { name: "Joinville 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jaraguá 01" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Florianópolis 01" })).toHaveCount(0);

  // Acesso direto por URL a loja de outra região e a telas administrativas: 404
  await page.goto(otherStoreUrl);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  for (const url of ["/configuracoes/usuarios", "/auditoria", "/lojas/nova", "/lojas/importar"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  }

  // Busca global também respeita o escopo
  const res = await page.request.get("/api/search?q=florian");
  expect((await res.json()).results).toEqual([]);

  // Notificação do vínculo
  await page.goto("/notificacoes");
  await expect(page.getByText("Você agora é gerente regional de Norte SC")).toBeVisible();
});

test("auditoria registra as ações e não oferece edição", async ({ browser }) => {
  const page = await adminPage(browser);
  await page.goto("/auditoria");
  await expect(page.getByText("vinculou Rita Regional como gerente regional de Norte SC")).toBeVisible();
  await expect(page.getByText(/importou lojas\.csv: 2 loja\(s\) criada\(s\)/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Editar|Excluir/ })).toHaveCount(0);
});

test("foto de perfil: envio e leitura pela rota protegida", async ({ browser }) => {
  const page = await adminPage(browser);
  // PNG 1x1 válido
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.goto("/perfil");
  await page.locator('input[name="avatar"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expectToast(page, "Foto atualizada");
  const src = await page.locator("main img").first().getAttribute("src");
  expect(src).toMatch(/^\/api\/files\/avatar\//);
  const res = await page.request.get(src!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect(Buffer.from(await res.body()).equals(png)).toBe(true);
});

test("APIs sem sessão respondem 401 e páginas redirecionam para o login", async ({ request, page }) => {
  expect((await request.get("/api/search?q=jo", { headers: { cookie: "" } })).status()).toBe(401);
  await page.context().clearCookies();
  await page.goto("/lojas");
  await expect(page).toHaveURL(/\/login\?next=%2Flojas/);
});
