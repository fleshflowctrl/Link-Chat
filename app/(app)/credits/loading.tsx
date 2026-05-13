export default function CreditsLoading() {
  return (
    <div className="bg-[#F5F3EE] pb-8">
      {/* header */}
      <div className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="space-y-1.5">
          <div className="h-8 w-28 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-3 w-44 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded-full bg-gray-200" />
      </div>
      {/* offer banner */}
      <div className="mx-5 mb-5 h-16 animate-pulse rounded-2xl bg-gray-200" />
      {/* package cards */}
      <div className="space-y-2.5 px-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
