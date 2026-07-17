import { NextResponse } from "next/server";

import { AUDIT_COLUMN_LABELS, buildAuditRows } from "@/lib/documents/exports";
import { buildWorkbookBuffer } from "@/lib/documents/workbook";
import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";

export async function GET() {
  const rows = buildAuditRows(buildSyntheticDemoData().records);
  const workbook = await buildWorkbookBuffer([
    { name: "audit", rows, columnLabels: AUDIT_COLUMN_LABELS },
  ]);

  return new NextResponse(workbook, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="demo-sintetica-audit.xlsx"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
