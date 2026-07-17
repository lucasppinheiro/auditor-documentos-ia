import { getAppConfig } from "@/lib/config";
import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";
import { extractDocumentWithAi } from "@/lib/documents/extraction";
import { loadLocalEnv } from "@/scripts/load-local-env";

loadLocalEnv();

async function main() {
  const config = getAppConfig();
  const hasProvider =
    (config.aiProvider === "gemini" && Boolean(config.geminiApiKey)) ||
    (config.aiProvider === "openai" && Boolean(config.openAiApiKey)) ||
    (config.aiProvider === "auto" &&
      Boolean(config.geminiApiKey || config.openAiApiKey));

  if (!hasProvider) {
    throw new Error(
      "Configure uma chave de provedor para executar a avaliação opcional de IA.",
    );
  }

  const targets = new Set([
    "AUD_REVIEW_011.txt",
    "AUD_REVIEW_012.txt",
    "AUD_REVIEW_017.txt",
  ]);
  const documents = buildSyntheticFixtureSet().reviewDocuments.filter((document) =>
    targets.has(document.fileName),
  );
  const results = [];

  for (const document of documents) {
    const result = await extractDocumentWithAi(document);
    results.push({
      fileName: document.fileName,
      provider: result.provider,
      modelId: result.modelId,
      unresolvedFields: result.document.notExtractedFields,
      fieldSources: result.document.fieldSources,
    });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        promptVersion: "document-extractor-v2",
        syntheticDocuments: results.length,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
