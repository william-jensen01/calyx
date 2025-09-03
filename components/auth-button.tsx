import Link from "next/link";
import { getCurrentSession } from "@/lib/auth";
import { Button } from "./ui/button";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const { user } = await getCurrentSession();

  return user ? (
    <div className="flex items-center gap-4">
      Hey, {user.name.split(" ")[0]}!
      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Button asChild size="sm" variant={"outline"}>
        <Link href="/auth/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" variant={"default"}>
        <Link href="/auth/sign-up">Sign up</Link>
      </Button>
    </div>
  );
}
