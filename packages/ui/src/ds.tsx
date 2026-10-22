/**
 * Folio components: the React side of the "CV Builder Product" design system. Every component
 * renders `cvb-*` classes from styles.css, which read the tokens in tokens.css, so they follow the
 * light/dark theme, mirror in right-to-left and pick up a white-label brand without extra props.
 *
 * Apps wrap their tree in <UiProvider> once to plug in their router's link component (Next's
 * <Link>) and translated labels; without it, plain <a> tags and English labels are used.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ComponentType,
  type CSSProperties,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type RefObject,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { ICONS } from "./icon-paths";

type Node = ReactNode;

export const cx = (...c: (string | false | null | undefined | 0)[]) => c.filter(Boolean).join(" ");

/* ─── Provider: links and labels ───────────────────────────────── */

export type UiLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: Ref<HTMLAnchorElement> };
export type UiLabels = {
  close: string;
  remove: string;
  loading: string;
  optional: string;
  previousPage: string;
  nextPage: string;
  pages: string;
  breadcrumb: string;
  mainNav: string;
  theme: string;
  themeLight: string;
  themeDark: string;
  themeSystem: string;
  language: string;
  chooseFile: string;
  dismiss: string;
};
const EN: UiLabels = {
  close: "Close",
  remove: "Remove",
  loading: "Loading",
  optional: "(optional)",
  previousPage: "Previous page",
  nextPage: "Next page",
  pages: "Pages",
  breadcrumb: "Breadcrumb",
  mainNav: "Main",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  themeSystem: "System",
  language: "Language",
  chooseFile: "Choose file",
  dismiss: "Dismiss",
};
type UiContext = { Link: ComponentType<UiLinkProps>; labels: UiLabels };
const PlainLink = (props: UiLinkProps) => <a {...props} />;
const Ctx = createContext<UiContext>({ Link: PlainLink, labels: EN });

export function UiProvider({ link, labels, children }: { link?: ComponentType<UiLinkProps>; labels?: Partial<UiLabels>; children: Node }) {
  return <Ctx.Provider value={{ Link: link ?? PlainLink, labels: { ...EN, ...labels } }}>{children}</Ctx.Provider>;
}
export const useUi = () => useContext(Ctx);

/** A link through the app's router (Next <Link> when the provider sets it). */
export function UiLink(props: UiLinkProps) {
  const { Link } = useUi();
  return <Link {...props} />;
}

/* ─── Icon and logo ────────────────────────────────────────────── */

export type IconName = keyof typeof ICONS;
export const iconNames = Object.keys(ICONS) as IconName[];
const FLIP = new Set(["arrow-left", "arrow-right", "chevron-left", "chevron-right", "undo", "logout", "external-link"]);

export function Icon({ name, size = 20, label, className, style }: { name: IconName | (string & {}); size?: number; label?: string; className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={cx("cvb-icon", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-flip={FLIP.has(name) ? "" : undefined}
      style={style}
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? ICONS.info ?? "" }}
    />
  );
}

