"use server";

import { deleteUserSession, signOut } from ".";
import { redirect } from "next/navigation";
import { signIn, signUp, getCurrentUser } from "@/lib/auth";
import { DeviceInfo, SessionDeletionResult } from "@/lib/auth/types";
import { getUserSessions } from "../db/sessions";
import { deleteSessionCookie } from "./utils";
import { revalidatePath } from "next/cache";

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
