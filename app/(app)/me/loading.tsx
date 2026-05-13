export default function MeLoading() {
  return (
    <div className="bg-[#F5F3EE] pb-8">
      {/* header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="h-8 w-24 animate-pulse rounded-xl bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>
      {/* profile card */}
      <div className="mx-5 mb-4 overflow-hidden rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 animate-pulse rounded-full bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded-full bg-gray-200" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
      </div>
      {/* stat cards */}
      <div className="mx-5 grid grid-cols-2 gap-2.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
