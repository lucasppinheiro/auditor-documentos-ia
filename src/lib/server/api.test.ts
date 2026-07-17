import { afterEach, describe, expect, it, vi } from "vitest";

import { resetConfigCache } from "@/lib/config";
import {
  blockWriteInDemoMode,
  createApiRequestContext,
  hideInteractiveDataInDemoMode,
} from "@/lib/server/api";

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigCache();
});

describe("proteções do modo público", () => {
  it("bloqueia escrita e oculta dados interativos no modo demo", async () => {
    const context = createApiRequestContext(
      new Request("http://localhost/api/sessions", { method: "POST" }),
      "/api/sessions",
    );
    const blocked = blockWriteInDemoMode(context);

    expect(blocked?.status).toBe(403);
    await expect(blocked?.json()).resolves.toMatchObject({
      code: "READ_ONLY_DEMO",
    });
    expect(hideInteractiveDataInDemoMode()?.status).toBe(404);
  });

  it("libera o fluxo quando o modo interativo é explicitamente configurado", () => {
    vi.stubEnv("APP_MODE", "interactive");
    resetConfigCache();
    const context = createApiRequestContext(
      new Request("http://localhost/api/sessions", { method: "POST" }),
      "/api/sessions",
    );

    expect(blockWriteInDemoMode(context)).toBeNull();
    expect(hideInteractiveDataInDemoMode()).toBeNull();
  });
});
