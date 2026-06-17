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

  return (
    <div className="max-w-[24ch] text-left">
      <p className={titleClass}>{title}</p>
      <p className={`mt-0.5 ${subtitleClass}`}>{subtitle}</p>
    </div>
  );
}

type OverlayProps = Props & {
  className?: string;
};

export function GuestPhotoLockOverlay({
  profileName,
  size = "md",
  className = "absolute inset-0 z-[2] flex items-center justify-center p-4",
}: OverlayProps) {
  return (
    <div
      className={className}
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
    >
      <GuestPhotoLockMessage profileName={profileName} size={size} />
    </div>
  );
}
