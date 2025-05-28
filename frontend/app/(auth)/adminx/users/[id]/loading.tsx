import { Skeleton } from "@/components/ui/skeleton"

export default function UserDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-24" />
      </div>

      <Skeleton className="h-48 w-full" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>

      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-96 w-full" />
      ))}
    </div>
  )
}
