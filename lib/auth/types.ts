// MARK: User
export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  url_token: string;
}

// MARK: Device Info
export interface DeviceInfo {
  userAgent: string;
  browser?: string;
  os?: string;
  device?: string;
  isMobile?: boolean;
}

// MARK: Session
export interface Session {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
  ip_address?: string;
  device_info?: DeviceInfo;
  last_activity: string;
  fresh?: boolean; // Indicates if session was just extended
}

// MARK: Session Validation Result
export interface SessionValidationResult {
  user: User | null;
  session: Session | null;
}

// MARK: Session Deletion Result
export interface SessionDeletionResult {
  success: boolean;
  deletedCurrentSession?: boolean;
  message?: string;
  error?: string;
}

// MARK: Config Constants
export const SESSION_COOKIE_NAME = "auth-session";
export const SESSION_EXPIRES_IN = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
export const SESSION_REFRESH_THRESHOLD = SESSION_EXPIRES_IN / 2; // Refresh when < 15 days left
export const MAX_SESSIONS_PER_USER = 5;
