export default function LinksLoading() {
  return (
    <div className="px-5 pb-8 pt-1">
      {/* header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-8 w-28 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-3 w-40 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
      </div>
      {/* content grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
