import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import {
  createAPIToken as dbCreateAPIToken,
  updateTokenLastUsed,
  getUserAPITokens,
  revokeAPIToken as dbRevokeAPIToken,
  deleteAPIToken as dbDeleteAPIToken,
  updateAPIToken as dbUpdateAPIToken,
  type APIToken,
  type UpdateAPITokenData,
  getAPITokenById,
  getTokensByPrefix,
} from "@/lib/db/api-tokens";
import {
  encryptToken,
  decryptToken,
  type EncryptedTokenData,
  isValidEncryptedData,
} from "./token-encryption";

// ===============================
// MARK: Types & Constants
// ===============================

export interface APITokenValidationResult {
  valid: boolean;
  token?: APIToken;
  user_id?: string | null;
  scopes?: string[];
  error?: string;
}

export interface CreateTokenRequest {
  name: string;
  scopes: string[];
  user_id?: string | null;
  expires_in_days?: number;
}

export interface CreateTokenResponse {
  token: string; // The actual token to give to user (only shown once)
  tokenData: APIToken; // The database record
}

export interface TokenWithDecryptedData {
  tokenData: APIToken;
  decrypted_token?: string;
  can_decrypt: boolean;
  encryption_status: "encrypted" | "invalid" | "error";
}

// Available scopes (basic set for now)
export const AVAILABLE_SCOPES = [
  "api:read",
  "api:write",
  "events:read",
  "events:write",
  "users:read",
  "users:write",
  "profile:read",
  "profile:write",
  "admin:manage",
] as const;

export type AvailableScope = (typeof AVAILABLE_SCOPES)[number];

// Token configuration
const TOKEN_PREFIX = "cx";
const TOKEN_RANDOM_BYTES = 32; // 64 hex characters
const TOKEN_TIMESTAMP_LENGTH = 8; // Base36 timestamp

// ===============================
// MARK: Token Generation
// ===============================

