import { Skeleton } from "@/components/ui/skeleton";

export default function TestimonialsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-64" />
      </div>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
