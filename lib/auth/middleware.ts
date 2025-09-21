import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./types";
import { getClientIP, parseUserAgent } from "./utils";
import { publicRoutes } from "@/config/middleware.config";
// import { authenticateRequest } from "./api-tokens/middleware";

export async function authMiddleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next({
    request,
  });
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // Always extract and pass device info through headers for tracking
  const ipAddress = await getClientIP(request.headers);
  const deviceInfo = await parseUserAgent(request.headers);

  // Add device info to response headers
  response.headers.set("x-client-ip", ipAddress);
  response.headers.set("x-device-info", JSON.stringify(deviceInfo));

  // If request is to an API route, allow since they control own auth
  if (pathname.startsWith("/api/")) {
    // const authContext = await authenticateRequest(request);

    // response.headers.set("x-auth-type", authContext.type);
    // if (authContext.user_id) {
    //   response.headers.set("x-auth-user-id", authContext.user_id);
    // }
    // if (authContext.scopes) {
    //   response.headers.set("x-auth-scopes", authContext.scopes.join(","));
    // }

    return response;
  }

  // If no session token, handle unauthenticated user
  if (!sessionToken) {
    return handleUnauthenticated(request, response);
  }

  // No need to handle authenticated users accessing auth pages

  return response;
}

function handleUnauthenticated(request: NextRequest, response: NextResponse) {
  // Allow access to home page and auth pages
  if (publicRoutes.includes(request.nextUrl.pathname)) {
    return response;
  }

  // Redirect to auth page for protected routes
  const url = request.nextUrl.clone();
  url.pathname = "/auth/login";
  return NextResponse.redirect(url);
}
