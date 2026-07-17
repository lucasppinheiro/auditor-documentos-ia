import { NextResponse } from "next/server";

import {
  createApiRequestContext,
  finalizeApiSuccessResponse,
  toApiErrorResponse,
} from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestContext = createApiRequestContext(request, "/api/health");

  try {
    return finalizeApiSuccessResponse(
      NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      }),
      requestContext,
      {
        event: "health.check",
        details: { status: 200 },
      },
    );
  } catch (error) {
    return toApiErrorResponse(error, requestContext);
  }
}
