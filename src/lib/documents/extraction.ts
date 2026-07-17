import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { z } from "zod";

import { getAppConfig, type AiProvider, type AppConfig } from "@/lib/config";
import {
  deriveNotExtractedFields,
  EXTRACTED_FIELD_NAMES,
  type ExtractedFieldName,
  type FieldSource,
  type ParsedUploadedDocument,
  type RequiredFieldName,
} from "@/lib/documents/parser";

export const DOCUMENT_EXTRACTION_PROMPT_VERSION = "document-extractor-v2";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentType: { type: ["string", "null"] },
    documentNumber: { type: ["string", "null"] },
    issueDateIso: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    supplierName: { type: ["string", "null"] },
    supplierCnpjNormalized: { type: ["string", "null"], pattern: "^\\d{14}$" },
    serviceDescription: { type: ["string", "null"] },
    grossAmount: { type: ["number", "null"], minimum: 0 },
    paymentDateIso: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    invoiceIssueDateIso: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    approvedBy: { type: ["string", "null"] },
    destinationBank: { type: ["string", "null"] },
    status: {
      type: ["string", "null"],
      enum: ["PAGO", "CANCELADO", "PENDENTE", "ESTORNADO", null],
    },
    verificationHash: { type: ["string", "null"], pattern: "^AUD[0-9A-Za-z-]+$" },
    observation: { type: ["string", "null"] },
    notExtractedFields: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "TIPO_DOCUMENTO",
          "NUMERO_DOCUMENTO",
          "DATA_EMISSAO",
          "FORNECEDOR",
          "CNPJ_FORNECEDOR",
          "DESCRICAO_SERVICO",
          "VALOR_BRUTO",
          "DATA_PAGAMENTO",
          "DATA_EMISSAO_NF",
          "APROVADO_POR",
          "BANCO_DESTINO",
          "STATUS",
          "HASH_VERIFICACAO",
        ],
      },
    },
  },
  required: [
    "documentType",
    "documentNumber",
    "issueDateIso",
    "supplierName",
    "supplierCnpjNormalized",
    "serviceDescription",
    "grossAmount",
    "paymentDateIso",
    "invoiceIssueDateIso",
    "approvedBy",
    "destinationBank",
    "status",
    "verificationHash",
    "observation",
    "notExtractedFields",
  ],
} as const;

let openAiClient: OpenAI | null = null;
let geminiClient: GoogleGenAI | null = null;

const nullableText = z.string().trim().min(1).nullable();
const nullableIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const requiredFieldSchema = z.enum([
  "TIPO_DOCUMENTO",
  "NUMERO_DOCUMENTO",
  "DATA_EMISSAO",
  "FORNECEDOR",
  "CNPJ_FORNECEDOR",
  "DESCRICAO_SERVICO",
  "VALOR_BRUTO",
  "DATA_PAGAMENTO",
  "DATA_EMISSAO_NF",
  "APROVADO_POR",
  "BANCO_DESTINO",
  "STATUS",
  "HASH_VERIFICACAO",
]);

export const structuredDocumentExtractionSchema = z
  .object({
    documentType: nullableText,
    documentNumber: nullableText,
    issueDateIso: nullableIsoDate,
    supplierName: nullableText,
    supplierCnpjNormalized: z.string().regex(/^\d{14}$/).nullable(),
    serviceDescription: nullableText,
    grossAmount: z.number().finite().nonnegative().nullable(),
    paymentDateIso: nullableIsoDate,
    invoiceIssueDateIso: nullableIsoDate,
    approvedBy: nullableText,
    destinationBank: nullableText,
    status: z.enum(["PAGO", "CANCELADO", "PENDENTE", "ESTORNADO"]).nullable(),
    verificationHash: z.string().regex(/^AUD[0-9A-Za-z-]+$/).nullable(),
    observation: nullableText,
    notExtractedFields: z.array(requiredFieldSchema),
  })
  .strict();

export type StructuredDocumentExtraction = z.infer<
  typeof structuredDocumentExtractionSchema
