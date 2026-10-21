import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const EditorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="14" height="14" rx="2.5" />
    <path d="M6.5 7h7M6.5 10h7M6.5 13h4" />
  </Icon>
);

export const SplitIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="14" height="14" rx="2.5" />
    <path d="M10 3v14" />
    <path d="M5.5 7h2.5M5.5 10h2.5" />
  </Icon>
);

export const PreviewIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 2.75h6l3.75 3.75v9.25a1.5 1.5 0 0 1-1.5 1.5h-8.25a1.5 1.5 0 0 1-1.5-1.5v-11.5a1.5 1.5 0 0 1 1.5-1.5Z" />
    <path d="M11.5 2.75V6.5h3.75M7 10.5h6M7 13.5h4" />
  </Icon>
);

export const SwapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 3.5 16.5 6.5l-3 3M16.5 6.5h-10M6.5 10.5l-3 3 3 3M3.5 13.5h10" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 10h10" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 5v10M5 10h10" />
  </Icon>
);

export const FitWidthIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 4v12M17 4v12M6 10h8M8 8l-2 2 2 2M12 8l2 2-2 2" />
  </Icon>
);

export const FitPageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.5" y="2.75" width="9" height="14.5" rx="1.5" />
    <path d="M8 7.5h4M8 10h4M8 12.5h2.5" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12.5 4.5 15.5 7.5M4 16l.75-3.5L13.5 3.75a1.4 1.4 0 0 1 2 0l.75.75a1.4 1.4 0 0 1 0 2L7.5 15.25 4 16Z" />
  </Icon>
);

export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="7" r="3.25" />
    <path d="M3.75 16.5c.9-2.9 3.3-4.5 6.25-4.5s5.35 1.6 6.25 4.5" />
  </Icon>
);

export const TextIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h12M4 8.5h12M4 12h8M4 15.5h5" />
  </Icon>
);

export const BriefcaseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.75" y="6" width="14.5" height="10.5" rx="2" />
    <path d="M7.25 6V4.75c0-.7.55-1.25 1.25-1.25h3c.7 0 1.25.55 1.25 1.25V6M2.75 10.5h14.5" />
  </Icon>
);

export const CapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 4 2 8l8 4 8-4-8-4Z" />
    <path d="M5 9.5v3.75c1.4 1.15 3.05 1.75 5 1.75s3.6-.6 5-1.75V9.5M18 8v4" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 2.75 11.6 8.4l5.65 1.6-5.65 1.6L10 17.25 8.4 11.6 2.75 10 8.4 8.4 10 2.75Z" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.75 6.25c0-.83.67-1.5 1.5-1.5h3.5l1.75 2h6.25c.83 0 1.5.67 1.5 1.5v6.5c0 .83-.67 1.5-1.5 1.5H4.25c-.83 0-1.5-.67-1.5-1.5v-8.5Z" />
    <path d="m8.25 10.5-1.5 1.5 1.5 1.5M11.75 10.5l1.5 1.5-1.5 1.5" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10" cy="10" r="7.25" />
    <path d="M2.75 10h14.5M10 2.75c2 2 3 4.4 3 7.25s-1 5.25-3 7.25c-2-2-3-4.4-3-7.25s1-5.25 3-7.25Z" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3v9.5M6 8.75l4 4 4-4M3.5 13.5v1.75c0 .83.67 1.5 1.5 1.5h10c.83 0 1.5-.67 1.5-1.5V13.5" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 10H4M8.5 5.5 4 10l4.5 4.5" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10h12M11.5 5.5 16 10l-4.5 4.5" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.5 8 4.5 4.5L14.5 8" />
  </Icon>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.5 12 4.5-4.5 4.5 4.5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 5.5h13M8 5.5V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v1.5M5 5.5l.75 10.25c.05.8.7 1.25 1.5 1.25h5.5c.8 0 1.45-.45 1.5-1.25L15 5.5M8.5 8.75v5M11.5 8.75v5" />
  </Icon>
);

export const BulbIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7.5 14.5h5M8.25 17h3.5M10 2.75a5 5 0 0 0-3 9c.6.45 1 1.1 1 1.85v.9h4v-.9c0-.75.4-1.4 1-1.85a5 5 0 0 0-3-9Z" />
  </Icon>
);

export const MoreIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="4.5" cy="10" r=".9" fill="currentColor" />
    <circle cx="10" cy="10" r=".9" fill="currentColor" />
    <circle cx="15.5" cy="10" r=".9" fill="currentColor" />
  </Icon>
);
