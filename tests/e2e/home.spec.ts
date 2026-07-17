import { expect, test } from "@playwright/test";

test("homepage presents the safe synthetic demonstration", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/auditor de documentos com ia/i);
  await expect(
    page.getByRole("heading", {
      name: /central de revisão/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /explorar caso sintético/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /explorar demonstração sintética/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/nenhum dado real deve ser usado/i),
  ).toBeVisible();
  await expect(page.getByText(/saídas da revisão/i)).toBeVisible();
  await expect(page.getByText(/referência histórica/i).first()).toBeVisible();
});
