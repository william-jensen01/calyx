export const protectedRoutes = ["/protected"];
export const authRoutes = [
  "/auth/login",
  "/auth/sign-up",
  "/auth/update-password",
];
export const publicRoutes = [...authRoutes, "/"];
