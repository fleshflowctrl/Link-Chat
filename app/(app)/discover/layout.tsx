/** Locks discover to the main pane height — no document scroll on home. */
export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
