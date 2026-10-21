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
