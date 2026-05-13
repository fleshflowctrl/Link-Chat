export default function MessagesLoading() {
  return (
    <div className="flex flex-col gap-0 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* header skeleton */}
      <div className="flex items-center justify-between px-5 pb-3 pt-1">
        <div className="h-8 w-32 animate-pulse rounded-xl bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
      {/* thread rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 animate-pulse rounded-full bg-gray-200" />
            <div className="h-3 w-48 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="h-3 w-10 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
