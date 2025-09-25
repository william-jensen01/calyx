import { requireAuth } from "@/lib/auth";
import { CalendarUrl } from "@/components/user/calendar-url";

export default async function ProtectedPage() {
  const user = await requireAuth();

  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="flex flex-col gap-4 items-start">
        {user.url_token && <CalendarUrl url_token={user.url_token} />}

        <h2 className="font-bold text-2xl">User details</h2>
        <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto w-full max-w-sm">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}
