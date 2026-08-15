import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import {
  deleteHuman,
  getHumanByEmail,
  getHumanById,
  getHumanBySlug,
  updateHuman,
} from "@/data/entities/human";
import { updateDefaultHumanId } from "@/data/settings";
import type { UpdateHumanInput } from "@/data/entities/human";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const author = await getHumanById(db, id);
    if (!author) return notFoundResponse("Author");
    return jsonResponse({ author });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

interface UpdateAuthorBody {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
  email?: unknown;
  profile_public?: unknown;
  is_default?: unknown;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateAuthorBody;
    const db = getDb();

    const existing = await getHumanById(db, id);
    if (!existing) return notFoundResponse("Author");

    if (body.name !== undefined && typeof body.name !== "string") {
      return errorResponse("name must be a string", 400);
    }
    if (body.slug !== undefined && typeof body.slug !== "string") {
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
    if (body.is_default !== undefined && typeof body.is_default !== "boolean") {
      return errorResponse("is_default must be a boolean", 400);
    }

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
    const description =
      body.description === undefined
        ? undefined
        : body.description === null
          ? null
          : body.description.trim();
    const email =
      body.email === undefined
        ? undefined
        : body.email === null
          ? null
          : body.email;

    if (name !== undefined && name === "") {
      return errorResponse("name cannot be empty", 400);
    }
    if (slug !== undefined && slug === "") {
      return errorResponse("slug cannot be empty", 400);
    }

    if (slug !== undefined && slug !== existing.slug) {
      const conflicting = await getHumanBySlug(db, slug);
      if (conflicting) {
        return errorResponse("An author with this slug already exists", 400);
      }
    }
    if (email) {
      const conflicting = await getHumanByEmail(db, email);
      if (conflicting && conflicting.id !== id) {
        return errorResponse("An author with this email already exists", 400);
      }
    }

    const updateInput: UpdateHumanInput = {};
    if (name !== undefined) updateInput.name = name;
    if (slug !== undefined) updateInput.slug = slug;
    if (description !== undefined) updateInput.description = description;
    if (email !== undefined) updateInput.email = email;
    if (body.profile_public !== undefined) {
      updateInput.profilePublic =
        body.profile_public === true || body.profile_public === 1;
    }

    const updated = await updateHuman(db, id, updateInput);
    if (!updated) return notFoundResponse("Author");

    if (body.is_default === true) {
      await updateDefaultHumanId(db, id);
    }

    return jsonResponse({ author: updated });
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
      return errorResponse("Author slug or email already in use", 400);
    }
    if (error instanceof Error && error.message === "Default human not found") {
      return errorResponse(error.message, 400);
    }
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const result = await deleteHuman(db, id);

    if (!result.success) {
      if (result.reason === "not_found") return notFoundResponse("Author");
      if (result.reason === "has_posts") {
        return errorResponse(
          `Cannot delete author: ${result.postCount} post(s) still reference this author.`,
          409,
        );
      }
      if (result.reason === "is_default") {
        return errorResponse("Cannot delete the default author", 409);
      }
      if (result.reason === "last_human") {
        return errorResponse("Cannot delete the last author", 409);
      }
      return notFoundResponse("Author");
    }

    return jsonResponse({ success: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
