import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { listPublicHumans } from "@/data/entities/human";
import { findPublicProfile, parseProfileQuery } from "@/lib/human-profile";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lookup = parseProfileQuery(
      searchParams.get("email"),
      searchParams.get("hash"),
    );

    if (lookup.kind === "none") {
      return jsonResponse({ name: null, avatar: null });
    }

    const db = getDb();
    const humans = await listPublicHumans(db);
    return jsonResponse(findPublicProfile(humans, lookup));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
