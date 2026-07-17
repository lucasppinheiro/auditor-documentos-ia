import { NextResponse } from "next/server";

import { buildResultsWorkbookSheets } from "@/lib/documents/exports";
import { buildWorkbookBuffer } from "@/lib/documents/workbook";
import { buildSyntheticDemoData } from "@/lib/demo/synthetic-dataset";

export async function GET() {
  const workbook = await buildWorkbookBuffer(
    buildResultsWorkbookSheets(buildSyntheticDemoData().records),
  );

  return new NextResponse(workbook, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="demo-sintetica-results.xlsx"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
