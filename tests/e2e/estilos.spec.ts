/**
 * Garante que o CSS de produção traz as classes utilitárias do Tailwind.
 * Sem o loader do Tailwind no build, a página sai como HTML cru — os testes funcionais não percebem.
 */
import { test, expect } from "@playwright/test";

test("tela de login renderiza com o tema aplicado", async ({ page }) => {
  await page.goto("/login");
  const button = page.getByRole("button", { name: "Entrar" });
  await expect(button).toBeVisible();
  const styles = await button.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, width: el.getBoundingClientRect().width, radius: s.borderTopLeftRadius };
  });
  expect(styles.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(styles.bg).not.toBe("rgb(239, 239, 239)"); // botão padrão do navegador
  expect(styles.radius).not.toBe("0px");
  expect(styles.width).toBeGreaterThan(200); // w-full dentro do cartão
});
