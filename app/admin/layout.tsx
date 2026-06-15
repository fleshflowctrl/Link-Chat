import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminSidebarNav, AdminMobileNav } from "@/components/admin/sidebar-nav";
import { SITE_DISPLAY } from "@/lib/brand";

export const metadata = {
  title: `${SITE_DISPLAY} · admin`,
  robots: { index: false, follow: false },
};

// Admin is auth-gated and reads cookies — never prerender it at build time.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Best-effort lookup for the sidebar — page-level requireAdmin() still
  // gates each route, so an unauthenticated visitor never gets here.
  const auth = await requireAdmin();
  const adminEmail = auth.ok ? auth.email : null;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="flex min-h-screen">
        <AdminSidebarNav adminEmail={adminEmail} />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminMobileNav adminEmail={adminEmail} />
          <main className="flex-1 px-4 py-6 sm:px-8 sm:py-10 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
