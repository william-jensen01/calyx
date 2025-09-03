import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./types";
import { getClientIP, parseUserAgent } from "./utils";
import { publicRoutes } from "@/config/middleware.config";

export async function authMiddleware(request: NextRequest) {
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
