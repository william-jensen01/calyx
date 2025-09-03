"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const logout = () => {
    startTransition(async () => {
      try {
        await signOutAction();
      } catch (error) {
        console.error("LogoutButton error:", error);
      }
    });
  };

  return (
    <Button onClick={logout} disabled={isPending}>
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
