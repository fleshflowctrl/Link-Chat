/** Credits tab: fill the shell between top and bottom nav without page scroll. */
export default function CreditsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
