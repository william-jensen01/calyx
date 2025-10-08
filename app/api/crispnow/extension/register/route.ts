import { NextRequest, NextResponse } from "next/server";
import { createAPIToken } from "@/lib/auth/api-tokens";
import { AuthContext, withAuth } from "@/lib/auth/api-tokens/middleware";
import { deleteAPIToken } from "@/lib/db/api-tokens";

export async function POST(request: NextRequest) {
  try {
    const extensionId = request.headers.get("X-Extension-ID");
    const extensionVersion = request.headers.get("X-Extension-Version");

    console.log(
      `[API] Extension registration request - ID: ${extensionId}, version: ${extensionVersion}`
    );

    // Simple validation
    if (!extensionId || !extensionVersion) {
      console.warn("[API] Missing extension ID or version");
      return NextResponse.json(
        { error: "Extension ID and version required" },
        { status: 400 }
      );
    }

    const deviceId = extensionId.substring(0, 8);

    const { token, tokenData } = await createAPIToken({
      name: `Crispnow Extension v${extensionVersion} (${deviceId})`,
      scopes: ["events:read", "events:write", "users:write"],
      user_id: null,
      expires_in_days: 365, // Long-lived
    });

    console.log(
      `[API] Created extension token: ${tokenData.prefix} for install ${deviceId}`
    );

    return NextResponse.json({
      token,
      scopes: tokenData.scopes,
      expires_at: tokenData.expires_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 }
    );
  }
}

// delete api-token for extension
// note: will delete the token used to authorize request
export const DELETE = withAuth(
  async (_, authContext: AuthContext) => {
    try {
      if (authContext.api_token_id) {
        await deleteAPIToken(authContext.api_token_id);
      }

      return NextResponse.json({ message: "Extension unregistered" });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Unregistration failed",
        },
        { status: 500 }
      );
    }
  },
  { requireScope: "events:write" }
);
