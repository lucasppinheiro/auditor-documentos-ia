import { describe, expect, it } from "vitest";

import { analyzeDocuments, buildReferenceProfile } from "@/lib/documents/anomalies";
import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";

describe("buildReferenceProfile", () => {
  it("constrói uma referência com 40 documentos e cinco fornecedores fictícios", () => {
    const fixtures = buildSyntheticFixtureSet();
    const profile = buildReferenceProfile(fixtures.historicalDocuments);

    expect(fixtures.historicalDocuments).toHaveLength(40);
    expect(profile.suppliers).toHaveLength(5);
    expect(profile.knownApprovers).toEqual(
      new Set(["Aline Rocha", "Bruno Tavares", "Carla Nunes"]),
    );
  });
});

describe("analyzeDocuments", () => {
  it("produz exatamente o gabarito de anomalias do corpus sintético", () => {
    const fixtures = buildSyntheticFixtureSet();
    const analysis = analyzeDocuments({
      historicalDocuments: fixtures.historicalDocuments,
      currentDocuments: fixtures.reviewDocuments,
    });

    expect(fixtures.reviewDocuments).toHaveLength(20);

    for (const result of analysis.documents) {
      const actual = result.anomalies.map((anomaly) => anomaly.type).sort();
      const expected = [
        ...(fixtures.expectedAnomaliesByFile.get(result.fileName) ?? []),
      ].sort();
      expect(actual, result.fileName).toEqual(expected);
    }
  });

  it("registra os arquivos históricos usados como evidência de duplicidade", () => {
    const fixtures = buildSyntheticFixtureSet();
    const analysis = analyzeDocuments({
      historicalDocuments: fixtures.historicalDocuments,
      currentDocuments: fixtures.reviewDocuments,
    });
    const duplicate = analysis.documents
      .find((document) => document.fileName === "AUD_REVIEW_006.txt")
      ?.anomalies.find((anomaly) => anomaly.type === "DUPLICATE_DOCUMENT");

    expect(duplicate?.evidence.relatedHistoricalFiles).toEqual(["AUD_BASE_001.txt"]);
    expect(duplicate?.confidence).toBe("HIGH");
  });

  it("não marca como duplicado o mesmo arquivo e hash já presentes na referência", () => {
    const fixtures = buildSyntheticFixtureSet();
    const historical = fixtures.historicalDocuments[0]!;
    const analysis = analyzeDocuments({
      historicalDocuments: [historical],
      currentDocuments: [historical],
    });

    expect(analysis.documents[0]?.anomalies).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "DUPLICATE_DOCUMENT" })]),
    );
  });
});
