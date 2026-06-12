import { V2_THEME } from "@/lib/v2-theme";
import { APP_SHELL_WIDTH_CLASS } from "@/lib/responsive-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      data-app-variant="v2"
      className="flex min-h-[100dvh] items-center justify-center px-4 py-10 md:px-6 lg:px-8"
      style={{ backgroundColor: V2_THEME.bg }}
    >
      <div className={`w-full ${APP_SHELL_WIDTH_CLASS} md:max-w-md`}>{children}</div>
    </div>
  );
}
