import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { SESSION_EXPIRES_IN } from "./types";
import type { DeviceInfo } from "./types";

// ===============================
// MARK: Password
// ===============================

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

// ===============================
// MARK: Session
// ===============================

export function generateSessionToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);

  // Convert to hex string
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export function calculateSessionExpiry(): Date {
  return new Date(Date.now() + SESSION_EXPIRES_IN);
}

// ===============================
// MARK: Device Information
// ===============================

export async function parseUserAgent(
  headersList: Headers
): Promise<DeviceInfo> {
  const userAgent = headersList.get("user-agent") || "";
  const deviceInfo: DeviceInfo = {
    userAgent,
  };

  // Simple browser detection
  if (userAgent.includes("Chrome/")) {
    deviceInfo.browser = "Chrome";
  } else if (userAgent.includes("Firefox/")) {
    deviceInfo.browser = "Firefox";
  } else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome/")) {
    deviceInfo.browser = "Safari";
  } else if (userAgent.includes("Edge/")) {
    deviceInfo.browser = "Edge";
  } else if (userAgent.includes("Opera/") || userAgent.includes("OPR/")) {
    deviceInfo.browser = "Opera";
  } else {
    deviceInfo.browser = "Unknown";
  }

  // Simple OS detection
  if (userAgent.includes("Windows")) {
    deviceInfo.os = "Windows";
  } else if (userAgent.includes("Macintosh") || userAgent.includes("Mac OS")) {
    deviceInfo.os = "macOS";
  } else if (userAgent.includes("Linux")) {
    deviceInfo.os = "Linux";
  } else if (userAgent.includes("Android")) {
    deviceInfo.os = "Android";
  } else if (userAgent.includes("iPhone") || userAgent.includes("iOS")) {
    deviceInfo.os = "iOS";
  } else {
    deviceInfo.os = "Unknown";
  }

  // Simple device type detection
  const isMobile =
    /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  deviceInfo.isMobile = isMobile;

  if (userAgent.includes("iPhone")) {
    deviceInfo.device = "iPhone";
  } else if (userAgent.includes("iPad")) {
    deviceInfo.device = "iPad";
  } else if (userAgent.includes("Android")) {
    deviceInfo.device = "Android Device";
  } else if (isMobile) {
    deviceInfo.device = "Mobile Device";
  } else {
    deviceInfo.device = "Desktop";
  }

  return deviceInfo;
}

// MARK: Client IP
export async function getClientIP(headersList: Headers): Promise<string> {
  // Try various headers that might contain the client IP
  const forwardedFor = headersList?.get("x-forwarded-for");
  const realIP = headersList?.get("x-real-ip");
  const clientIP = headersList?.get("x-client-ip");
  const forwarded = headersList?.get("forwarded");

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (clientIP) {
    return clientIP;
  }

  if (forwarded) {
    // Parse forwarded header: for=192.0.2.60;proto=http;by=203.0.113.43
    const forMatch = forwarded.match(/for=([^;,\s]+)/);
    if (forMatch) {
      return forMatch[1];
    }
  }

  // In development, we might not have these headers
  return "";
}

// Helper to format device info for display
export function formatDeviceInfo(session: {
  device_info?: DeviceInfo;
  ip_address?: string;
}): string {
  if (!session.device_info) {
    return "Unknown Device";
  }

  const { browser, os, device, isMobile } = session.device_info;
  let result = "";

  if (device && device !== "Unknown") {
    result = device;
  } else if (browser && os) {
    result = `${browser} on ${os}`;
  } else if (browser) {
    result = browser;
  } else {
    result = isMobile ? "Mobile Device" : "Desktop";
  }

  if (session.ip_address) {
    result += ` (${session.ip_address})`;
  }

  return result;
}

// Helper to get a short device identifier for display
export function getDeviceDisplayName(session: {
  device_info?: DeviceInfo;
  created_at: string;
}): string {
  if (!session.device_info) {
    return `Device (${new Date(session.created_at).toLocaleDateString()})`;
  }

  const { device, browser, os, isMobile } = session.device_info;

  if (device === "iPhone" || device === "iPad") {
    return device;
  } else if (device === "Android Device") {
    return "Android";
  } else if (isMobile) {
    return "Mobile";
  } else if (os === "Windows") {
    return `Windows (${browser || "Browser"})`;
  } else if (os === "macOS") {
    return `Mac (${browser || "Browser"})`;
  } else if (os === "Linux") {
    return `Linux (${browser || "Browser"})`;
  } else {
    return `${browser || "Browser"} on ${os || "Unknown"}`;
  }
}

// Get device info from middleware-injected headers
export async function getDeviceInfoFromHeaders(): Promise<{
  ipAddress: string;
  deviceInfo: DeviceInfo;
}> {
  const headerList = await headers();

  const ipAddress = headerList.get("x-client-ip") || "";
  const deviceInfoStr = headerList.get("x-device-info");

  let deviceInfo: DeviceInfo;
  try {
    deviceInfo = deviceInfoStr ? JSON.parse(deviceInfoStr) : { userAgent: "" };
  } catch (error) {
    deviceInfo = { userAgent: "" };
  }

  return { ipAddress, deviceInfo };
}
