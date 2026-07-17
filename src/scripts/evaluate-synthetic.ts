import { analyzeDocuments } from "@/lib/documents/anomalies";
import { buildSyntheticFixtureSet } from "@/lib/demo/synthetic-dataset";

const fixtures = buildSyntheticFixtureSet();
const analysis = analyzeDocuments({
  historicalDocuments: fixtures.historicalDocuments,
  currentDocuments: fixtures.reviewDocuments,
});

const cases = analysis.documents.map((result) => {
  const actual = result.anomalies.map((anomaly) => anomaly.type).sort();
  const expected = [
    ...(fixtures.expectedAnomaliesByFile.get(result.fileName) ?? []),
  ].sort();

  return {
    fileName: result.fileName,
    expected,
    actual,
    passed: JSON.stringify(actual) === JSON.stringify(expected),
  };
});

const expectedTypes = new Set(
  Array.from(fixtures.expectedAnomaliesByFile.values()).flat(),
);
const passedCases = cases.filter((item) => item.passed).length;
const report = {
  generatedAt: new Date().toISOString(),
  dataset: {
    historicalDocuments: fixtures.historicalDocuments.length,
    reviewDocuments: fixtures.reviewDocuments.length,
    coveredRuleTypes: expectedTypes.size,
  },
  results: {
    passedCases,
    failedCases: cases.length - passedCases,
    exactMatchRate: passedCases / cases.length,
  },
  failedCases: cases.filter((item) => !item.passed),
};

console.log(JSON.stringify(report, null, 2));

if (passedCases !== cases.length || expectedTypes.size !== 13) {
  process.exitCode = 1;
}
