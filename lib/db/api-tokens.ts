import {
  createServiceClient,
  createUserContextClient,
} from "@/lib/supabase/server";
import type { EncryptedTokenData } from "@/lib/auth/api-tokens/token-encryption";

export interface APIToken {
  id: string;
  token_hash: string;
  prefix: string;
  name: string;
  scopes: string[];
  user_id: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
  token_encrypted: EncryptedTokenData;
  allow_viewing: boolean;
}

export interface CreateAPITokenData {
  token_hash: string;
  prefix: string;
  name: string;
  scopes: string[];
  user_id?: string | null;
  expires_at?: string | null;
  token_encrypted: EncryptedTokenData;
  allow_viewing?: boolean;
}

export interface UpdateAPITokenData {
  name?: string;
  scopes?: string[];
  expires_at?: string | null;
  last_used_at?: string;
  revoked_at?: string;
  token_encrypted?: EncryptedTokenData | null;
  allow_viewing?: boolean;
}

// MARK: Create Token
export async function createAPIToken(
  data: CreateAPITokenData
): Promise<APIToken> {
  const supabase = createServiceClient();

  const { data: token, error } = await supabase
    .from("api_tokens")
    .insert({
      token_hash: data.token_hash,
      prefix: data.prefix,
      name: data.name,
      scopes: data.scopes,
      user_id: data.user_id || null,
      expires_at: data.expires_at || null,
      token_encrypted: data.token_encrypted,
      allow_viewing: data.allow_viewing !== false, // Default to true
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Token with this hash already exists");
    }
    console.error("Failed to create API token:", error);
    throw new Error("Failed to create API token");
  }

  return token;
}

// MARK: Get Token by ID
export async function getAPITokenById(
  tokenId: string
): Promise<APIToken | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getTokensByPrefix(prefix: string): Promise<APIToken[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .eq("prefix", prefix)
    .is("revoked_at", null) // Only active tokens
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch API tokens by prefix:", error);
    return [];
  }
  return data || [];
}

// MARK: Get User's Tokens
export async function getUserAPITokens(
  userId: string,
  email: string,
  includeRevoked: boolean = false
): Promise<APIToken[]> {
  const userClient = createUserContextClient(userId, email);

  let query = userClient
    .from("api_tokens")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!includeRevoked) {
    query = query.is("revoked_at", null);
  }

  const { data, error } = await query;

  if (error) throw new Error("Failed to fetch API tokens");
  return data || [];
}

// MARK: Update Token
export async function updateAPIToken(
  tokenId: string,
  updates: UpdateAPITokenData,
  userId?: string,
  email?: string
): Promise<APIToken> {
  // Use user context if provided, otherwise use service client
  const client =
    userId && email
      ? createUserContextClient(userId, email)
      : createServiceClient();

  const { data, error } = await client
    .from("api_tokens")
    .update(updates)
    .eq("id", tokenId)
    .select("*")
    .single();

  if (error) throw new Error("Failed to update API token");
  return data;
}

// MARK: Update Last Used
export async function updateTokenLastUsed(tokenHash: string): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  if (error) {
    console.error("Failed to update token last used:", error);
    // Don't throw - this is not critical for request to continue
  }
}

// MARK: Revoke Token
export async function revokeAPIToken(
  tokenId: string,
  userId?: string,
  email?: string
): Promise<APIToken> {
  const client =
    userId && email
      ? createUserContextClient(userId, email)
      : createServiceClient();

  const { data, error } = await client
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .select("*")
    .single();

  if (error) throw new Error("Failed to revoke API token");
  return data;
}

// MARK: Delete Token (Hard Delete)
export async function deleteAPIToken(
  tokenId: string,
  userId?: string,
  email?: string
): Promise<void> {
  const client =
    userId && email
      ? createUserContextClient(userId, email)
      : createServiceClient();

  const { error } = await client.from("api_tokens").delete().eq("id", tokenId);

  if (error) {
    // Check specific error codes
    if (error.code === "PGRST116" || error.code === "42501") {
      throw new Error("Unauthorized to delete this token");
    }
    if (error.code === "23503") {
      throw new Error("Cannot delete token: still in use");
    }
    if (error.code === "22P02") {
      throw new Error("Invalid token ID format");
    }

    // throw new Error("Failed to delete API token");
    throw new Error(`Database error: ${error.message}`);
  }
}

// MARK: Cleanup Expired/Revoked Tokens
export async function cleanupAPITokens(): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  // Delete tokens that have been revoked for more than 30 days
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: revokedError } = await supabase
    .from("api_tokens")
    .delete()
    .not("revoked_at", "is", null)
    .lt("revoked_at", thirtyDaysAgo);

  if (revokedError) {
    console.error("Failed to cleanup revoked tokens:", revokedError);
  }

  // Delete expired tokens
  const { error: expiredError } = await supabase
    .from("api_tokens")
    .delete()
    .not("expires_at", "is", null)
    .lt("expires_at", now);

  if (expiredError) {
    console.error("Failed to cleanup expired tokens:", expiredError);
  }

  // For now, return 0 (would need a more complex query to get actual count)
  return 0;
}

// MARK: Get Token Statistics
export async function getAPITokenStats(
  userId?: string,
  email?: string
): Promise<{
  total: number;
  active: number;
  expired: number;
  revoked: number;
}> {
  const client =
    userId && email
      ? createUserContextClient(userId, email)
      : createServiceClient();

  let query = client.from("api_tokens").select("*");

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) throw new Error("Failed to fetch token statistics");

  const now = new Date();
  const tokens = data || [];

  const stats = {
    total: tokens.length,
    active: 0,
    expired: 0,
    revoked: 0,
  };

  tokens.forEach((token) => {
    if (token.revoked_at) {
      stats.revoked++;
    } else if (token.expires_at && new Date(token.expires_at) <= now) {
      stats.expired++;
    } else {
      stats.active++;
    }
  });

  return stats;
}

// MARK: Find Tokens by Scope
export async function getTokensByScope(
  scope: string,
  userId?: string
): Promise<APIToken[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("api_tokens")
    .select("*")
    .contains("scopes", [scope])
    .is("revoked_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) throw new Error("Failed to find tokens by scope");
  return data || [];
}

// MARK: Find Tokens By Name
export async function findTokensByName(
  searchTerm: string,
  userId?: string
): Promise<APIToken[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("api_tokens")
    .select("*")
    .ilike("name", `%${searchTerm}%`)
    .is("revoked_at", null);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;

  if (error) throw new Error("Failed to find tokens by name");
  return data || [];
}

// MARK: Get System Tokens
export async function getSystemTokens(): Promise<APIToken[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("api_tokens")
    .select("*")
    .is("user_id", null)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to fetch system tokens");
  return data || [];
}
