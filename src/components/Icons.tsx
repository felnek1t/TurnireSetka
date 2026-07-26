import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function SwordsIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m14.5 17.5 3 3 3-3-3-3M13 19l6-6M5 3l4 4M3 5l4-2M7 7 2-4M9.5 14.5l-6 6M3.5 17.5l3 3 3-3-3-3M19 3l2 4-4-2M15 9l6-6" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20 7h-5V2" />
      <path d="M20 7a9 9 0 1 0 1 8" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect width="16" height="11" x="4" y="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m20 6-11 11-5-5" />
    </svg>
  );
}

export function CrownIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m2 7 4 3 6-7 6 7 4-3-2 12H4L2 7Z" />
      <path d="M5 22h14" />
    </svg>
  );
}

export function VoteIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function GripIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="9" cy="6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r=".8" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r=".8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
