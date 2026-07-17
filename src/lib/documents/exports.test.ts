import { describe, expect, it } from "vitest";

import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";
import {
  buildAuditRows,
  buildResultsRows,
  buildResultsWorkbookSheets,
} from "@/lib/documents/exports";

describe("exports", () => {
  it("gera resultados com anomalias e proveniência achatadas", () => {
    const demo = buildSyntheticDemoData();
    const record = demo.records.find((item) => item.anomalies.length > 0)!;
    const [row] = buildResultsRows([record]);

    expect(row).toMatchObject({
      fileName: record.document.fileName,
      anomalyCount: record.anomalies.length,
      promptVersion: "document-extractor-v2",
      extractionMethod: "parser-only",
      modelId: "parser",
    });
    expect(JSON.parse(row?.fieldSourcesJson ?? "{}")).toMatchObject({
      documentNumber: "parser",
    });
  });

  it("gera workbook com resultados e resumo de anomalias", () => {
    const sheets = buildResultsWorkbookSheets(buildSyntheticDemoData().records);

    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "results",
      "anomaly_summary",
    ]);
    expect(sheets[0]?.rows).toHaveLength(20);
    expect(sheets[1]?.rows.length).toBeGreaterThan(0);
  });

  it("gera um evento de processamento e um evento por regra", () => {
    const demo = buildSyntheticDemoData();
    const record = demo.records.find((item) => item.anomalies.length > 0)!;
    const rows = buildAuditRows([record]);

    expect(rows).toHaveLength(record.anomalies.length + 1);
    expect(rows[0]).toMatchObject({
      eventType: "PROCESSING_RESULT",
      fileName: record.document.fileName,
      modelId: "parser",
    });
    expect(JSON.parse(rows[0]?.evidenceJson ?? "{}")).toHaveProperty(
      "fieldSources",
    );
  });
});
