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
      className="h-[100dvh] overflow-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6"
      style={{ backgroundColor: V2_THEME.bg }}
    >
      <div
        className={`mx-auto flex h-full w-full items-center ${APP_SHELL_WIDTH_CLASS} md:max-w-md`}
      >
        {children}
      </div>
    </div>
  );
}