export function generateAPIToken(): string {
  // Generate timestamp part (base36 for compactness)
  const timestamp = Math.floor(Date.now() / 1000)
    .toString(36)
    .padStart(TOKEN_TIMESTAMP_LENGTH, "0");

  // Generate random part (hex)
  const randomArray = new Uint8Array(TOKEN_RANDOM_BYTES);
  crypto.getRandomValues(randomArray);
  const randomPart = Array.from(randomArray, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return `${TOKEN_PREFIX}_${timestamp}${randomPart}`;
}

export async function hashToken(token: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(token, saltRounds);
}

export async function verifyToken(
  token: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(token, hash);
}

export function extractTokenPrefix(token: string): string {
  // Extract the visible prefix part (e.g., "cx_01h8xk2j")
  const parts = token.split("_");
  if (parts.length >= 2) {
    return `${parts[0]}_${parts[1].substring(0, TOKEN_TIMESTAMP_LENGTH)}`;
  }
  return token.substring(0, 20); // Fallback
}

// ===============================
// MARK: Token Management
// ===============================

export async function createAPIToken(
  request: CreateTokenRequest
): Promise<CreateTokenResponse> {
  // Validate scopes
  const invalidScopes = request.scopes.filter(
    (scope) => !AVAILABLE_SCOPES.includes(scope as AvailableScope)
  );

  if (invalidScopes.length > 0) {
    throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`);
  }

  if (request.scopes.length === 0) {
    throw new Error("At least one scope is required");
  }

  // Generate token
  const token = generateAPIToken();
  const tokenHash = await hashToken(token);
  const prefix = extractTokenPrefix(token);

  // Calculate expiration
  let expires_at: string | null = null;
  if (request.expires_in_days && request.expires_in_days > 0) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + request.expires_in_days);
    expires_at = expirationDate.toISOString();
  }

  // Always encrypt the token
  let token_encrypted: EncryptedTokenData;
  try {
    token_encrypted = encryptToken(token);
    console.log(
      `[API-TOKEN] Created encrypted token ${prefix} for user ${
        request.user_id || "system"
      }`
    );
  } catch (error) {
    console.error(`[API-TOKEN] Failed to encrypt token ${prefix}:`, error);
    throw new Error("Failed to encrypt token - check encryption configuration");
  }

  // Create database record
  const tokenData = await dbCreateAPIToken({
    token_hash: tokenHash,
    prefix: prefix,
    name: request.name,
    scopes: request.scopes,
    user_id: request.user_id || null,
    expires_at: expires_at,
    token_encrypted: token_encrypted,
    allow_viewing: true, // Always true in this system
  });

  console.log(
    `[API-TOKEN] Created token ${prefix} for user ${
      request.user_id || "system"
    } with scopes: ${request.scopes.join(", ")}`
  );

  return {
    token, // Raw token (only shown once)
    tokenData, // Database record
  };
}

// ===============================
// MARK: Token Validation
// ===============================

export async function validateAPIToken(
  token: string
): Promise<APITokenValidationResult> {
  if (!token) {
    return { valid: false, error: "No token provided" };
  }

  // Basic format check
  if (!token.startsWith(`${TOKEN_PREFIX}_`)) {
    return { valid: false, error: "Invalid token format" };
  }

  try {
    const prefix = extractTokenPrefix(token);
    const candidateTokens = await getTokensByPrefix(prefix);
    if (!candidateTokens || candidateTokens.length === 0) {
      return { valid: false, error: "Invalid token" };
    }

    // Check each candidate token with bcrypt.compare
    for (const tokenData of candidateTokens) {
      // Check if token is revoked
      if (tokenData.revoked_at) {
        continue; // Skip revoked tokens
      }

      // Check if token is expired
      if (
        tokenData.expires_at &&
        new Date(tokenData.expires_at) <= new Date()
      ) {
        continue; // Skip expired tokens
      }

      // Verify token hash
      const isValid = await verifyToken(token, tokenData.token_hash);
      if (isValid) {
        updateTokenLastUsed(tokenData.token_hash).catch(console.error);

        return {
          valid: true,
          token: tokenData,
          user_id: tokenData.user_id,
          scopes: tokenData.scopes,
        };
      }
    }

    return { valid: false, error: "Invalid token" };
  } catch (error) {
    console.error("[API-TOKEN] Validation error:", error);
    return { valid: false, error: "Token validation failed" };
  }
}

// ===============================
// MARK: Viewing & Decryption
// ===============================

export async function getTokenWithDecryption(
  tokenId: string,
  requestingUserId: string
): Promise<TokenWithDecryptedData | null> {
  const tokenData = await getAPITokenById(tokenId);

  if (!tokenData) {
    return null;
  }

  const result: TokenWithDecryptedData = {
    tokenData,
    can_decrypt: false,
    encryption_status: "encrypted",
  };

  // Validate encrypted data structure
  if (!isValidEncryptedData(tokenData.token_encrypted)) {
    result.encryption_status = "invalid";
    console.error(
      `[API-TOKEN] Invalid encrypted data for token ${tokenData.id}`
    );
    return result;
  }

  // Attempt decryption
  try {
    const decrypted = decryptToken(tokenData.token_encrypted);
    result.decrypted_token = decrypted;
    result.can_decrypt = true;
    result.encryption_status = "encrypted";

    console.log(
      `[API-TOKEN] Successfully decrypted token ${tokenData.prefix} for user ${
        requestingUserId || "system"
      }`
    );
  } catch (error) {
    result.encryption_status = "error";
    console.error(
      `[API-TOKEN] Failed to decrypt token ${tokenData.id}:`,
      error
    );
  }

  return result;
}

export async function viewToken(
  tokenId: string,
  requestingUserId: string
): Promise<{ token: string; tokenData: APIToken }> {
  const tokenWithDecryption = await getTokenWithDecryption(
    tokenId,
    requestingUserId
  );

  if (!tokenWithDecryption) {
    throw new Error("Token not found");
  }

  // Simple ownership check - users can only view their own tokens
  if (
    tokenWithDecryption.tokenData.user_id &&
    tokenWithDecryption.tokenData.user_id !== requestingUserId
  ) {
    throw new Error("Access denied - you can only view your own tokens");
  }

  if (!tokenWithDecryption.can_decrypt) {
    const reason =
      tokenWithDecryption.encryption_status === "invalid"
        ? "Token encryption data is corrupted"
        : "Failed to decrypt token";
    throw new Error(`Cannot view token: ${reason}`);
  }

  console.log(
    `[API-TOKEN] User ${requestingUserId} viewed token ${tokenId} (${tokenWithDecryption.tokenData.name})`
  );

  return {
    token: tokenWithDecryption.decrypted_token!,
    tokenData: tokenWithDecryption.tokenData,
  };
}

// ===============================
// MARK: Scope Validation
// ===============================

export function hasScope(userScopes: string[], requiredScope: string): boolean {
  return userScopes.includes(requiredScope);
}

export function hasAnyScope(
  userScopes: string[],
  requiredScopes: string[]
): boolean {
  return requiredScopes.some((scope) => userScopes.includes(scope));
}

export function hasAllScopes(
  userScopes: string[],
  requiredScopes: string[]
): boolean {
  return requiredScopes.every((scope) => userScopes.includes(scope));
}

// ===============================
// MARK: Request Authentication
// ===============================

export function extractTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2) {
      const [scheme, token] = parts;
      if (scheme.toLowerCase() === "bearer") {
        return token;
      }
    }
  }

  // Check X-API-Key header as fallback
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

export async function authenticateAPIRequest(
  request: NextRequest
): Promise<APITokenValidationResult> {
  const token = extractTokenFromRequest(request);
  if (!token) {
    return { valid: false, error: "No API token provided" };
  }

  return await validateAPIToken(token);
}

// ===============================
// MARK: Middleware Helper
// ===============================

export function requireScopes(...requiredScopes: string[]) {
  return async (request: NextRequest): Promise<APITokenValidationResult> => {
    const authResult = await authenticateAPIRequest(request);

    if (!authResult.valid) {
      return authResult;
    }

    if (!authResult.scopes) {
      return { valid: false, error: "No scopes found for token" };
    }

    const hasRequired = hasAllScopes(authResult.scopes, requiredScopes);
    if (!hasRequired) {
      return {
        valid: false,
        error: `Missing required scopes: ${requiredScopes.join(", ")}`,
      };
    }

    return authResult;
  };
}

// ===============================
// MARK: User Token Management
// ===============================

export async function getUserTokens(
  userId: string,
  email: string,
  includeRevoked: boolean = false
): Promise<APIToken[]> {
  return await getUserAPITokens(userId, email, includeRevoked);
}

export async function revokeToken(
  tokenId: string,
  userId?: string,
  email?: string
): Promise<APIToken> {
  return await dbRevokeAPIToken(tokenId, userId, email);
}

export async function deleteToken(
  tokenId: string,
  userId?: string,
  email?: string
): Promise<void> {
  return await dbDeleteAPIToken(tokenId, userId, email);
}

export async function updateToken(
  tokenId: string,
  updates: Omit<UpdateAPITokenData, "last_used_at" | "revoked_at">,
  userId?: string,
  email?: string
): Promise<APIToken> {
  // Validate scopes if provided
  if (updates.scopes) {
    const invalidScopes = updates.scopes.filter(
      (scope) => !AVAILABLE_SCOPES.includes(scope as AvailableScope)
    );

    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes: ${invalidScopes.join(", ")}`);
    }
  }

  return await dbUpdateAPIToken(tokenId, updates, userId, email);
}

