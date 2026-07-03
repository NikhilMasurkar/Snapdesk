import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-4 rounded-xl border p-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
