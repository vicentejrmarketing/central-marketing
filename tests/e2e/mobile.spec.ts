import { test, expect } from "@playwright/test";
import { ADMIN, login } from "./helpers";

test("navegação pelo celular: menu lateral em gaveta e tabelas utilizáveis", async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password);
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Lojas" }).click();
  await expect(page).toHaveURL("/lojas");
  await expect(page.getByRole("link", { name: "Joinville 01" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