>;

interface ExtractionResult {
  document: ParsedUploadedDocument;
  provider: Exclude<AiProvider, "auto">;
  modelId: string;
}

interface ResolvedExtractionProvider {
  provider: Exclude<AiProvider, "auto">;
  modelId: string;
}

export function shouldUseAiExtraction(
  document: ParsedUploadedDocument,
  options?: { forceAiExtraction?: boolean },
) {
  if (options?.forceAiExtraction) {
    return true;
  }

  if (document.status !== "parsed") {
    return true;
  }

  if (
    document.warningCodes.length > 0 ||
    document.missingFields.length > 0 ||
    document.invalidLines.length > 0
  ) {
    return true;
  }

  return [
    document.normalized.documentType,
    document.normalized.documentNumber,
    document.normalized.supplierName,
    document.normalized.supplierCnpjNormalized,
    document.normalized.grossAmount,
    document.normalized.issueDateIso,
    document.normalized.paymentDateIso,
    document.normalized.approvedBy,
    document.normalized.destinationBank,
    document.normalized.status,
    document.normalized.verificationHash,
  ].some((value) => value === null || value === undefined || value === "");
}

export async function extractDocumentWithAi(
  document: ParsedUploadedDocument,
): Promise<ExtractionResult> {
  const resolvedProvider = resolveExtractionProvider(getAppConfig());

  if (resolvedProvider.provider === "gemini") {
    const extracted = await extractDocumentWithGemini(document, resolvedProvider.modelId);
    return {
      document: mergeExtraction(document, extracted, "gemini"),
      provider: resolvedProvider.provider,
      modelId: resolvedProvider.modelId,
    };
  }

  const extracted = await extractDocumentWithOpenAi(document, resolvedProvider.modelId);

  return {
    document: mergeExtraction(document, extracted, "openai"),
    provider: resolvedProvider.provider,
    modelId: resolvedProvider.modelId,
  };
}

