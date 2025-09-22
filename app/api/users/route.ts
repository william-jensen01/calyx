import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/api-tokens/middleware";
import { createUser } from "@/lib/db/users";
import type { User } from "@/lib/auth/types";

interface UserData {
  extractedAt: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  fullName: string;
  store: string;
  pincode: string;
}

interface FailedUser {
  name: string;
  email: string;
  error: string;
}

export const POST = withAuth(
  async (request: NextRequest) => {
    const { users }: { users: UserData[] } = await request.json();
    try {
      if (users.length <= 0) {
        return NextResponse.json(
          { error: "No users found in request body", success: false },
          { status: 400 }
        );
      }

      // Parallel user creation
      const createResults = await Promise.allSettled(
        users.map((userData) =>
          createUser(userData.email, userData.pincode, userData.fullName)
        )
      );

      const results: User[] = [];
      const errors: FailedUser[] = [];

      createResults.forEach((result, i) => {
        const userData = users[i];

        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          console.error(
            `Failed to create user ${userData.fullName}:`,
            result.reason instanceof Error
              ? result.reason.message
              : "Unknown error"
          );
          errors.push({
            name: userData.fullName,
            email: userData.email,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "Unknown error",
          });
        }
      });

      return NextResponse.json({
        success: true,
        created: results.length,
        errors: errors.length,
        errorDetails: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      return NextResponse.json(
        {
          error: "Failed to load users from request body",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  },
  { requireScope: "users:write" }
);
