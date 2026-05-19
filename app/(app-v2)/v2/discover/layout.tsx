/** Locks discover to the main pane height — no document scroll on home. */
export default function V2DiscoverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">{children}</div>
  );
}
