"use server";
import {
  createServiceClient,
  createUserContextClient,
} from "@/lib/supabase/server";
import type {
  User,
  SessionValidationResult,
  DeviceInfo,
  SessionDeletionResult,
} from "./types";
import { verifyPassword } from "./utils";
import { createUser } from "@/lib/db/users";
import {
  setSessionCookie,
  getSessionCookie,
  deleteSessionCookie,
} from "./actions";
import {
  createSession,
  validateSession,
  deleteSession,
  getUserSessions,
  deleteSessionById,
} from "@/lib/db/sessions";

// ===============================
// MARK: High-level auth functions
// ===============================

export async function signIn(
  email: string,
  password: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
): Promise<SessionValidationResult> {
  const supabase = createServiceClient();

  const { data: userWithPassword, error } = await supabase
    .from("users")
    .select("id, email, password_hash, name, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error("An unexpected error occurred");
  }
  if (!userWithPassword) {
    throw new Error("User not found");
  }

  const isValidPassword = await verifyPassword(
    password,
    userWithPassword.password_hash
  );
  if (!isValidPassword) {
    throw new Error("Invalid email or password");
  }

  const session = await createSession(
    userWithPassword.id,
    ipAddress,
    deviceInfo
  );
  await setSessionCookie(session.token, new Date(session.expires_at));

  const { password_hash, ...user } = userWithPassword;

  return { user, session };
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
): Promise<SessionValidationResult> {
  const user = await createUser(email, password, name);
  const session = await createSession(user.id, ipAddress, deviceInfo);
  await setSessionCookie(session.token, new Date(session.expires_at));

  return { user, session };
}

export async function signOut(): Promise<void> {
  const token = await getSessionCookie();
  if (token) {
    await deleteSession(token);
  }
  deleteSessionCookie();
}

// ===============================
// MARK: Convenience
// ===============================

export async function getCurrentSession(): Promise<SessionValidationResult> {
  const token = await getSessionCookie();
  if (!token) {
    return { user: null, session: null };
  }

  const result = await validateSession(token);

  // Update cookie if session was extended
  if (result.session?.fresh) {
    setSessionCookie(result.session.token, new Date(result.session.expires_at));
  }

  return result;
}

// Often you just need the user
export async function getCurrentUser(): Promise<User | null> {
  const { user } = await getCurrentSession();
  return user;
}

// Check if user is authenticated without full session data
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

// ================================
// MARK: Server-side helpers
// ================================

// For server components that require auth
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

// For optional auth in server components
export async function getOptionalAuth(): Promise<SessionValidationResult> {
  return await getCurrentSession();
}

// Get user context client in server components
export async function getUserContextClient() {
  const { user } = await getCurrentSession();

  if (!user) {
    throw new Error("User not authenticated");
  }

  return createUserContextClient(user.id, user.email);
}

// ================================
// MARK: Session Management
// ================================

// Delete a specific session, detecting if it's the current one
export async function deleteUserSession(
  sessionId: string
): Promise<SessionDeletionResult> {
  const { user, session } = await getCurrentSession();
  const currentSessionToken = session?.token;

  if (!user) {
    throw new Error("User not authenticated");
  }
  if (!currentSessionToken) {
    throw new Error("No current session detected");
  }

  // Get all user sessions to find the one being deleted
  const allSessions = await getUserSessions(user.id);
  const sessionToDelete = allSessions.find((s) => s.id === sessionId);

  if (!sessionToDelete) {
    throw new Error("Session to delete not found");
  }

  // Check if this is the current session
  const isDeletingCurrentSession =
    sessionToDelete.token === currentSessionToken;

  // Delete the session from database
  await deleteSessionById(sessionId, user.id);

  if (isDeletingCurrentSession) {
    // Clear the session cookie since we just deleted our own session
    await deleteSessionCookie();

    return {
      success: true,
      deletedCurrentSession: true,
      message: "Current session deleted - you will be logged out",
    };
  }

  return {
    success: true,
    deletedCurrentSession: false,
    message: "Session deleted successfully",
  };
}

// Delete a session by token, detecting if it's the current one
export async function deleteSessionByToken(
  tokenToDelete: string
): Promise<SessionDeletionResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const currentSessionToken = await getSessionCookie();
  const isDeletingCurrentSession = tokenToDelete === currentSessionToken;

  // Delete the session from database
  await deleteSession(tokenToDelete);

  if (isDeletingCurrentSession) {
    // Clear the session cookie since we just deleted our own session
    await deleteSessionCookie();

    return {
      success: true,
      deletedCurrentSession: true,
      message: "Current session deleted - you will be logged out",
    };
  }

  return {
    success: true,
    deletedCurrentSession: false,
    message: "Session deleted successfully",
  };
}
