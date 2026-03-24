import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse } from "@/lib/api";
import { createMcpClient } from "@/data/mcp-clients";
import { isLoopbackRedirectUri } from "@/lib/mcp/oauth";

interface RegisterRequest {
  client_name?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;

    // Validate client_name
    if (!body.client_name || typeof body.client_name !== "string") {
      return errorResponse("client_name is required");
    }
    if (body.client_name.length > 255) {
      return errorResponse("client_name must be 255 characters or less");
    }

    // Validate redirect_uris
    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return errorResponse("redirect_uris must be a non-empty array");
    }
    for (const uri of body.redirect_uris) {
      if (!isLoopbackRedirectUri(uri)) {
        return errorResponse(
          `Invalid redirect_uri: ${uri}. Only loopback addresses (localhost, 127.0.0.1, [::1]) are allowed`,
        );
      }
    }

    const db = getDb();
    const client = await createMcpClient(db, {
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types ?? ["authorization_code"],
    });

    return jsonResponse(
      {
        client_id: client.client_id,
        client_name: client.client_name,
        redirect_uris: JSON.parse(client.redirect_uris),
        grant_types: JSON.parse(client.grant_types),
        token_endpoint_auth_method: "none",
      },
      201,
    );
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Internal server error",
      500,
    );
  }
}
