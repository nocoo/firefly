import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import {
  createHuman,
  getHumanByEmail,
  getHumanBySlug,
  listHumans,
} from "@/data/entities/human";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const db = getDb();
    const authors = await listHumans(db);
    return jsonResponse({ authors });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

interface CreateAuthorBody {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  email?: unknown;
  profile_public?: unknown;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as CreateAuthorBody;

    if (typeof body.name !== "string") {
      return errorResponse("name must be a string", 400);
    }
    if (typeof body.slug !== "string") {
      return errorResponse("slug must be a string", 400);
    }
    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return errorResponse("description must be a string or null", 400);
    }
    if (
      body.email !== undefined &&
      body.email !== null &&
      typeof body.email !== "string"
    ) {
      return errorResponse("email must be a string or null", 400);
    }
    if (
      body.profile_public !== undefined &&
      typeof body.profile_public !== "boolean" &&
      body.profile_public !== 0 &&
      body.profile_public !== 1
    ) {
      return errorResponse("profile_public must be a boolean", 400);
    }

    const name = body.name.trim();
    const slug = body.slug.trim();
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const email = typeof body.email === "string" ? body.email : null;
    const profilePublic =
      body.profile_public === true || body.profile_public === 1;

    if (!name) return errorResponse("name is required", 400);
    if (!slug) return errorResponse("slug is required", 400);

    const db = getDb();

    if (await getHumanBySlug(db, slug)) {
      return errorResponse("An author with this slug already exists", 400);
    }
    if (email && (await getHumanByEmail(db, email))) {
      return errorResponse("An author with this email already exists", 400);
    }

    const author = await createHuman(db, {
      name,
      slug,
      description,
      email,
      profilePublic,
    });

    return jsonResponse({ author }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return errorResponse("Author slug or email already in use", 400);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