export function resolveExtractionProvider(
  config: Pick<
    AppConfig,
    "aiProvider" | "geminiApiKey" | "geminiModel" | "openAiApiKey" | "openAiModel"
  >,
): ResolvedExtractionProvider {
  if (config.aiProvider === "gemini") {
    assertProviderKey("GEMINI_API_KEY", config.geminiApiKey);
    return {
      provider: "gemini",
      modelId: config.geminiModel,
    };
  }

  if (config.aiProvider === "openai") {
    assertProviderKey("OPENAI_API_KEY", config.openAiApiKey);
    return {
      provider: "openai",
      modelId: config.openAiModel,
    };
  }

  if (config.geminiApiKey) {
    return {
      provider: "gemini",
      modelId: config.geminiModel,
    };
  }

  if (config.openAiApiKey) {
    return {
      provider: "openai",
      modelId: config.openAiModel,
    };
  }

  throw new Error("No AI provider is configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
}

async function extractDocumentWithGemini(
  document: ParsedUploadedDocument,
  modelId: string,
) {
  const client = getGeminiClient();

  const input = [
    "Extract the financial document into the schema.",
    "Use null for values you cannot confirm from the text.",
    "Do not invent values.",
    "Dates must be ISO YYYY-MM-DD when present.",
    "CNPJ must contain digits only.",
    "Gross amount must be a number without currency symbols.",
    "",
    "Parser hints:",
    JSON.stringify(document.normalized, null, 2),
    "",
    "Document text:",
    document.normalizedText,
  ].join("\n");

  const response = await withRetry(async () =>
    client.models.generateContent({
      model: modelId,
      contents: input,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: EXTRACTION_SCHEMA,
      },
    }),
  );

  const outputText = response.text;
  if (!outputText) {
    throw new Error("Gemini returned an empty extraction payload.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(outputText);
  } catch {
    throw new Error("Gemini returned malformed JSON in extraction payload.");
  }

  return structuredDocumentExtractionSchema.parse(payload);
}

async function extractDocumentWithOpenAi(
  document: ParsedUploadedDocument,
  modelId: string,
) {
  const client = getOpenAiClient();

  const input = [
    "Extract the financial document into the schema.",
    "Use null for values you cannot confirm from the text.",
    "Do not invent values.",
    "Dates must be ISO YYYY-MM-DD when present.",
    "CNPJ must contain digits only.",
    "Gross amount must be a number without currency symbols.",
    "",
    "Parser hints:",
    JSON.stringify(document.normalized, null, 2),
    "",
    "Document text:",
    document.normalizedText,
  ].join("\n");

  const response = await withRetry(async () =>
    client.responses.create({
      model: modelId,
      store: false,
      instructions:
        "You extract structured data from Brazilian financial documents and must return valid JSON matching the schema exactly.",
      input,
      text: {
        format: {
          type: "json_schema",
          name: "financial_document_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
    }),
  );

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error("OpenAI returned an empty extraction payload.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(outputText);
  } catch {
    throw new Error("OpenAI returned malformed JSON in extraction payload.");
  }

  return structuredDocumentExtractionSchema.parse(payload);
}

export function mergeExtraction(
  document: ParsedUploadedDocument,
  extracted: StructuredDocumentExtraction,
  provider: Extract<FieldSource, "gemini" | "openai">,
): ParsedUploadedDocument {
  const normalized = {
    ...document.normalized,
  };

  const fieldSources = { ...document.fieldSources };
  for (const field of EXTRACTED_FIELD_NAMES) {
    if (document.fieldSources[field] === "parser") {
      continue;
    }

    const extractedValue = extracted[field];
    if (extractedValue !== null && extractedValue !== undefined && extractedValue !== "") {
      assignExtractedValue(normalized, field, extractedValue);
      fieldSources[field] = provider;
    } else {
      fieldSources[field] = "unresolved";
    }
  }

  return {
    ...document,
    normalized,
    fieldSources,
    notExtractedFields: mergeNotExtractedFields(
      extracted.notExtractedFields,
      deriveNotExtractedFields(normalized),
    ),
  };
}

function assignExtractedValue(
  normalized: ParsedUploadedDocument["normalized"],
  field: ExtractedFieldName,
  value: string | number,
) {
  if (field === "grossAmount") {
    normalized.grossAmount = value as number;
    return;
  }

  normalized[field] = value as never;
}

function mergeNotExtractedFields(
  _aiReportedFields: string[],
  normalizedMissingFields: RequiredFieldName[],
): RequiredFieldName[] {
  return [...normalizedMissingFields];
}

function getOpenAiClient() {
  if (openAiClient) {
    return openAiClient;
  }

  const { openAiApiKey } = getAppConfig();
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openAiClient = new OpenAI({ apiKey: openAiApiKey });
  return openAiClient;
}

function getGeminiClient() {
  if (geminiClient) {
    return geminiClient;
  }

  const { geminiApiKey } = getAppConfig();
  assertProviderKey("GEMINI_API_KEY", geminiApiKey);

  geminiClient = new GoogleGenAI({ apiKey: geminiApiKey });
  return geminiClient;
}

function assertProviderKey(
  envName: "GEMINI_API_KEY" | "OPENAI_API_KEY",
  apiKey: string | null,
): asserts apiKey is string {
  if (!apiKey) {
    throw new Error(`${envName} is not configured.`);
  }
}

async function withRetry<T>(operation: () => Promise<T>) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!shouldRetry(error) || attempt === 3) {
        throw error;
      }

      const sleepMs = Math.round((350 + Math.random() * 200) * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  throw lastError;
}

function shouldRetry(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeStatus = "status" in error ? Number(error.status) : null;
  if (maybeStatus && [408, 409, 429, 500, 502, 503, 504].includes(maybeStatus)) {
    return true;
  }

  const maybeCode = "code" in error ? String(error.code) : "";
  return ["ETIMEDOUT", "ECONNRESET", "ECONNABORTED"].includes(maybeCode);
}
