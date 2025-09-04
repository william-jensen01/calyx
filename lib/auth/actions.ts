"use server";

import { deleteUserSession, signOut } from ".";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { signIn, signUp, getCurrentUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME, SessionDeletionResult } from "@/lib/auth/types";
import { getUserSessions } from "../db/sessions";
import { calculateSessionExpiry, getDeviceInfoFromHeaders } from "./utils";

export async function loginAction(
  prevState: {
    error?: string;
    success?: boolean;
    redirect?: string;
  },
  formData: FormData
) {
  let email, password;
  try {
    email = formData.get("email") as string;
    password = formData.get("password") as string;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Login failed",
      success: false,
    };
  }

  const { ipAddress, deviceInfo } = await getDeviceInfoFromHeaders();

  try {
    const { user, session } = await signIn(
      email,
      password,
      ipAddress,
      deviceInfo
    );

    return { error: "", success: true, redirect: `/u/${user?.url_token}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Login failed",
      success: false,
    };
  }
}

export async function signUpAction(
  prevState: {
    error?: string;
    success?: boolean;
    redirect?: string;
  },
  formData: FormData
) {
  let name, email, password, repeatPassword;
  try {
    name = formData.get("name") as string;
    email = formData.get("email") as string;
    password = formData.get("password") as string;
    repeatPassword = formData.get("repeat-password") as string;

    if (!email || !password || !name || !repeatPassword) {
      throw new Error("All fields are required");
    }
    if (password !== repeatPassword) {
      throw new Error("Passwords do not match");
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sign up failed",
      success: false,
    };
  }

  let ipAddress, deviceInfo;
  try {
    const info = await getDeviceInfoFromHeaders();
    ipAddress = info.ipAddress;
    deviceInfo = info.deviceInfo;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sign up failed",
      success: false,
    };
  }

  try {
    const { user, session } = await signUp(
      email,
      password,
      name,
      ipAddress,
      deviceInfo
    );

    return { error: "", success: true, redirect: `/u/${user?.url_token}` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Sign up failed",
      success: false,
    };
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
    console.error("signOutAction error:", error);
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
