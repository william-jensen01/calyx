export const protectedRoutes = ["/u"];
export const authRoutes = [
  "/auth/login",
  "/auth/sign-up",
  "/auth/update-password",
];
export const publicRoutes = [...authRoutes, "/"];