// ===============================
// MARK: Utility Functions
// ===============================

export function isTokenExpired(token: APIToken): boolean {
  if (!token.expires_at) return false;
  return new Date(token.expires_at) <= new Date();
}

export function isTokenRevoked(token: APIToken): boolean {
  return !!token.revoked_at;
}

export function isTokenActive(token: APIToken): boolean {
  return !isTokenExpired(token) && !isTokenRevoked(token);
}

export function isSystemToken(token: APIToken): boolean {
  return token.user_id === null;
}

export function getTokenStatus(
  token: APIToken
): "active" | "expired" | "revoked" {
  if (isTokenRevoked(token)) return "revoked";
  if (isTokenExpired(token)) return "expired";
  return "active";
}

export function getTokenDisplayInfo(token: APIToken): {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  status: "active" | "expired" | "revoked";
  is_system_token: boolean;
  can_view: boolean;
  encryption_status: "encrypted" | "invalid";
} {
  const encryption_status = isValidEncryptedData(token.token_encrypted)
    ? "encrypted"
    : "invalid";

  return {
    id: token.id,
    name: token.name,
    prefix: token.prefix,
    scopes: token.scopes,
    created_at: token.created_at,
    expires_at: token.expires_at,
    last_used_at: token.last_used_at,
    status: getTokenStatus(token),
    is_system_token: isSystemToken(token),
    can_view: token.allow_viewing && encryption_status === "encrypted",
    encryption_status,
  };
}
