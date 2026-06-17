import { Lock } from "lucide-react";
import { getGuestPhotoLockMessage } from "@/lib/discover/guest-photo-lock";

type Props = {
  profileName: string;
  size?: "sm" | "md";
};

export function GuestPhotoLockMessage({ profileName, size = "md" }: Props) {
  const { title, subtitle } = getGuestPhotoLockMessage(profileName);

  const titleClass =
    size === "sm"
      ? "text-[11px] font-bold leading-snug text-white"
      : "text-[14px] font-bold leading-snug text-white";
  const subtitleClass =
    size === "sm"
      ? "text-[10px] font-normal leading-snug text-white/90"
      : "text-[12px] font-normal leading-snug text-white/90";
  const iconClass = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex max-w-[26ch] flex-col items-center gap-2 text-center">
      <Lock
        className={`${iconClass} text-[#E85A59]`}
        strokeWidth={2.25}
        aria-hidden
      />
      <div>
        <p className={titleClass}>{title}</p>
        <p className={`mt-0.5 ${subtitleClass}`}>{subtitle}</p>
      </div>
    </div>
  );
}

type OverlayProps = Props & {
  className?: string;
};

export function GuestPhotoLockOverlay({
  profileName,
  size = "md",
  className = "pointer-events-none absolute inset-0 z-[2] flex items-center justify-center p-4",
}: OverlayProps) {
  return (
    <div
      className={`pointer-events-none ${className}`}
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      aria-hidden
    >
      <GuestPhotoLockMessage profileName={profileName} size={size} />
    </div>
  );
}
