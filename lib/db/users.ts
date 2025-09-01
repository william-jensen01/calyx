import {
  createServiceClient,
  createUserContextClient,
} from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth/utils";
import type { User } from "@/lib/auth/types";

export async function createUser(
  email: string,
  password: string,
  name: string
): Promise<User> {
  const supabase = createServiceClient();
  const passwordHash = await hashPassword(password);

  const { data, error } = await supabase
    .from("users")
    .insert({
      email,
      password_hash: passwordHash,
      name,
    })
    .select("id, email, name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation
      throw new Error("User with this email already exists");
    }
    throw new Error("Failed to create user");
  }

  return data;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, created_at")
    .eq("email", email)
    .single();

  if (error || !data) return null;
  return data;
}

export async function getUserWithPassword(
  email: string
): Promise<(User & { password_hash: string }) | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("users")
    .select("id, email, name, created_at, password_hash")
    .eq("email", email)
    .single();

  if (error || !data) return null;
  return data;
}

export async function updateUserProfile(
  userId: string,
  email: string,
  updates: any
): Promise<User> {
  if (!userId || !email || !updates) throw new Error("Invalid user data");

  const userClient = createUserContextClient(userId, email);

  const { data, error } = await userClient
    .from("users")
    .update(updates)
    .eq("id", userId)
    .select("id, email, name, created_at")
    .single();

  if (error) throw new Error("Failed to update user profile");
  return data;
}
