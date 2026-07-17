import { afterEach, describe, expect, it, vi } from "vitest";

import { resetConfigCache } from "@/lib/config";

import { POST } from "./route";

describe("POST /api/sessions", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigCache();
  });

  it("não aceita baseline_seed pelo contrato público", async () => {
    vi.stubEnv("APP_MODE", "interactive");
    resetConfigCache();

    const response = await POST(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceType: "baseline_seed" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
