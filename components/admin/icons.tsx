/**
 * Tiny inline-SVG icon set for the admin panel. Keeping these in-repo
 * (instead of pulling heroicons or lucide-react) lets us tree-shake to
 * exactly what we use and keeps the admin chunk small.
 *
 * Each icon follows the same shape: a 20x20 viewBox, currentColor stroke,
 * 1.75 stroke-width, rounded line caps/joins. Icons inherit `text-*`
 * from the parent so a single class controls colour.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 20,
  height: 20,
  "aria-hidden": true,
};

export function UsersIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="7.5" cy="6.25" r="2.75" />
      <path d="M2.5 16.25c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      <path d="M13 4.5a2.5 2.5 0 0 1 0 5" />
      <path d="M14.75 11.5c1.95.4 3.5 1.95 3.5 4" />
    </svg>
  );
}

export function ChatBubbleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16.25 11.25c0 2.07-1.95 3.75-4.35 3.75H10l-3.5 2.5v-2.7c-1.65-.6-2.75-2.04-2.75-3.55V7.5c0-2.07 1.95-3.75 4.35-3.75h4.8c2.4 0 4.35 1.68 4.35 3.75v3.75z" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.75 8.75 10 3.75l6.25 5v8a.75.75 0 0 1-.75.75h-3.75v-5h-3.5v5H4.5a.75.75 0 0 1-.75-.75v-8z" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 4.25v11.5M4.25 10h11.5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m7.5 4.75 5.25 5.25-5.25 5.25" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m12.5 4.75-5.25 5.25 5.25 5.25" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m4.75 10.25 3.5 3.5 7-7" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m5 5 10 10M15 5 5 15" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="9" cy="9" r="5" />
      <path d="m13 13 3.25 3.25" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 13.5V3.75M10 3.75 6.5 7.25M10 3.75l3.5 3.5" />
      <path d="M3.75 13.5v2c0 .55.45 1 1 1h10.5c.55 0 1-.45 1-1v-2" />
    </svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 5.25h14v3H3z" />
      <path d="M4 8.25v6.5c0 .55.45 1 1 1h10c.55 0 1-.45 1-1v-6.5" />
      <path d="M8 11.25h4" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.5 5.5h13" />
      <path d="M8 3.5h4M5.5 5.5l.6 10c.04.55.5.99 1 .99h5.8c.5 0 .96-.44 1-.99l.6-10" />
      <path d="M9 9v5M11 9v5" />
    </svg>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="5" cy="10" r="1.25" />
      <circle cx="10" cy="10" r="1.25" />
      <circle cx="15" cy="10" r="1.25" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16.5 4.5v3.5H13" />
      <path d="M16.5 8a6.5 6.5 0 1 0-1.5 4" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13.5 3.5l3 3-9 9H4.5v-3z" />
      <path d="M12 5l3 3" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3 7.25h2l1.5-2h7L15 7.25h2v8.5a.75.75 0 0 1-.75.75H3.75A.75.75 0 0 1 3 15.75v-8.5z" />
      <circle cx="10" cy="11.5" r="2.75" />
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M5.5 5.5l2 2M12.5 12.5l2 2M5.5 14.5l2-2M12.5 7.5l2-2" />
    </svg>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 16s-6-3.5-6-7.75A3.25 3.25 0 0 1 10 6a3.25 3.25 0 0 1 6 2.25C16 12.5 10 16 10 16z" />
    </svg>
  );
}

export function PaletteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10 2.5a7.5 7.5 0 1 0 0 15c.83 0 1.5-.67 1.5-1.5 0-.4-.15-.78-.44-1.06-.27-.28-.43-.66-.43-1.06 0-.83.67-1.5 1.5-1.5h1.62a3.75 3.75 0 0 0 3.75-3.75A7.5 7.5 0 0 0 10 2.5z" />
      <circle cx="6" cy="9" r=".75" fill="currentColor" />
      <circle cx="9" cy="6" r=".75" fill="currentColor" />
      <circle cx="13" cy="6.5" r=".75" fill="currentColor" />
      <circle cx="14.5" cy="9.5" r=".75" fill="currentColor" />
    </svg>
  );
}

export function IdIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.25" />
      <circle cx="7" cy="9.25" r="1.5" />
      <path d="M4.5 13c0-1.1.9-2 2-2h1c1.1 0 2 .9 2 2" />
      <path d="M11.5 8h4M11.5 11h3" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="10" cy="10" r="7" />
      <path d="m12 8-3 1-1 3 3-1 1-3z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.75 4.25h12.5v11.5H5.5c-.97 0-1.75-.78-1.75-1.75V4.25z" />
      <path d="M3.75 14c0 .97.78 1.75 1.75 1.75h10.5" />
    </svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="7.5" y="2.5" width="5" height="9" rx="2.5" />
      <path d="M5 10a5 5 0 0 0 10 0M10 15v2.5M7.5 17.5h5" />
    </svg>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M3.5 16.5h13" />
      <path d="M6 13.5v-4" />
      <path d="M10 13.5V6" />
      <path d="M14 13.5v-6" />
    </svg>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 6h12M4 10h12M4 14h12" />
    </svg>
  );
}

export function CircleStatusIcon(props: IconProps & { state?: "active" | "online" | "new" | "popular" | "quiet" | "replied" }) {
  const fill = (() => {
    switch (props.state) {
      case "online":
      case "active":
        return "#22C55E";
      case "new":
        return "#FF8A4C";
      case "popular":
        return "#FF6B9D";
      case "replied":
        return "#7C5CFF";
      case "quiet":
        return "#9CA3AF";
      default:
        return "#9CA3AF";
    }
  })();
  return (
    <svg {...baseProps} {...props} stroke="none" fill={fill}>
      <circle cx="10" cy="10" r="4" />
    </svg>
  );
}
