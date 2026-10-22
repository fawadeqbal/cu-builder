import type { SVGProps } from "react";
import { ICONS } from "./icon-paths";

type IconProps = SVGProps<SVGSVGElement>;

/**
 * Named icon components kept for existing call sites. All are drawn from the Folio set (24×24 grid,
 * 1.75 stroke, round caps, currentColor), the same paths as `<Icon name="…" />`. Size them with
 * width/height or a class (`size-4`, `size-5`).
 */
function folio(paths: string) {
  function FolioIcon(props: IconProps) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
        dangerouslySetInnerHTML={{ __html: paths }}
      />
    );
  }
  return FolioIcon;
}

const p = (name: keyof typeof ICONS) => ICONS[name] ?? "";

export const EditorIcon = folio(p("list"));
export const SplitIcon = folio(p("split"));
export const PreviewIcon = folio(p("eye"));
export const SwapIcon = folio(p("sort"));
export const MinusIcon = folio(p("minus"));
export const PlusIcon = folio(p("plus"));
export const FitWidthIcon = folio(p("fit-width"));
export const FitPageIcon = folio(p("fit-page"));
export const PencilIcon = folio(p("edit"));
export const UserIcon = folio(p("user"));
export const TextIcon = folio('<path d="M5 6h14M5 12h14M5 18h9"/>');
export const BriefcaseIcon = folio(p("briefcase"));
export const CapIcon = folio(p("graduation-cap"));
export const SparkIcon = folio(p("sparkle"));
export const FolderIcon = folio(p("folder"));
export const GlobeIcon = folio(p("globe"));
export const DownloadIcon = folio(p("download"));
export const CheckIcon = folio(p("check"));
export const ArrowLeftIcon = folio(p("arrow-left"));
export const ArrowRightIcon = folio(p("arrow-right"));
export const ChevronDownIcon = folio(p("chevron-down"));
export const ChevronUpIcon = folio(p("chevron-up"));
export const TrashIcon = folio(p("trash"));
export const BulbIcon = folio(p("lightbulb"));
export const MoreIcon = folio(p("more"));
export const TemplatesIcon = folio(p("template"));
export const ShareIcon = folio(p("share"));
export const HistoryIcon = folio(p("history"));
export const LockIcon = folio(p("lock"));
export const CopyIcon = folio(p("copy"));
export const UploadIcon = folio(p("upload"));
export const CloudIcon = folio(p("cloud"));
export const LogoutIcon = folio(p("logout"));
export const DocIcon = folio(p("file"));
export const CloseIcon = folio(p("x"));
