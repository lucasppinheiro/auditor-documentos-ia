import { expect, test } from "@playwright/test";

test("homepage presents the document review workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/auditor de documentos com ia/i);
  await expect(
    page.getByRole("heading", {
      name: /priorize achados e revise evidências com clareza/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /abrir revisão/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/não envie informações reais/i),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /revisão atual/i })).toBeVisible();
  await expect(page.getByRole("table", { name: /documentos prioritários/i })).toBeVisible();
});
