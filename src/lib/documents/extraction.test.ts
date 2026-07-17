import { afterEach, describe, expect, it, vi } from "vitest";

import { resetConfigCache } from "@/lib/config";
import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";
import {
  extractDocumentWithAi,
  mergeExtraction,
  resolveExtractionProvider,
  shouldUseAiExtraction,
  structuredDocumentExtractionSchema,
  type StructuredDocumentExtraction,
} from "@/lib/documents/extraction";

const providerMocks = vi.hoisted(() => ({
  geminiGenerate: vi.fn(),
  openAiCreate: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: providerMocks.geminiGenerate };
  },
}));

vi.mock("openai", () => ({
  default: class {
    responses = { create: providerMocks.openAiCreate };
  },
}));

afterEach(() => {
  providerMocks.geminiGenerate.mockReset();
  providerMocks.openAiCreate.mockReset();
  vi.unstubAllEnvs();
  resetConfigCache();
});

const aiPayload: StructuredDocumentExtraction = {
  documentType: "CONTRATO",
  documentNumber: "IA-ALTERARIA-O-VALOR",
  issueDateIso: "2025-02-10",
  supplierName: "Fornecedor sugerido pela IA",
  supplierCnpjNormalized: "70000000000107",
  serviceDescription: "Descrição sugerida pela IA",
  grossAmount: 999,
  paymentDateIso: "2025-02-12",
  invoiceIssueDateIso: "2025-02-10",
  approvedBy: "Aline Rocha",
  destinationBank: "Banco sugerido pela IA",
  status: "PAGO",
  verificationHash: "AUD-IA-001",
  observation: null,
  notExtractedFields: [],
};

describe("resolveExtractionProvider", () => {
  it("prefere Gemini no modo automático quando ambos estão configurados", () => {
    expect(
      resolveExtractionProvider({
        aiProvider: "auto",
        geminiApiKey: "gemini-test-key",
        geminiModel: "gemini-2.5-flash-lite",
        openAiApiKey: "openai-test-key",
        openAiModel: "gpt-4.1-mini",
      }),
    ).toEqual({ provider: "gemini", modelId: "gemini-2.5-flash-lite" });
  });

  it("exige a chave do provedor explicitamente selecionado", () => {
    expect(() =>
      resolveExtractionProvider({
        aiProvider: "gemini",
        geminiApiKey: null,
        geminiModel: "gemini-2.5-flash-lite",
        openAiApiKey: "openai-test-key",
        openAiModel: "gpt-4.1-mini",
      }),
    ).toThrow(/GEMINI_API_KEY/i);
  });
});

describe("shouldUseAiExtraction", () => {
  it("não chama IA para um documento determinístico completo", () => {
    const parsed = buildSyntheticFixtureSet().historicalDocuments[0]!;
    expect(shouldUseAiExtraction(parsed)).toBe(false);
  });

  it("chama IA para documento parcial e permite modo forçado", () => {
    const fixtures = buildSyntheticFixtureSet();
    const partial = fixtures.reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_017.txt",
    )!;

    expect(shouldUseAiExtraction(partial)).toBe(true);
    expect(
      shouldUseAiExtraction(fixtures.historicalDocuments[0]!, {
        forceAiExtraction: true,
      }),
    ).toBe(true);
  });
});

describe("mergeExtraction", () => {
  it("preserva campos confiáveis do parser e usa IA somente no campo ausente", () => {
    const parsed = buildSyntheticFixtureSet().reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_017.txt",
    )!;
    const merged = mergeExtraction(parsed, aiPayload, "gemini");

    expect(merged.normalized.documentNumber).toBe("NF-REV-017");
    expect(merged.normalized.serviceDescription).toBe(
      "Serviço sintético para demonstração",
    );
    expect(merged.normalized.verificationHash).toBe("AUD-IA-001");
    expect(merged.fieldSources.documentNumber).toBe("parser");
    expect(merged.fieldSources.verificationHash).toBe("gemini");
    expect(merged.notExtractedFields).toEqual([]);
  });

  it("substitui status inválido e registra o provedor", () => {
    const parsed = buildSyntheticFixtureSet().reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_011.txt",
    )!;
    const merged = mergeExtraction(parsed, aiPayload, "openai");

    expect(merged.normalized.status).toBe("PAGO");
    expect(merged.fieldSources.status).toBe("openai");
  });
});

describe("structuredDocumentExtractionSchema", () => {
  it("rejeita respostas com data ou CNPJ fora do contrato", () => {
    expect(() =>
      structuredDocumentExtractionSchema.parse({
        ...aiPayload,
        issueDateIso: "10/02/2025",
        supplierCnpjNormalized: "123",
      }),
    ).toThrow();
  });
});

describe("extractDocumentWithAi", () => {
  it("valida e mescla uma resposta Gemini sem sobrescrever o parser", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    resetConfigCache();
    providerMocks.geminiGenerate.mockResolvedValue({
      text: JSON.stringify(aiPayload),
    });
    const partial = buildSyntheticFixtureSet().reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_017.txt",
    )!;

    const result = await extractDocumentWithAi(partial);

    expect(result.provider).toBe("gemini");
    expect(result.document.normalized.documentNumber).toBe("NF-REV-017");
    expect(result.document.normalized.verificationHash).toBe("AUD-IA-001");
    expect(result.document.fieldSources.verificationHash).toBe("gemini");
  });

  it("valida e mescla uma resposta OpenAI", async () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    resetConfigCache();
    providerMocks.openAiCreate.mockResolvedValue({
      output_text: JSON.stringify(aiPayload),
    });
    const partial = buildSyntheticFixtureSet().reviewDocuments.find(
      (document) => document.fileName === "AUD_REVIEW_011.txt",
    )!;

    const result = await extractDocumentWithAi(partial);

    expect(result.provider).toBe("openai");
    expect(result.document.normalized.status).toBe("PAGO");
    expect(result.document.fieldSources.status).toBe("openai");
  });

  it("rejeita JSON malformado retornado pelo provedor", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    resetConfigCache();
    providerMocks.geminiGenerate.mockResolvedValue({ text: "não é json" });

    await expect(
      extractDocumentWithAi(buildSyntheticFixtureSet().reviewDocuments[10]!),
    ).rejects.toThrow(/malformed JSON/i);
  });
});