export function LogoMark({ size = 28, src }: { size?: number; src?: string | null }) {
  if (src) return <img src={src} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path className="cvb-logo-page" d="M8 3h12.5L27 9.5V26a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z" />
      <path className="cvb-logo-fold" d="M20.5 3L27 9.5h-4.5a2 2 0 0 1-2-2z" />
      <path className="cvb-logo-line" d="M10 16h9M10 21h6" fill="none" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** The mark and wordmark. White-label partners pass their product name and logo. */
export function Logo({ href = "/", size = 28, wordmark = true, product = "CV Builder", logoSrc, className }: { href?: string; size?: number; wordmark?: boolean; product?: string; logoSrc?: string | null; className?: string }) {
  return (
    <UiLink className={cx("cvb-logo", className)} href={href} aria-label={product}>
      <LogoMark size={size} src={logoSrc} />
      {wordmark && <span className="cvb-logo-text">{product}</span>}
    </UiLink>
  );
}

/* ─── Actions ──────────────────────────────────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "highlight" | "link";
export type ButtonSize = "sm" | "md" | "lg";

/** Class string for things that must look like a button but aren't <Button> (e.g. a <label>). */
export function buttonClass({ variant = "secondary", size = "md", block, icon }: { variant?: ButtonVariant; size?: ButtonSize; block?: boolean; icon?: boolean } = {}) {
  return cx("cvb-btn", `cvb-btn-${variant}`, size !== "md" && `cvb-btn-${size}`, block && "cvb-btn-block", icon && "cvb-btn-icon");
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName | (string & {});
  iconEnd?: IconName | (string & {});
  loading?: boolean;
  block?: boolean;
  /** Renders a link styled as a button. */
  href?: string;
  target?: string;
  rel?: string;
  download?: string | boolean;
  type?: "button" | "submit" | "reset";
  ref?: Ref<HTMLButtonElement>;
};

export function Button({ variant = "secondary", size = "md", icon, iconEnd, loading, block, disabled, href, target, rel, download, type = "button", className, children, ...rest }: ButtonProps) {
  const cls = cx(buttonClass({ variant, size, block }), className);
  const iconSize = size === "sm" ? 16 : 18;
  const inner = (
    <>
      {loading ? <span className="cvb-spinner" aria-hidden="true" /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconEnd && <Icon name={iconEnd} size={iconSize} />}
    </>
  );
  if (href !== undefined && !disabled) {
    const external = /^(https?:|mailto:|tel:|blob:|data:)/.test(href) || download !== undefined || target === "_blank";
    const anchorProps = { className: cls, href, target, rel: rel ?? (target === "_blank" ? "noopener noreferrer" : undefined), download, ...(rest as AnchorHTMLAttributes<HTMLAnchorElement>) };
    return external ? <a {...anchorProps}>{inner}</a> : <UiLink {...anchorProps}>{inner}</UiLink>;
  }
  return (
    <button className={cls} type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {inner}
    </button>
  );
}

export function IconButton({ icon, label, variant = "ghost", size = "md", tooltip = true, className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: IconName | (string & {}); label: string; variant?: "ghost" | "secondary" | "primary" | "danger"; size?: ButtonSize; tooltip?: boolean }) {
  const btn = (
    <button type="button" aria-label={label} className={cx(buttonClass({ variant, size, icon: true }), className)} {...rest}>
      <Icon name={icon} size={size === "sm" ? 16 : 20} />
    </button>
  );
  if (!tooltip) return btn;
  return (
    <span className="cvb-tooltip-wrap">
      {btn}
      <span className="cvb-tooltip" role="tooltip">
        {label}
      </span>
    </span>
  );
}

export function Kbd({ children }: { children: Node }) {
  return <kbd className="cvb-kbd">{children}</kbd>;
}

export function Spinner({ size = "md", label }: { size?: "md" | "lg"; label?: string }) {
  const { labels } = useUi();
  return <span className={cx("cvb-spinner", size === "lg" && "cvb-spinner-lg")} role="status" aria-label={label ?? labels.loading} />;
}

/* ─── Badges, chips, avatars ───────────────────────────────────── */

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "highlight";

export function Badge({ tone = "neutral", variant = "soft", pill, icon, dot, className, title, children }: { tone?: Tone; variant?: "soft" | "solid" | "outline"; pill?: boolean; icon?: IconName | (string & {}); dot?: boolean; className?: string; title?: string; children: Node }) {
  return (
    <span title={title} className={cx("cvb-badge", tone !== "neutral" && `cvb-badge-${tone}`, variant !== "soft" && `cvb-badge-${variant}`, pill && "cvb-badge-pill", className)}>
      {dot && <span className="cvb-dot" aria-hidden="true" />}
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

export type Tier = "basic" | "standard" | "premium" | "executive";
const TIER_LABEL: Record<Tier, string> = { basic: "Basic", standard: "Standard", premium: "Premium", executive: "Executive" };

/** Small pill naming a template's or plan's tier. Premium and Executive get a spark. */
export function TierBadge({ tier, label, className }: { tier: Tier; label?: string; className?: string }) {
  return (
    <span className={cx("cvb-badge", `cvb-tier-${tier}`, className)}>
      {(tier === "premium" || tier === "executive") && <Icon name="sparkle" size={14} />}
      {label ?? TIER_LABEL[tier]}
    </span>
  );
}

export function Chip({ selected, onRemove, removeLabel, icon, className, children, onClick, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { selected?: boolean; onRemove?: () => void; removeLabel?: string; icon?: IconName | (string & {}); children: Node }) {
  const { labels } = useUi();
  return (
    <span className="cvb-chip-wrap">
      <button type="button" className={cx("cvb-chip", className)} aria-pressed={selected ?? undefined} onClick={onClick} {...rest}>
        {selected ? <Icon name="check" size={16} /> : icon && <Icon name={icon} size={16} />}
        {children}
      </button>
      {onRemove && (
        <button type="button" className="cvb-chip-remove" aria-label={removeLabel ?? labels.remove} onClick={onRemove}>
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

export function Avatar({ name, src, size = "md", shape = "circle", className }: { name: string; src?: string | null; size?: "sm" | "md" | "lg"; shape?: "circle" | "square"; className?: string }) {
  return (
    <span className={cx("cvb-avatar", size !== "md" && `cvb-avatar-${size}`, shape === "square" && "cvb-avatar-square", className)} title={name}>
      {src ? <img src={src} alt="" /> : <span aria-hidden="true">{initials(name)}</span>}
      <span className="cvb-sr">{name}</span>
    </span>
  );
}

export function AvatarStack({ names, max = 3, size = "sm" }: { names: string[]; max?: number; size?: "sm" | "md" }) {
  return (
    <span className="cvb-avatar-stack">
      {names.slice(0, max).map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {names.length > max && <Avatar name={`+${names.length - max}`} size={size} />}
    </span>
  );
}

/* ─── Form fields ──────────────────────────────────────────────── */

type FieldBase = { label?: Node; hint?: Node; error?: Node; required?: boolean; optional?: boolean; id?: string; className?: string };

/** Label, control slot, and the hint or error under it. Use it to wrap custom controls. */
export function Field({ label, hint, error, required, optional, htmlFor, className, children }: Omit<FieldBase, "id"> & { htmlFor?: string; children: Node }) {
  const { labels } = useUi();
  return (
    <div className={cx("cvb-field", className)}>
      {label && (
        <label className="cvb-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="cvb-label-req" aria-hidden="true">
              *
            </span>
          )}
          {optional && <span className="cvb-label-opt">{labels.optional}</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="cvb-error" id={htmlFor && `${htmlFor}-msg`} role="alert">
          <Icon name="alert-triangle" size={14} /> {error}
        </span>
      ) : (
        hint && (
          <span className="cvb-hint" id={htmlFor && `${htmlFor}-msg`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}

export type TextFieldProps = FieldBase & { prefix?: Node; suffix?: Node; icon?: IconName | (string & {}); size?: "sm" | "md"; inputClassName?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix" | "size" | "className">;

export function TextField({ label, hint, error, required, optional, id, prefix, suffix, icon, size = "md", disabled, className, inputClassName, ...input }: TextFieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const control = (
    <div className={cx("cvb-control", size === "sm" && "cvb-control-sm")} data-invalid={error ? "" : undefined} data-disabled={disabled ? "" : undefined}>
      {icon && <Icon name={icon} size={18} className="cvb-control-icon" />}
      {prefix && <span className="cvb-affix">{prefix}</span>}
      <input id={fid} required={required} disabled={disabled} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${fid}-msg` : undefined} className={inputClassName} {...input} />
      {suffix && <span className="cvb-affix">{suffix}</span>}
    </div>
  );
  if (!label && !hint && !error) return <div className={className}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} htmlFor={fid} className={className}>
      {control}
    </Field>
  );
}

export function TextArea({ label, hint, error, required, optional, id, maxLength, showCount, rows = 4, className, value, defaultValue, onChange, ...rest }: FieldBase & { showCount?: boolean } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">) {
  const auto = useId();
  const fid = id ?? auto;
  const [len, setLen] = useState(String(value ?? defaultValue ?? "").length);
  const count = value !== undefined ? String(value).length : len;
  const control = (
    <div className="cvb-control cvb-control-area" data-invalid={error ? "" : undefined}>
      <textarea
        id={fid}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${fid}-msg` : undefined}
        onChange={(e) => {
          setLen(e.target.value.length);
          onChange?.(e);
        }}
        {...rest}
      />
      {(showCount || maxLength) && (
        <span className="cvb-counter">
          {count}
          {maxLength ? `/${maxLength}` : ""}
        </span>
      )}
    </div>
  );
  if (!label && !hint && !error) return <div className={className}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} htmlFor={fid} className={className}>
      {control}
    </Field>
  );
}

export type SelectOption = string | { value: string; label: Node; disabled?: boolean };

export function Select({ label, hint, error, required, optional, id, options, size = "md", className, children, ...rest }: FieldBase & { options?: SelectOption[]; size?: "sm" | "md" } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size" | "className">) {
  const auto = useId();
  const fid = id ?? auto;
  const control = (
    <div className={cx("cvb-control cvb-control-select", size === "sm" && "cvb-control-sm")} data-invalid={error ? "" : undefined} data-disabled={rest.disabled ? "" : undefined}>
      <select id={fid} required={required} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${fid}-msg` : undefined} {...rest}>
        {options?.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value} disabled={"disabled" in opt ? opt.disabled : undefined}>
              {opt.label as string}
            </option>
          );
        })}
        {children}
      </select>
      <Icon name="chevron-down" size={16} />
    </div>
  );
  if (!label && !hint && !error) return <div className={className}>{control}</div>;
  return (
    <Field label={label} hint={hint} error={error} required={required} optional={optional} htmlFor={fid} className={className}>
      {control}
    </Field>
  );
}

export function Checkbox({ label, description, indeterminate, className, ...input }: { label: Node; description?: Node; indeterminate?: boolean; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <label className={cx("cvb-check", className)}>
      <input
        type="checkbox"
        ref={(el) => {
          if (el) el.indeterminate = Boolean(indeterminate);
        }}
        {...input}
      />
      <span>
        {label}
        {description && <span className="cvb-check-desc">{description}</span>}
      </span>
    </label>
  );
}

export function RadioGroup<V extends string>({ legend, name, options, value, defaultValue, onChange, orientation = "vertical", className }: { legend: Node; name: string; options: { value: V; label: Node; description?: Node; disabled?: boolean }[]; value?: V; defaultValue?: V; onChange?: (v: V) => void; orientation?: "vertical" | "horizontal"; className?: string }) {
  return (
    <fieldset className={cx("cvb-fieldset", className)}>
      <legend className="cvb-legend">{legend}</legend>
      <div className={cx("cvb-fieldset", orientation === "horizontal" && "cvb-fieldset-row")}>
        {options.map((o) => (
          <label key={o.value} className="cvb-check">
            <input
              type="radio"
              name={name}
              value={o.value}
              disabled={o.disabled}
              checked={value !== undefined ? value === o.value : undefined}
              defaultChecked={value === undefined ? o.value === defaultValue : undefined}
              onChange={() => onChange?.(o.value)}
            />
            <span>
              {o.label}
              {o.description && <span className="cvb-check-desc">{o.description}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Switch({ label, checked, defaultChecked = false, onChange, disabled, className, "aria-label": ariaLabel }: { label?: Node; checked?: boolean; defaultChecked?: boolean; onChange?: (on: boolean) => void; disabled?: boolean; className?: string; "aria-label"?: string }) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      className={cx("cvb-switch", className)}
      onClick={() => {
        setInner(!on);
        onChange?.(!on);
      }}
    >
      <span className="cvb-switch-track" aria-hidden="true" />
      {label}
    </button>
  );
}

export function SegmentedControl<V extends string>({ options, value, defaultValue, onChange, label, size = "md", block, className }: { options: { value: V; label: Node; icon?: IconName | (string & {}); disabled?: boolean }[]; value?: V; defaultValue?: V; onChange?: (v: V) => void; label: string; size?: "sm" | "md"; block?: boolean; className?: string }) {
  const [inner, setInner] = useState<V | undefined>(defaultValue ?? options[0]?.value);
  const v = value ?? inner;
  return (
    <div className={cx("cvb-segmented", size === "sm" && "cvb-segmented-sm", block && "cvb-segmented-block", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={v === o.value}
          disabled={o.disabled}
          onClick={() => {
            setInner(o.value);
            onChange?.(o.value);
          }}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ shortcut, label = "Search", className, ...input }: { shortcut?: string; label?: string; className?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  return (
    <div className={cx("cvb-control cvb-search", className)}>
      <Icon name="search" size={18} className="cvb-control-icon" />
      <input type="search" aria-label={label} placeholder={label} {...input} />
      {shortcut && <Kbd>{shortcut}</Kbd>}
    </div>
  );
}

/** A drop zone with a file button. Calls onFiles with what was dropped or chosen. */
export function FileDrop({ title = "Drop your CV here", hint = "PDF or Word, up to 5 MB", button, accept, multiple, disabled, busy, onFiles, className, children }: { title?: Node; hint?: Node; button?: Node; accept?: string; multiple?: boolean; disabled?: boolean; busy?: boolean; onFiles: (files: File[]) => void; className?: string; children?: Node }) {
  const { labels } = useUi();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={cx("cvb-drop", className)}
      data-state={over ? "over" : busy ? "busy" : "idle"}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <span className="cvb-drop-icon">{busy ? <span className="cvb-spinner" aria-hidden="true" /> : <Icon name="upload" size={22} />}</span>
      <strong>{title}</strong>
      {hint && <span className="cvb-hint">{hint}</span>}
      <Button size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
        {button ?? labels.chooseFile}
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      {children}
    </div>
  );
}

export function FileRow({ name, size, status, onRemove }: { name: Node; size?: Node; status?: Node; onRemove?: () => void }) {
  const { labels } = useUi();
  return (
    <div className="cvb-file">
      <Icon name="file" size={20} className="cvb-control-icon" />
      <span className="cvb-file-name">{name}</span>
      {size && <span className="cvb-caption cvb-num">{size}</span>}
      {status}
      {onRemove && <IconButton icon="x" label={labels.remove} size="sm" onClick={onRemove} />}
    </div>
  );
}

export function ColorSwatches({ colors, value, defaultValue, onChange, label = "Accent colour", className }: { colors: { value: string; name: string }[]; value?: string; defaultValue?: string; onChange?: (v: string) => void; label?: string; className?: string }) {
  const [inner, setInner] = useState(defaultValue ?? colors[0]?.value);
  const v = value ?? inner;
  return (
    <div className={cx("cvb-swatches", className)} role="radiogroup" aria-label={label}>
      {colors.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={v?.toLowerCase() === c.value.toLowerCase()}
          aria-label={c.name}
          title={c.name}
          className="cvb-swatch"
          style={{ background: c.value }}
          onClick={() => {
            setInner(c.value);
            onChange?.(c.value);
          }}
        />
      ))}
    </div>
  );
}

export function Stars({ value, max = 5, size = 16, onRate, label }: { value: number; max?: number; size?: number; onRate?: (n: number) => void; label?: string }) {
  const items = Array.from({ length: max }, (_, i) => i + 1);
  if (!onRate)
    return (
      <span className="cvb-stars" role="img" aria-label={label ?? `Rated ${value} out of ${max}`}>
        {items.map((n) => (
          <Icon key={n} name="star" size={size} className={n <= Math.round(value) ? "cvb-star-on" : "cvb-star-off"} />
        ))}
      </span>
    );
  return (
    <span className="cvb-stars" role="radiogroup" aria-label={label ?? "Rating"}>
      {items.map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => onRate(n)}>
          <Icon name="star" size={size + 6} className={n <= value ? "cvb-star-on" : "cvb-star-off"} />
        </button>
      ))}
    </span>
  );
}

/* ─── Navigation ───────────────────────────────────────────────── */

export type NavLink = { href: string; label: Node; current?: boolean; icon?: IconName | (string & {}); count?: Node };

/** The global bar: a blue band in light, a dark bar in dark. `end` holds the inline-end controls. */
export function AppBar({ links, end, start, product = "CV Builder", logoHref = "/", logoSrc, label }: { links: NavLink[]; end?: Node; start?: Node; product?: string; logoHref?: string; logoSrc?: string | null; label?: string }) {
  const { labels } = useUi();
  return (
    <header className="cvb-appbar">
      <div className="cvb-appbar-inner">
        {start}
        <Logo product={product} href={logoHref} logoSrc={logoSrc} />
        <nav className="cvb-appbar-nav" aria-label={label ?? labels.mainNav}>
          {links.map((l) => (
            <UiLink key={l.href} className="cvb-appbar-link" href={l.href} aria-current={l.current ? "page" : undefined}>
              {l.label}
            </UiLink>
          ))}
        </nav>
        <div className="cvb-appbar-end">{end}</div>
      </div>
    </header>
  );
}

export function SideNav({ label = "Section", groups, className }: { label?: string; groups: { title?: Node; items: NavLink[] }[]; className?: string }) {
  return (
    <nav className={cx("cvb-sidenav", className)} aria-label={label}>
      {groups.map((g, i) => (
        <div key={i} className="cvb-sidenav-group">
          {g.title && <div className="cvb-overline cvb-sidenav-title">{g.title}</div>}
          {g.items.map((l) => (
            <UiLink key={l.href} className="cvb-sidenav-link" href={l.href} aria-current={l.current ? "page" : undefined}>
              {l.icon && <Icon name={l.icon} size={18} />}
              <span className="cvb-sidenav-label">{l.label}</span>
              {l.count !== undefined && <span className="cvb-sidenav-count">{l.count}</span>}
            </UiLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

export type TabItem<V extends string = string> = { id: V; label: Node; count?: Node; icon?: IconName | (string & {}); href?: string };

/** Tabs. Pass `href` on items to make them links (URL is state), or `value`/`onChange` for local state. */
export function Tabs<V extends string>({ items, value, defaultValue, onChange, label, className }: { items: TabItem<V>[]; value?: V; defaultValue?: V; onChange?: (v: V) => void; label: string; className?: string }) {
  const [inner, setInner] = useState<V | undefined>(defaultValue ?? items[0]?.id);
  const v = value ?? inner;
  const refs = useRef<(HTMLElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + items.length) % items.length;
    refs.current[n]?.focus();
    const it = items[n];
    if (it && !it.href) {
      setInner(it.id);
      onChange?.(it.id);
    }
  };
  return (
    <div className={cx("cvb-tabs", className)} role="tablist" aria-label={label}>
      {items.map((t, i) => {
        const selected = v === t.id;
        const body = (
          <>
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.label}
            {t.count !== undefined && <span className="cvb-tab-count">{t.count}</span>}
          </>
        );
        const onKeyDown = (e: KeyboardEvent) => {
          const rtl = (e.currentTarget as HTMLElement).closest("[dir=rtl]");
          if (e.key === "ArrowRight") move(rtl ? i - 1 : i + 1);
          else if (e.key === "ArrowLeft") move(rtl ? i + 1 : i - 1);
          else return;
          e.preventDefault();
        };
        return t.href ? (
          <UiLink key={t.id} href={t.href} role="tab" className="cvb-tab" aria-selected={selected} tabIndex={selected ? 0 : -1} onKeyDown={onKeyDown} ref={(el: HTMLAnchorElement | null) => void (refs.current[i] = el)}>
            {body}
          </UiLink>
        ) : (
          <button
            key={t.id}
            ref={(el) => void (refs.current[i] = el)}
            type="button"
            role="tab"
            className="cvb-tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              setInner(t.id);
              onChange?.(t.id);
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { href?: string; label: Node }[] }) {
  const { labels } = useUi();
  return (
    <nav className="cvb-breadcrumbs" aria-label={labels.breadcrumb}>
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            {i > 0 && <Icon name="chevron-right" size={14} />}
            {it.href && i < items.length - 1 ? <UiLink href={it.href}>{it.label}</UiLink> : <span aria-current="page">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BackLink({ href, children }: { href: string; children: Node }) {
  return (
    <UiLink className="cvb-backlink" href={href}>
      <Icon name="arrow-left" size={16} />
      {children}
    </UiLink>
  );
}

export function PageHeader({ back, breadcrumbs, eyebrow, title, description, actions, className }: { back?: { href: string; label: Node }; breadcrumbs?: { href?: string; label: Node }[]; eyebrow?: Node; title: Node; description?: Node; actions?: Node; className?: string }) {
  return (
    <div className={cx("cvb-pageheader-wrap", className)}>
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="cvb-pageheader">
        <div className="cvb-pageheader-text">
          {eyebrow && <span className="cvb-overline">{eyebrow}</span>}
          <h1 className="cvb-h1">{title}</h1>
          {description && <p className="cvb-pageheader-desc">{description}</p>}
        </div>
        {actions && <div className="cvb-pageheader-actions">{actions}</div>}
      </div>
    </div>
  );
}

export type Step = { id?: string; label: Node; meta?: Node; icon: IconName | (string & {}); status: "done" | "current" | "todo" };

export function StepRail({ steps, label = "CV steps", onSelect, compact }: { steps: Step[]; label?: string; onSelect?: (index: number) => void; compact?: boolean }) {
  return (
    <nav aria-label={label}>
      <ol className={cx("cvb-steps", compact && "cvb-steps-compact")}>
        {steps.map((s, i) => (
          <li key={s.id ?? i}>
            <button type="button" className="cvb-step" data-status={s.status} aria-current={s.status === "current" ? "step" : undefined} onClick={() => onSelect?.(i)} title={compact && typeof s.label === "string" ? s.label : undefined}>
              <span className="cvb-step-bullet">
                <Icon name={s.status === "done" ? "check" : s.icon} size={16} />
              </span>
              <span className="cvb-step-text">
                <span className="cvb-step-label">{s.label}</span>
                {s.meta && <span className="cvb-step-meta">{s.meta}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const { labels } = useUi();
  const list = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="cvb-pagination" aria-label={labels.pages}>
      <IconButton icon="chevron-left" label={labels.previousPage} disabled={page <= 1} onClick={() => onChange(page - 1)} />
      {list.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - list[i - 1]! > 1 && <span className="cvb-muted">…</span>}
          <button type="button" className="cvb-page" aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}>
            {n}
          </button>
        </span>
      ))}
      <IconButton icon="chevron-right" label={labels.nextPage} disabled={page >= pages} onClick={() => onChange(page + 1)} />
    </nav>
  );
}

export type ThemeChoice = "light" | "dark" | "system";

export function ThemeToggle({ value, onChange, size = "sm" }: { value: ThemeChoice; onChange: (v: ThemeChoice) => void; size?: "sm" | "md" }) {
  const { labels } = useUi();
  const opt = (v: ThemeChoice, icon: IconName, text: string) => ({ value: v, icon, label: <span className="cvb-sr">{text}</span> });
  return (
    <SegmentedControl<ThemeChoice>
      label={labels.theme}
      size={size}
      value={value}
      onChange={onChange}
      className="cvb-theme-toggle"
      options={[opt("light", "sun", labels.themeLight), opt("dark", "moon", labels.themeDark), opt("system", "monitor", labels.themeSystem)]}
    />
  );
}

export function LanguageSwitcher<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[] }) {
  const { labels } = useUi();
  return (
    <label className="cvb-lang">
      <span className="cvb-sr">{labels.language}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => (
          <option key={o.value} value={o.value} lang={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} />
    </label>
  );
}

/* ─── Surfaces ─────────────────────────────────────────────────── */

export function Card({ title, description, actions, footer, children, interactive, selected, flush, className, style, id, as: Tag = "section", onClick }: { title?: Node; description?: Node; actions?: Node; footer?: Node; children?: Node; interactive?: boolean; selected?: boolean; flush?: boolean; className?: string; style?: CSSProperties; id?: string; as?: "section" | "div" | "article" | "li"; onClick?: () => void }) {
  return (
    <Tag id={id} className={cx("cvb-card", interactive && "cvb-card-interactive", selected && "cvb-card-selected", className)} tabIndex={interactive ? 0 : undefined} style={style} onClick={onClick}>
      {(title || actions) && (
        <div className="cvb-card-head">
          <div className="cvb-card-head-text">
            {title && <h3 className="cvb-h3">{title}</h3>}
            {description && <p className="cvb-card-desc">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children !== undefined && children !== null && children !== false && <div className={flush ? "cvb-card-flush" : "cvb-card-body"}>{children}</div>}
      {footer && <div className="cvb-card-foot">{footer}</div>}
    </Tag>
  );
}

export function StatTile({ label, value, delta, hint, icon }: { label: Node; value: Node; delta?: { value: Node; dir: "up" | "down" }; hint?: Node; icon?: IconName | (string & {}) }) {
  return (
    <div className="cvb-stat">
      <span className="cvb-overline cvb-stat-label">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </span>
      <span className="cvb-stat-value">{value}</span>
      {(delta || hint) && (
        <span className="cvb-row" style={{ gap: 8 }}>
          {delta && (
            <span className="cvb-stat-delta" data-dir={delta.dir}>
              <Icon name={delta.dir === "up" ? "chevron-up" : "chevron-down"} size={14} />
              {delta.value}
            </span>
          )}
          {hint && <span className="cvb-caption">{hint}</span>}
        </span>
      )}
    </div>
  );
}

export type Column<R> = { key: string; label: Node; numeric?: boolean; width?: number | string; render?: (row: R) => Node };

export function DataTable<R>({ columns, rows, caption, rowKey, onRowClick, empty }: { columns: Column<R>[]; rows: R[]; caption?: string; rowKey?: (row: R, i: number) => string; onRowClick?: (row: R) => void; empty?: Node }) {
  return (
    <div className="cvb-table-wrap">
      <table className="cvb-table">
        {caption && <caption className="cvb-sr">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" style={{ textAlign: c.numeric ? "end" : undefined, width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="cvb-table-empty">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={rowKey ? rowKey(r, i) : i} onClick={onRowClick ? () => onRowClick(r) : undefined} data-clickable={onRowClick ? "" : undefined}>
                {columns.map((c, j) => (
                  <td key={c.key} className={cx(c.numeric && "cvb-num", j === 0 && "cvb-table-primary")}>
                    {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: Node; value: Node }[]; className?: string }) {
  return (
    <dl className={cx("cvb-kv", className)}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{it.label}</dt>
          <dd>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ─── Feedback ─────────────────────────────────────────────────── */

export type AlertTone = "info" | "success" | "warning" | "danger" | "highlight";
const TONE_ICON: Record<AlertTone, IconName> = { info: "info", success: "check-circle", warning: "alert-triangle", danger: "x-circle", highlight: "sparkle" };

export function Alert({ tone = "info", title, children, actions, onDismiss, banner, icon, className }: { tone?: AlertTone; title?: Node; children?: Node; actions?: Node; onDismiss?: () => void; banner?: boolean; icon?: IconName | (string & {}); className?: string }) {
  const { labels } = useUi();
  return (
    <div className={cx("cvb-alert", tone !== "info" && `cvb-alert-${tone}`, banner && "cvb-alert-banner", className)} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={icon ?? TONE_ICON[tone]} size={20} />
      <div className="cvb-alert-body">
        {title && <span className="cvb-alert-title">{title}</span>}
        {children && <div className="cvb-alert-text">{children}</div>}
        {actions && <div className="cvb-alert-actions">{actions}</div>}
      </div>
      {onDismiss && <IconButton icon="x" label={labels.dismiss} size="sm" tooltip={false} onClick={onDismiss} />}
    </div>
  );
}

export function Toast({ tone = "neutral", children, action, onDismiss }: { tone?: "neutral" | "success" | "danger"; children: Node; action?: { label: Node; onClick?: () => void }; onDismiss?: () => void }) {
  const { labels } = useUi();
  return (
    <div className={cx("cvb-toast", tone !== "neutral" && `cvb-toast-${tone}`)} role="status">
      <Icon name={tone === "success" ? "check-circle" : tone === "danger" ? "x-circle" : "info"} size={18} />
      <span className="cvb-toast-text">{children}</span>
      {action && (
        <button type="button" className="cvb-btn cvb-btn-ghost cvb-btn-sm" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      {onDismiss && <IconButton icon="x" label={labels.dismiss} size="sm" tooltip={false} onClick={onDismiss} />}
    </div>
  );
}

export function ProgressBar({ value, max = 100, label, valueLabel, tone = "brand", className }: { value: number; max?: number; label?: Node; valueLabel?: Node; tone?: "brand" | "success" | "warning" | "danger" | "highlight"; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx("cvb-progress", className)} data-tone={tone}>
      {(label || valueLabel) && (
        <div className="cvb-progress-head">
          <span>{label}</span>
          <span className="cvb-num">{valueLabel ?? `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div className="cvb-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={typeof label === "string" ? label : undefined}>
        <div className="cvb-progress-bar" style={{ inlineSize: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ value, size = "md", label, tone, children }: { value: number; size?: "sm" | "md" | "lg"; label?: string; tone?: "brand" | "success" | "warning" | "danger"; children?: Node }) {
  const px = size === "sm" ? 40 : size === "lg" ? 112 : 64;
  const stroke = size === "lg" ? 9 : size === "sm" ? 4 : 6;
  const r = (px - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const t = tone ?? (v >= 80 ? "success" : v >= 50 ? "brand" : "warning");
  return (
    <span className={cx("cvb-ring", size === "lg" && "cvb-ring-lg", size === "sm" && "cvb-ring-sm")} data-tone={t} role="img" aria-label={label ?? `${Math.round(v)} out of 100`} style={{ width: px, height: px }}>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`}>
        <circle className="cvb-ring-track" cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="cvb-ring-fill" cx={px / 2} cy={px / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="cvb-ring-label">{children ?? Math.round(v)}</span>
    </span>
  );
}

export function Skeleton({ width = "100%", height = 12, shape = "line", className }: { width?: number | string; height?: number | string; shape?: "line" | "circle" | "block"; className?: string }) {
  return <span className={cx("cvb-skeleton", className)} aria-hidden="true" style={{ width, height, borderRadius: shape === "circle" ? 9999 : shape === "block" ? "var(--radius-lg)" : undefined }} />;
}

export function EmptyState({ icon = "file", title, children, actions, size = "md", className }: { icon?: IconName | (string & {}); title: Node; children?: Node; actions?: Node; size?: "sm" | "md"; className?: string }) {
  return (
    <div className={cx("cvb-empty", size === "sm" && "cvb-empty-sm", className)}>
      <span className="cvb-empty-art">
        <Icon name={icon} size={size === "sm" ? 22 : 28} />
      </span>
      <h3 className={size === "sm" ? "cvb-h3" : "cvb-h2"}>{title}</h3>
      {children && <div className="cvb-empty-text">{children}</div>}
      {actions && <div className="cvb-empty-actions">{actions}</div>}
    </div>
  );
}

export function Tooltip({ content, children, open }: { content: Node; children: Node; open?: boolean }) {
  return (
    <span className="cvb-tooltip-wrap">
      {children}
      <span className="cvb-tooltip" role="tooltip" data-open={open ? "" : undefined}>
        {content}
      </span>
    </span>
  );
}

/* ─── Overlays ─────────────────────────────────────────────────── */

function useOverlay(open: boolean, onClose: () => void, panel: RefObject<HTMLElement | null>) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), select, textarea, button:not([data-close])")?.focus(), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, panel]);
}

function Portal({ children }: { children: Node }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}

export type DialogProps = { open: boolean; onClose: () => void; title: Node; description?: Node; children?: Node; footer?: Node; size?: "sm" | "md" | "lg" | "xl"; dismissible?: boolean };

/** Modal dialog: Escape and the backdrop close it, Tab stays inside, focus comes back on close. */
export function Dialog({ open, onClose, title, description, children, footer, size = "md", dismissible = true }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const { labels } = useUi();
  const close = useCallback(() => dismissible && onClose(), [dismissible, onClose]);
  useOverlay(open, close, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="cvb-scrim no-print" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <div ref={panel} className={cx("cvb-dialog", size !== "md" && `cvb-dialog-${size}`)} role="dialog" aria-modal="true" aria-labelledby={id}>
          <div className="cvb-dialog-head">
            <div className="cvb-dialog-title">
              <h2 className="cvb-h2" id={id}>
                {title}
              </h2>
              {description && <p className="cvb-muted">{description}</p>}
            </div>
            {dismissible && <IconButton icon="x" label={labels.close} size="sm" tooltip={false} data-close="" onClick={onClose} />}
          </div>
          {children !== undefined && <div className="cvb-dialog-body">{children}</div>}
          {footer && <div className="cvb-dialog-foot">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

export function Drawer({ open, onClose, title, description, children, footer, actions }: { open: boolean; onClose: () => void; title: Node; description?: Node; children?: Node; footer?: Node; actions?: Node }) {
  const id = useId();
  const panel = useRef<HTMLElement>(null);
  const { labels } = useUi();
  useOverlay(open, onClose, panel);
  if (!open) return null;
  return (
    <Portal>
      <div className="cvb-scrim cvb-scrim-drawer no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <aside ref={panel} className="cvb-drawer" role="dialog" aria-modal="true" aria-labelledby={id}>
          <div className="cvb-drawer-head">
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cvb-h2" id={id}>
                {title}
              </h2>
              {description && <p className="cvb-muted">{description}</p>}
            </div>
            {actions}
            <IconButton icon="x" label={labels.close} tooltip={false} data-close="" onClick={onClose} />
          </div>
          <div className="cvb-drawer-body">{children}</div>
          {footer && <div className="cvb-drawer-foot">{footer}</div>}
        </aside>
      </div>
    </Portal>
  );
}

export type MenuItem =
  | { label: Node; icon?: IconName | (string & {}); shortcut?: string; danger?: boolean; checked?: boolean; href?: string; disabled?: boolean; onSelect?: () => void }
  | "separator"
  | { heading: Node };

export function Menu({ items, label = "Menu", onDone, className }: { items: MenuItem[]; label?: string; onDone?: () => void; className?: string }) {
  return (
    <div className={cx("cvb-menu", className)} role="menu" aria-label={label}>
      {items.map((it, i) => {
        if (it === "separator") return <div key={i} className="cvb-menu-sep" role="separator" />;
        if ("heading" in it)
          return (
            <div key={i} className="cvb-overline cvb-menu-label">
              {it.heading}
            </div>
          );
        const body = (
          <>
            {it.icon && <Icon name={it.icon} size={18} />}
            <span className="cvb-menu-text">{it.label}</span>
            {it.checked && <Icon name="check" size={16} />}
            {it.shortcut && <Kbd>{it.shortcut}</Kbd>}
          </>
        );
        const common = { className: "cvb-menu-item", role: it.checked !== undefined ? "menuitemradio" : "menuitem", "aria-checked": it.checked, "data-danger": it.danger ? "" : undefined };
        return it.href ? (
          <UiLink key={i} href={it.href} {...common} onClick={() => onDone?.()}>
            {body}
          </UiLink>
        ) : (
          <button
            key={i}
            type="button"
            disabled={it.disabled}
            {...common}
            onClick={() => {
              it.onSelect?.();
              onDone?.();
            }}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** A trigger that opens a Menu (or any content) in a popover; closes on outside click and Escape. */
export function Dropdown({ trigger, children, items, align = "end", label = "Menu", popup = "menu", className }: { popup?: "menu" | "dialog" | "listbox"; trigger: (props: { open: boolean; toggle: () => void; "aria-expanded": boolean; "aria-haspopup": "menu" | "dialog" | "listbox" }) => Node; children?: Node | ((close: () => void) => Node); items?: MenuItem[]; align?: "start" | "end"; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as globalThis.Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className={cx("cvb-dropdown", className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o), "aria-expanded": open, "aria-haspopup": popup })}
      {open && (
        <div className="cvb-dropdown-pop" data-align={align}>
          {items ? <Menu items={items} label={label} onDone={close} /> : typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}

/* ─── Product ──────────────────────────────────────────────────── */

export function PaperSheet({ accent = "#004494", size = "a4", children, maxWidth, className }: { accent?: string; size?: "a4" | "letter"; children?: Node; maxWidth?: number | string; className?: string }) {
  return (
    <div className={cx("cvb-paper", className)} data-size={size} style={{ ["--sheet-accent" as string]: accent, maxWidth } as CSSProperties}>
      {children ?? (
        <div className="cvb-sheet-mock" aria-hidden="true">
          <span className="n" />
          <span className="l" style={{ width: "40%" }} />
          <span className="h" />
          {[92, 86, 90, 60].map((w, i) => (
            <span key={i} className="l" style={{ width: `${w}%` }} />
          ))}
          <span className="h" />
          {[88, 94, 70, 84, 52].map((w, i) => (
            <span key={i} className="l" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PreviewCanvas({ children, className }: { children: Node; className?: string }) {
  return <div className={cx("cvb-canvas", className)}>{children}</div>;
}

export function MatchScore({ score, label }: { score: number; label?: Node }) {
  const level = score >= 70 ? "strong" : score >= 45 ? "partial" : "weak";
  return (
    <span className="cvb-match" data-level={level}>
      <span className="cvb-match-meter" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <bdi className="cvb-num">{label ?? `${Math.round(score)}% match`}</bdi>
    </span>
  );
}

export function KeywordList({ found = [], missing = [], required = [] }: { found?: string[]; missing?: string[]; required?: string[] }) {
  return (
    <div className="cvb-keywords">
      {found.map((k) => (
        <span key={`f-${k}`} className="cvb-keyword" data-found="">
          <Icon name="check" size={12} /> {k}
        </span>
      ))}
      {missing.map((k) => (
        <span key={`m-${k}`} className="cvb-keyword" data-missing="" data-required={required.includes(k) ? "" : undefined}>
          {k}
        </span>
      ))}
    </div>
  );
}

export type Stage = "saved" | "applied" | "interview" | "offer" | "rejected";

export function StageDot({ stage }: { stage: Stage }) {
  return <span className="cvb-dot" aria-hidden="true" style={{ background: `var(--stage-${stage})` }} />;
}

export function Timeline({ items }: { items: { title: Node; meta?: Node; state: "done" | "current" | "todo" }[] }) {
  return (
    <ol className="cvb-timeline">
      {items.map((it, i) => (
        <li key={i} data-state={it.state}>
          <span className="cvb-timeline-dot">{it.state === "done" && <Icon name="check" size={14} />}</span>
          <div className="cvb-timeline-text">
            <span className="cvb-timeline-title">{it.title}</span>
            {it.meta && <span className="cvb-caption">{it.meta}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Highlights [placeholders] in AI text so people notice what to fill in. */
export function markPlaceholders(s: string): Node {
  return s.split(/(\[[^\]]+\])/g).map((part, i) => (part.startsWith("[") ? (
    <span key={i} className="cvb-placeholder">
      {part}
    </span>
  ) : (
    part
  )));
}
