import { describe, expect, it } from "vitest";

import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";
import { parseUploadedDocument } from "@/lib/documents/parser";

describe("parseUploadedDocument", () => {
  it("normaliza um documento sintético completo", () => {
    const parsed = buildSyntheticFixtureSet().historicalDocuments[0]!;

    expect(parsed.encoding).toBe("utf-8");
    expect(parsed.status).toBe("parsed");
    expect(parsed.missingFields).toEqual([]);
    expect(parsed.normalized.documentNumber).toBe("NF-AUD-001");
    expect(parsed.normalized.supplierName).toBe("Aurora Tecnologia Fictícia");
    expect(parsed.normalized.grossAmount).toBe(4000);
    expect(parsed.warningCodes).toEqual([]);
    expect(parsed.notExtractedFields).toEqual([]);
    expect(parsed.fieldSources.documentNumber).toBe("parser");
  });

  it("marca status fora do domínio sem assumir que o campo é confiável", () => {
    const parsed = buildSyntheticFixtureSet().reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_011.txt",
    )!;

    expect(parsed.status).toBe("partial");
    expect(parsed.normalized.status).toBe("EM_ANALISE");
    expect(parsed.warningCodes).toContain("STATUS_UNRECOGNIZED");
    expect(parsed.fieldSources.status).toBe("unresolved");
  });

  it("usa latin1 como fallback e preserva a evidência", () => {
    const source = buildSyntheticFixtureSet().historicalDocuments[0]!.rawText.replace(
      "AUD-B-001",
      "HASH-INVÁLIDO",
    );
    const parsed = parseUploadedDocument(
      "AUD_LATIN1.txt",
      Buffer.from(source, "latin1"),
    );

    expect(parsed.encoding).toBe("latin1");
    expect(parsed.warningCodes).toContain("ENCODING_FALLBACK");
    expect(parsed.warningCodes).toContain("HASH_MALFORMED");
    expect(parsed.normalized.supplierName).toBe("Aurora Tecnologia Fictícia");
    expect(parsed.fieldSources.verificationHash).toBe("unresolved");
  });
});
