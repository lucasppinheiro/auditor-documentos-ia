import pLimit from "p-limit";

import { getAppConfig } from "@/lib/config";
import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";
import { finalizeSession, ingestDocumentForSession } from "@/lib/server/processing";
import { createProcessingSession } from "@/lib/server/sessions";
import { loadLocalEnv } from "@/scripts/load-local-env";

loadLocalEnv();

async function main() {
  const config = getAppConfig();
  if (config.appMode !== "interactive") {
    throw new Error("Set APP_MODE=interactive before seeding a local baseline.");
  }

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL must be configured before seeding a local baseline.");
  }

  const documents = buildSyntheticFixtureSet().historicalDocuments;
  const sessionId = await createProcessingSession({
    sourceType: "baseline_seed",
    label: "synthetic-baseline-seed",
  });
  const concurrency = Number(process.env.SEED_CONCURRENCY ?? "3");
  const limit = pLimit(concurrency);

  await Promise.all(
    documents.map((document) =>
      limit(() =>
        ingestDocumentForSession({
          sessionId,
          fileName: document.fileName,
          fileBytesBase64: Buffer.from(document.rawText, "utf8").toString("base64"),
        }),
      ),
    ),
  );

  const result = await finalizeSession(sessionId);
  console.log(
    JSON.stringify(
      {
        sessionId,
        processedFiles: result.session?.processedFiles,
        anomalyCount: result.session?.anomalyCount,
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
