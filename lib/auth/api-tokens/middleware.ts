import { NextRequest } from "next/server";
import { authenticateAPIRequest } from "./index";

export interface AuthContext {
  type: "session" | "api_token" | "none";
  user_id?: string;
  scopes?: string[];
  api_token_id?: string;
  session_id?: string;
}

/**
 * Combined authentication that supports both session cookies and API tokens
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthContext> {
  // Try API token authentication first
  const apiAuth = await authenticateAPIRequest(request);
  if (apiAuth.valid && apiAuth.token) {
    return {
      type: "api_token",
      user_id: apiAuth.user_id || undefined,
      scopes: apiAuth.scopes,
      api_token_id: apiAuth.token.id,
    };
  }

  // TODO: Try JWT session token authentication (separate from regular auth session)

  return { type: "none" };
}

/**
 * Check if auth context has required scope
 */
export function hasRequiredScope(
  authContext: AuthContext,
  requiredScope: string
): boolean {
  if (authContext.type === "none") {
    return false;
  }

  // API token auth requires specific scopes
  if (authContext.type === "api_token") {
    return authContext.scopes?.includes(requiredScope) || false;
  }

  return false;
}

// ===============================
// MARK: API Route Helpers
// ===============================

/**
 * Extract auth context from middleware headers (for API routes)
 */
export function getAuthContextFromHeaders(request: NextRequest): AuthContext {
  const authType =
    (request.headers.get("x-auth-type") as AuthContext["type"]) || "none";
  const userId = request.headers.get("x-auth-user-id") || undefined;
  const scopesHeader = request.headers.get("x-auth-scopes");
  const scopes = scopesHeader ? scopesHeader.split(",") : undefined;

  return {
    type: authType,
    user_id: userId,
    scopes: scopes,
  };
}

/**
 * Require authentication for API route
 */
export async function requireAuth(request: NextRequest): Promise<AuthContext> {
  // First try to get from headers (if middleware already processed)
  const headerAuth = getAuthContextFromHeaders(request);
  if (headerAuth.type !== "none") {
    return headerAuth;
  }

  // Otherwise, authenticate directly
  const authContext = await authenticateRequest(request);
  if (authContext.type === "none") {
    throw new Error("Authentication required");
  }

  return authContext;
}

/**
 * Require specific scope for API route
 */
export async function requireScope(
  request: NextRequest,
  scope: string
): Promise<AuthContext> {
  const authContext = await requireAuth(request);

  if (!hasRequiredScope(authContext, scope)) {
    throw new Error(`Missing required scope: ${scope}`);
  }

  return authContext;
}

// ===============================
// MARK: Example Usage in API Routes
// ===============================

/*
export async function GET(request: NextRequest) {
  try {
    // Require any authentication
    const auth = await requireAuth(request);
    
    return Response.json({
      message: "Authenticated!",
      auth_type: auth.type,
      user_id: auth.user_id
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 401 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require specific scope
    const auth = await requireScope(request, "api:write");
    
    const data = await request.json();
    
    return Response.json({
      message: "Data processed",
      auth_type: auth.type,
      processed_by: auth.user_id
    });
  } catch (error) {
    const status = error.message.includes("scope") ? 403 : 401;
    return Response.json(
      { error: error.message },
      { status }
    );
  }
}
*/

// ===============================
// MARK: Route-Level Protection
// ===============================

/**
 * Create a route handler that requires specific authentication
 */
export function withAuth(
  handler: (
    request: NextRequest,
    authContext: AuthContext
  ) => Promise<Response>,
  options: {
    requireScope?: string;
    allowApiTokens?: boolean;
    allowSessions?: boolean;
  } = {}
) {
  return async (request: NextRequest): Promise<Response> => {
    try {
      const authContext = await requireAuth(request);

      // Check auth type restrictions
      if (
        options.allowApiTokens === false &&
        authContext.type === "api_token"
      ) {
        return Response.json(
          { error: "API tokens not allowed for this endpoint" },
          { status: 403 }
        );
      }

      if (options.allowSessions === false && authContext.type === "session") {
        return Response.json(
          { error: "Session auth not allowed for this endpoint" },
          { status: 403 }
        );
      }

      // Check scope if required
      if (
        options.requireScope &&
        !hasRequiredScope(authContext, options.requireScope)
      ) {
        return Response.json(
          { error: `Missing required scope: ${options.requireScope}` },
          { status: 403 }
        );
      }

      return await handler(request, authContext);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Authentication failed";
      return Response.json({ error: message }, { status: 401 });
    }
  };
}

/*
// Example usage:
export const GET = withAuth(
  async (request, auth) => {
    return Response.json({ message: "Hello!", user: auth.user_id });
  },
  { requireScope: "api:read" }
);

export const POST = withAuth(
  async (request, auth) => {
    const data = await request.json();
    return Response.json({ received: data, user: auth.user_id });
  },
  { requireScope: "api:write", allowApiTokens: true, allowSessions: false }
);
*/
