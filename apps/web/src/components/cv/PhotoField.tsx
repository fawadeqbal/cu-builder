"use client";

import { regionRules, showPhoto, type CV, type PhotoShape } from "@cvb/domain";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useT } from "@/lib/i18n";
import { Dialog } from "../ui/Dialog";
import { btn } from "../ui/styles";

const OUT = 400; // output size in px (square)
const MAX_CHARS = 200_000; // ≈ 150 KB of JPEG as a data URL
const VIEW = 260; // crop viewport in px

/** Draws the visible square of the image to a 400 px JPEG, lowering quality until it's small enough. */
export function exportCrop(img: HTMLImageElement, crop: { x: number; y: number; zoom: number }, view = VIEW): string {
  const canvas = document.createElement("canvas");
  canvas.width = OUT;
  canvas.height = OUT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, OUT, OUT);
  // Base scale fits the shorter side to the viewport; zoom enlarges from there.
  const base = view / Math.min(img.naturalWidth, img.naturalHeight);
  const scale = base * crop.zoom * (OUT / view);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, OUT / 2 - w / 2 + crop.x * (OUT / view), OUT / 2 - h / 2 + crop.y * (OUT / view), w, h);
  for (const q of [0.88, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", q);
    if (url.length <= MAX_CHARS) return url;
  }
  return canvas.toDataURL("image/jpeg", 0.3);
}

/** Profile photo: upload, crop to a square, choose the shape and whether it shows. */
export function PhotoField({ cv, onChange }: { cv: CV; onChange: (cv: CV) => void }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState("");
  const rules = regionRules(cv.settings.region);
  const setPhoto = (patch: Partial<CV["settings"]["photo"]>) => onChange({ ...cv, settings: { ...cv.settings, photo: { ...cv.settings.photo, ...patch } } });

  function pick(file: File | undefined) {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) return setError(t("photo.tooLarge"));
    const reader = new FileReader();
    reader.onload = () => setSource(String(reader.result));
    reader.readAsDataURL(file);
  }

  const shapeClass = { circle: "rounded-full", rounded: "rounded-xl", square: "rounded-none" }[cv.settings.photo.shape];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className={`grid size-20 shrink-0 place-items-center overflow-hidden bg-stone-100 ring-1 ring-stone-200 ${shapeClass}`}>
        {cv.photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL
          <img src={cv.photo} alt="" className="size-full object-cover" />
        ) : (
          <span className="text-xs text-stone-400">{t("photo.title")}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn.secondary} onClick={() => input.current?.click()}>
            {cv.photo ? t("photo.change") : t("photo.upload")}
          </button>
          {cv.photo && (
            <button type="button" className={btn.ghost} onClick={() => onChange({ ...cv, photo: "" })}>
              {t("photo.remove")}
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {cv.photo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-stone-700">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand" checked={cv.settings.photo.show} onChange={(e) => setPhoto({ show: e.target.checked })} />
              {t("photo.show")}
            </label>
            <label className="flex items-center gap-2">
              <span className="text-stone-500">{t("photo.shape")}</span>
              <select
                className="rounded-md border border-stone-200 bg-white px-2 py-1 text-sm"
                value={cv.settings.photo.shape}
                onChange={(e) => setPhoto({ shape: e.target.value as PhotoShape })}
              >
                <option value="circle">{t("photo.circle")}</option>
                <option value="rounded">{t("photo.rounded")}</option>
                <option value="square">{t("photo.square")}</option>
              </select>
            </label>
          </div>
        )}
        {cv.photo && !showPhoto(cv) && rules.photo === "no" && (
          <p className="text-xs text-amber-700">{t("photo.hiddenByRegion", { region: t(`region.${cv.settings.region}`) })}</p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      {source && (
        <CropDialog
          source={source}
          onClose={() => setSource(null)}
          onDone={(url) => {
            setSource(null);
            onChange({ ...cv, photo: url, settings: { ...cv.settings, photo: { ...cv.settings.photo, show: true } } });
          }}
        />
      )}
    </div>
  );
}

function CropDialog({ source, onClose, onDone }: { source: string; onClose: () => void; onDone: (url: string) => void }) {
  const t = useT();
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = new Image();
    el.onload = () => setSize({ w: el.naturalWidth, h: el.naturalHeight });
    el.src = source;
  }, [source]);

  const base = size ? VIEW / Math.min(size.w, size.h) : 1;
  const w = size ? size.w * base * crop.zoom : VIEW;
  const h = size ? size.h * base * crop.zoom : VIEW;
  // Keep the image covering the square.
  const clamp = (c: { x: number; y: number; zoom: number }) => {
    const cw = (size ? size.w * base * c.zoom : VIEW) / 2 - VIEW / 2;
    const ch = (size ? size.h * base * c.zoom : VIEW) / 2 - VIEW / 2;
    return { ...c, x: Math.max(-cw, Math.min(cw, c.x)), y: Math.max(-ch, Math.min(ch, c.y)) };
  };

  const down = (e: PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (d) setCrop((c) => clamp({ ...c, x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }));
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("photo.crop")}
      description={t("photo.cropHint")}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.ghost} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="button" className={btn.primary} disabled={!size} onClick={() => img.current && onDone(exportCrop(img.current, crop))}>
            {t("photo.use")}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4" dir="ltr">
        <div
          className="relative touch-none cursor-grab overflow-hidden rounded-xl bg-stone-900 active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the local file being cropped */}
          <img
            ref={img}
            src={source}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ width: w, height: h, left: VIEW / 2 - w / 2 + crop.x, top: VIEW / 2 - h / 2 + crop.y }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.35)]" />
        </div>
        <label className="flex w-full items-center gap-3 text-sm text-stone-600">
          {t("photo.zoom")}
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={crop.zoom}
            className="flex-1 accent-brand"
            onChange={(e) => setCrop((c) => clamp({ ...c, zoom: Number(e.target.value) }))}
          />
        </label>
      </div>
    </Dialog>
  );
}
