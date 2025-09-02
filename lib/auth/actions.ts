"use server";

import { deleteUserSession, signOut } from ".";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn, signUp, getCurrentUser } from "@/lib/auth";
import {
  DeviceInfo,
  SESSION_COOKIE_NAME,
  SessionDeletionResult,
} from "@/lib/auth/types";
import { getUserSessions } from "../db/sessions";
import { calculateSessionExpiry } from "./utils";

export async function loginAction(
  email: string,
  password: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  try {
    const { user, session } = await signIn(
      email,
      password,
      ipAddress,
      deviceInfo
    );

    return user;
    // redirect(`/protected/${user?.id}`);
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function signUpAction(
  name: string,
  email: string,
  password: string,
  ipAddress?: string,
  deviceInfo?: DeviceInfo
) {
  if (!email || !password || !name) {
    throw new Error("All fields are required");
  }

  try {
    const { user, session } = await signUp(
      email,
      password,
      name,
      ipAddress,
      deviceInfo
    );

    // redirect(`/protected/${user?.id}`);
    return user;
  } catch (error) {
    console.error("Sign up error:", error);
    throw error;
  }
}

export async function signOutAction() {
  try {
    // signOut function handles:
    // 1. Getting session cookie
    // 2. Deleting session from databse
    // 3. Clearing session cookie
    await signOut();
  } catch (error) {
    console.error("Sign out action error:", error);
    throw error;
  }

  // Clear the cookie manually as fallback
  deleteSessionCookie();
}

// ================================
// MARK: Cookie
// ================================

export async function setSessionCookie(
  token: string,
  expiresAt?: Date
): Promise<void> {
  const cookieStore = await cookies();
  const expires = expiresAt || calculateSessionExpiry();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function getSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", { expires: new Date(0) });
}

// Get current user's sessions
export async function getSessionsAction() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated");
    }

    const sessions = await getUserSessions(user.id);
    return sessions;
  } catch (error) {
    console.error("getSessionsAction error:", error);
    throw error;
  }
}

export async function deleteSessionAction(
  sessionId: string
): Promise<SessionDeletionResult> {
  let deletedCurrentSession: boolean = false;

  try {
    const deletionResult = await deleteUserSession(sessionId);

    if (deletionResult?.deletedCurrentSession) {
      deletedCurrentSession = true;
    }

    return {
      success: true,
      message: deletionResult?.message ?? "",
      deletedCurrentSession: deletionResult?.deletedCurrentSession ?? false,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete session",
    };
  } finally {
    // If current session was deleted, redirect to login
    if (deletedCurrentSession) {
      redirect("/auth/login");
    }
  }
}
