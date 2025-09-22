import { createServiceClient } from "@/lib/supabase/server";
import { generateSessionToken, calculateSessionExpiry } from "@/lib/auth/utils";
import type {
  Session,
  SessionValidationResult,
  User,
  DeviceInfo,
} from "@/lib/auth/types";
import {
  SESSION_REFRESH_THRESHOLD,
  MAX_SESSIONS_PER_USER,
} from "@/lib/auth/types";

// MARK: createSession
export async function createSession(
  userId: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
): Promise<Session> {
  const supabase = createServiceClient();
  const token = generateSessionToken();
  const expiresAt = calculateSessionExpiry();

  // Before creating a new session, enforce the session limit
  await limitUserSessions(userId, MAX_SESSIONS_PER_USER - 1); // -1 because we're about to add one

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      ip_address: ipAddress,
      device_info: deviceInfo,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error("Failed to create session");
  }
  return data;
}

// MARK: validateSession
// Core session validation with automatic extension
export async function validateSession(
  token: string
): Promise<SessionValidationResult> {
  if (!token) {
    return { user: null, session: null };
  }

  const supabase = createServiceClient();
  const now = new Date();

  const { data, error } = await supabase
    .from("sessions")
    .select(
      `
        *,
        users (
          id,
          email,
          name,
          created_at,
          url_token
        )
      `
    )
    .eq("token", token)
    .single();

  if (error || !data) {
    return { user: null, session: null };
  }

  const session = { ...data, fresh: false };
  const user = data.users as User;
  const expiresAt = new Date(data.expires_at);

  // Check if session is expired
  if (now.getTime() >= expiresAt.getTime()) {
    await deleteSession(token);
    return { user: null, session: null };
  }

  // Auto-extend session if it's past the refresh threshold
  const timeUntilExpiration = expiresAt.getTime() - now.getTime();
  if (timeUntilExpiration < SESSION_REFRESH_THRESHOLD) {
    const newExpiresAt = calculateSessionExpiry();

    await supabase
      .from("sessions")
      .update({ expires_at: newExpiresAt.toISOString() })
      .eq("token", token);

    session.expires_at = newExpiresAt.toISOString();
    session.fresh = true;
  }

  return { user, session };
}

// MARK: deleteSession
export async function deleteSession(token: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("sessions").delete().eq("token", token);
}

// MARK: deleteSessionById
export async function deleteSessionById(
  sessionId: string,
  userId: string
): Promise<void> {
  const supabase = createServiceClient();

  // Only allow users to delete their own sessions
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) throw new Error("Failed to delete session");
}

// MARK: deleteAll
export async function deleteAllUserSessions(userId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("sessions").delete().eq("user_id", userId);
}

// MARK: extendSession
// Extend session expiration (used by middleware)
export async function extendSession(
  token: string,
  newExpiresAt: Date
): Promise<void> {
  try {
    const supabase = createServiceClient();

    await supabase
      .from("sessions")
      .update({
        expires_at: newExpiresAt.toISOString(),
      })
      .eq("token", token);
  } catch {
    // Don't throw - this is not critical for the request to continue
  }
}

// MARK: validateSessionToken
// Session validation for middleware context (lighter version)
export async function validateSessionToken(
  token: string
): Promise<{ user: User; session: Session } | null> {
  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("sessions")
      .select(
        `
          *,
          users (
            id,
            email,
            name,
            created_at,
            url_token
          )
        `
      )
      .eq("token", token)
      .single();

    if (error || !data || !data.users) {
      return null;
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);

    if (now.getTime() >= expiresAt.getTime()) {
      // Session expired - delete it
      await supabase.from("sessions").delete().eq("token", token);
      return null;
    }

    return {
      user: data.users as User,
      session: data,
    };
  } catch {
    return null;
  }
}

// MARK: getUserSessions
export async function getUserSessions(userId: string): Promise<Session[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Failed to fetch sessions");
  return data || [];
}

// MARK: limitUserSessions
export async function limitUserSessions(
  userId: string,
  maxSessions: number = MAX_SESSIONS_PER_USER
): Promise<void> {
  const supabase = createServiceClient();

  // Get current sessions, ordered by most recent activity
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("token, created_at")
    .eq("user_id", userId)
    .order("last_activity", { ascending: false });

  if (error || !sessions) return;

  // If user has too many sessions, delete the oldest ones
  if (sessions.length > maxSessions) {
    const sessionsToDelete = sessions.slice(maxSessions);
    const tokensToDelete = sessionsToDelete.map((session) => session.token);

    await supabase.from("sessions").delete().in("token", tokensToDelete);
  }
}

// MARK: getSessionDetails
// Get session info with device details for security/management purposes
export async function getSessionDetails(
  userId: string
): Promise<Array<Session & { is_current?: boolean }>> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .order("last_activity", { ascending: false });

  if (error) throw new Error("Failed to fetch session details");

  return (
    data?.map((session) => ({
      ...session,
      // You can add logic here to mark current session if needed
    })) || []
  );
}

// MARK: cleanupSessions
// Clean up expired sessions and inactive sessions
export async function cleanupSessions(): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date();

  // Delete expired sessions
  const { error: expiredError } = await supabase
    .from("sessions")
    .delete()
    .lt("expires_at", now.toISOString());

  if (expiredError) {
    console.error("Failed to cleanup expired sessions:", expiredError);
    return 0;
  }

  // Optionally delete sessions inactive for more than X days
  const inactiveThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days
  const { error: inactiveError } = await supabase
    .from("sessions")
    .delete()
    .lt("last_activity", inactiveThreshold.toISOString());

  if (inactiveError) {
    console.error("Failed to cleanup inactive sessions:", inactiveError);
  }

  // Return count would require a more complex query, for now return 0
  return 0;
}

// MARK: updateSessionDevice

interface UpdateSessionDeviceOptions {
  ip_address?: string;
  device_info?: DeviceInfo;
}
// Update session with new device info (useful for security updates)
export async function updateSessionDevice(
  token: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
): Promise<void> {
  const supabase = createServiceClient();

  const updates: UpdateSessionDeviceOptions = {};

  if (ipAddress) updates.ip_address = ipAddress;
  if (deviceInfo) updates.device_info = deviceInfo;

  await supabase.from("sessions").update(updates).eq("token", token);
}
