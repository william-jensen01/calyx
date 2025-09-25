import { requireAuth } from "@/lib/auth";

export default async function ProtectedPage() {
  const user = await requireAuth();

  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="flex flex-col gap-2 items-start">
        <h2 className="font-bold text-2xl mb-4">User details</h2>
        <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto w-auto">
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}
