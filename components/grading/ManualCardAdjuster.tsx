"use client";

import { useEffect, useRef, useState } from "react";

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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
    x: 15,
    y: 10,
    width: 70,
    height: 70 * (7 / 5),
  });

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cropStartRef = useRef<CropRect | null>(null);

  useEffect(() => {
    const initialWidth = 60;
    const initialHeight = initialWidth * (7 / 5);

    setCrop({
      x: 20,
      y: 8,
      width: initialWidth,
      height: initialHeight,
    });
  }, [image]);

  const clampCrop = (next: CropRect): CropRect => {
    const maxX = 100 - next.width;
    const maxY = 100 - next.height;

    return {
      ...next,
      x: Math.max(0, Math.min(next.x, maxX)),
      y: Math.max(0, Math.min(next.y, maxY)),
    };
  };

  const handlePointerDownMove = (clientX: number, clientY: number) => {
    setDragging(true);
    dragStartRef.current = { x: clientX, y: clientY };
    cropStartRef.current = crop;
  };

  const handlePointerDownResize = (clientX: number, clientY: number) => {
    setResizing(true);
    dragStartRef.current = { x: clientX, y: clientY };
    cropStartRef.current = crop;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!dragStartRef.current || !cropStartRef.current) return;

    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dxPct = (dx / rect.width) * 100;
    const dyPct = (dy / rect.height) * 100;

    if (dragging) {
      const next = clampCrop({
        ...cropStartRef.current,
        x: cropStartRef.current.x + dxPct,
        y: cropStartRef.current.y + dyPct,
      });

      setCrop(next);
    }

    if (resizing) {
      let nextWidth = cropStartRef.current.width + dxPct;
      nextWidth = Math.max(30, Math.min(nextWidth, 90));

      let nextHeight = nextWidth * (7 / 5);

      const maxHeightAllowed = 100 - cropStartRef.current.y;
      if (nextHeight > maxHeightAllowed) {
        nextHeight = maxHeightAllowed;
        nextWidth = nextHeight * (5 / 7);
      }

      const maxWidthAllowed = 100 - cropStartRef.current.x;
      if (nextWidth > maxWidthAllowed) {
        nextWidth = maxWidthAllowed;
        nextHeight = nextWidth * (7 / 5);
      }

      setCrop({
        x: cropStartRef.current.x,
        y: cropStartRef.current.y,
        width: nextWidth,
        height: nextHeight,
      });
    }
  };

  const stopInteraction = () => {
    setDragging(false);
    setResizing(false);
    dragStartRef.current = null;
    cropStartRef.current = null;
  };

  const confirmCrop = async () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = document.createElement("canvas");
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const sx = (crop.x / 100) * img.clientWidth * scaleX;
    const sy = (crop.y / 100) * img.clientHeight * scaleY;
    const sw = (crop.width / 100) * img.clientWidth * scaleX;
    const sh = (crop.height / 100) * img.clientHeight * scaleY;

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

    const cropped = canvas.toDataURL("image/jpeg", 0.95);
    onConfirm(cropped);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <h3 className="text-lg font-semibold text-white">Adjust Card Frame</h3>
        <p className="text-sm text-slate-300">
          Drag the green box to fit the card edges. Use the corner handle to resize.
        </p>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-black touch-none"
        onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
        onMouseUp={stopInteraction}
        onMouseLeave={stopInteraction}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) handlePointerMove(t.clientX, t.clientY);
        }}
        onTouchEnd={stopInteraction}
      >
        <img
          ref={imageRef}
          src={image}
          alt="Captured card"
          className="block h-auto w-full"
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: "inset 0 0 0 9999px rgba(0,0,0,0.45)",
            clipPath: `polygon(
              0% 0%,
              0% 100%,
              ${crop.x}% 100%,
              ${crop.x}% ${crop.y}%,
              ${crop.x + crop.width}% ${crop.y}%,
              ${crop.x + crop.width}% ${crop.y + crop.height}%,
              ${crop.x}% ${crop.y + crop.height}%,
              ${crop.x}% 100%,
              100% 100%,
              100% 0%
            )`,
          }}
        />

        <div
          className="absolute rounded-[18px] border-[3px] border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.7)]"
          style={{
            left: `${crop.x}%`,
            top: `${crop.y}%`,
            width: `${crop.width}%`,
            height: `${crop.height}%`,
          }}
          onMouseDown={(e) => handlePointerDownMove(e.clientX, e.clientY)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (t) handlePointerDownMove(t.clientX, t.clientY);
          }}
        >
          <div className="absolute -left-1 -top-1 h-6 w-6 rounded-tl-md border-l-4 border-t-4 border-green-400" />
          <div className="absolute -right-1 -top-1 h-6 w-6 rounded-tr-md border-r-4 border-t-4 border-green-400" />
          <div className="absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-md border-b-4 border-l-4 border-green-400" />
          <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-br-md border-b-4 border-r-4 border-green-400" />

          <button
            type="button"
            className="absolute -bottom-4 -right-4 h-10 w-10 rounded-full border-2 border-white bg-green-500 shadow-lg"
            onMouseDown={(e) => {
              e.stopPropagation();
              handlePointerDownResize(e.clientX, e.clientY);
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              if (t) handlePointerDownResize(t.clientX, t.clientY);
            }}
            aria-label="Resize crop"
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