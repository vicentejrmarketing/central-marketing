import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin.e2e@central.local", initial: "senha-inicial-e2e-123", password: "nova-senha-admin-e2e-456" };

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();
}
