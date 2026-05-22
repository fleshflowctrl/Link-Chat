/** Thread view fills the shell; only the message list scrolls (keyboard-safe). */
export default function MessageThreadLayout({
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
