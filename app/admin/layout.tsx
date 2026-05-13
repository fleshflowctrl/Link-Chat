import Link from "next/link";

export const metadata = {
  title: "whisper · admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F3EE] text-gray-900">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/admin/messages" className="text-lg font-semibold tracking-tight">
            whisper · admin
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/admin/messages" className="text-gray-600 hover:text-gray-900">
              Berichten
            </Link>
            <Link href="/discover" className="text-gray-600 hover:text-gray-900">
              ← Terug naar app
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
