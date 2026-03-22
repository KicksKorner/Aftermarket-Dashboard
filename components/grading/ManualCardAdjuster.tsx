"use client";

import { useEffect, useRef, useState } from "react";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DragMode = "move" | "left" | "right" | "top" | "bottom" | null;

type Props = {
  image: string;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

export default function ManualCardAdjuster({
  image,
  onConfirm,
  onCancel,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<CropRect>({
    x: 18,
    y: 12,
    width: 64,
    height: 76,
  });

  const [dragMode, setDragMode] = useState<DragMode>(null);

  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<CropRect | null>(null);

  useEffect(() => {
    setCrop({
      x: 18,
      y: 12,
      width: 64,
      height: 76,
    });
  }, [image]);

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));

  const startDrag = (mode: DragMode, clientX: number, clientY: number) => {
    setDragMode(mode);
    pointerStartRef.current = { x: clientX, y: clientY };
    cropStartRef.current = { ...crop };
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!dragMode || !pointerStartRef.current || !cropStartRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dxPct = ((clientX - pointerStartRef.current.x) / rect.width) * 100;
    const dyPct = ((clientY - pointerStartRef.current.y) / rect.height) * 100;

    const start = cropStartRef.current;
    const minWidth = 18;
    const minHeight = 25;

    let next: CropRect = { ...start };

    if (dragMode === "move") {
      next.x = clamp(start.x + dxPct, 0, 100 - start.width);
      next.y = clamp(start.y + dyPct, 0, 100 - start.height);
    }

    if (dragMode === "left") {
      const newX = clamp(start.x + dxPct, 0, start.x + start.width - minWidth);
      next.x = newX;
      next.width = start.width + (start.x - newX);
    }

    if (dragMode === "right") {
      const newWidth = clamp(start.width + dxPct, minWidth, 100 - start.x);
      next.width = newWidth;
    }

    if (dragMode === "top") {
      const newY = clamp(start.y + dyPct, 0, start.y + start.height - minHeight);
      next.y = newY;
      next.height = start.height + (start.y - newY);
    }

    if (dragMode === "bottom") {
      const newHeight = clamp(start.height + dyPct, minHeight, 100 - start.y);
      next.height = newHeight;
    }

    setCrop(next);
  };

  const stopDrag = () => {
    setDragMode(null);
    pointerStartRef.current = null;
    cropStartRef.current = null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    if (!t) return;
    handlePointerMove(t.clientX, t.clientY);
  };

  const confirmCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");

    const displayedWidth = img.clientWidth;
    const displayedHeight = img.clientHeight;

    const scaleX = img.naturalWidth / displayedWidth;
    const scaleY = img.naturalHeight / displayedHeight;

    const sx = (crop.x / 100) * displayedWidth * scaleX;
    const sy = (crop.y / 100) * displayedHeight * scaleY;
    const sw = (crop.width / 100) * displayedWidth * scaleX;
    const sh = (crop.height / 100) * displayedHeight * scaleY;

    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      img,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    onConfirm(croppedDataUrl);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-white">Adjust Card Frame</h3>
        <p className="text-sm text-slate-300">
          Drag each side of the green box to match the card edges exactly. Drag
          inside the box to move it.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-black touch-none"
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onTouchMove={handleTouchMove}
        onTouchEnd={stopDrag}
      >
        <img
          ref={imageRef}
          src={image}
          alt="Captured card"
          className="block h-auto w-full select-none"
          draggable={false}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, transparent 0, transparent 1px, rgba(0,0,0,0.45) 1px)`,
            clipPath: `polygon(
              0% 0%,
              100% 0%,
              100% 100%,
              0% 100%,
              0% 0%,
              ${crop.x}% 0%,
              ${crop.x}% ${crop.y}%,
              ${crop.x + crop.width}% ${crop.y}%,
              ${crop.x + crop.width}% ${crop.y + crop.height}%,
              ${crop.x}% ${crop.y + crop.height}%,
              ${crop.x}% ${crop.y}%,
              ${crop.x}% 0%
            )`,
          }}
        />

        <div
          className="absolute border-[3px] border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.7)]"
          style={{
            left: `${crop.x}%`,
            top: `${crop.y}%`,
            width: `${crop.width}%`,
            height: `${crop.height}%`,
            borderRadius: "18px",
          }}
        >
          <button
            type="button"
            aria-label="Move crop"
            className="absolute inset-0 cursor-move bg-transparent"
            onMouseDown={(e) => startDrag("move", e.clientX, e.clientY)}
            onTouchStart={(e) => {
              const t = e.touches[0];
              if (t) startDrag("move", t.clientX, t.clientY);
            }}
          />

          <div className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-md border-l-4 border-t-4 border-green-400" />
          <div className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-md border-r-4 border-t-4 border-green-400" />
          <div className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-md border-b-4 border-l-4 border-green-400" />
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-md border-b-4 border-r-4 border-green-400" />

          <button
            type="button"
            aria-label="Adjust left edge"
            className="absolute left-[-10px] top-1/2 h-16 w-5 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/30 bg-green-500/80"
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag("left", e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (t) startDrag("left", t.clientX, t.clientY);
            }}
          />

          <button
            type="button"
            aria-label="Adjust right edge"
            className="absolute right-[-10px] top-1/2 h-16 w-5 -translate-y-1/2 cursor-ew-resize rounded-full border border-white/30 bg-green-500/80"
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag("right", e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (t) startDrag("right", t.clientX, t.clientY);
            }}
          />

          <button
            type="button"
            aria-label="Adjust top edge"
            className="absolute left-1/2 top-[-10px] h-5 w-16 -translate-x-1/2 cursor-ns-resize rounded-full border border-white/30 bg-green-500/80"
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag("top", e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (t) startDrag("top", t.clientX, t.clientY);
            }}
          />

          <button
            type="button"
            aria-label="Adjust bottom edge"
            className="absolute bottom-[-10px] left-1/2 h-5 w-16 -translate-x-1/2 cursor-ns-resize rounded-full border border-white/30 bg-green-500/80"
            onMouseDown={(e) => {
              e.stopPropagation();
              startDrag("bottom", e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (t) startDrag("bottom", t.clientX, t.clientY);
            }}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-4 py-2 text-white"
        >
          Retake
        </button>

        <button
          type="button"
          onClick={confirmCrop}
          className="rounded-xl bg-green-600 px-4 py-2 text-white"
        >
          Use This Crop
        </button>
      </div>
    </div>
  );
}