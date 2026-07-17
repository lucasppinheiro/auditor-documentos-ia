import { expect, test } from "@playwright/test";

test("navega para a revisão e mantém exports sem banco", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /abrir revisão/i }).click();

  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", { name: /revisão do lote/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /documentos revisados no lote/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /^resultados$/i }),
  ).toHaveAttribute("href", "/api/demo/results.xlsx");
  await expect(
    page.getByRole("link", { name: /trilha de auditoria/i }),
  ).toHaveAttribute("href", "/api/demo/audit.xlsx");
});

test("bloqueia escrita e não expõe métricas ou sessões persistidas", async ({ request }) => {
  const writeResponse = await request.post("/api/sessions", { data: {} });
  expect(writeResponse.status()).toBe(403);
  await expect(writeResponse.json()).resolves.toMatchObject({
    code: "READ_ONLY_DEMO",
  });

  for (const endpoint of [
    "/api/sessions/public-demo/documents",
    "/api/sessions/public-demo/finalize",
  ]) {
    const response = await request.post(endpoint, { data: {} });
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "READ_ONLY_DEMO",
    });
  }

  expect((await request.get("/api/metrics")).status()).toBe(404);
  expect((await request.get("/sessions/00000000-0000-4000-8000-000000000000")).status()).toBe(404);

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  const healthBody = await health.json();
  expect(Object.keys(healthBody).sort()).toEqual(["status", "timestamp"]);
});

test("gera os exports sintéticos sem armazenamento persistente", async ({ request }) => {
  for (const endpoint of ["/api/demo/results.xlsx", "/api/demo/audit.xlsx"]) {
    const response = await request.get(endpoint);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect((await response.body()).byteLength).toBeGreaterThan(1_000);
  }
});
