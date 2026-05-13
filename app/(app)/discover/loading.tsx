export default function DiscoverLoading() {
  return (
    <div className="pb-4">
      {/* header */}
      <div className="flex items-center justify-between px-4 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="h-8 w-24 animate-pulse rounded-xl bg-gray-200" />
        <div className="flex gap-1.5">
          <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
      {/* activity strip */}
      <div className="flex gap-3 overflow-hidden px-4 py-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-14 w-14 animate-pulse rounded-full bg-gray-200" />
            <div className="h-2.5 w-10 animate-pulse rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
      {/* profile grid */}
      <div className="grid grid-cols-2 gap-2.5 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
