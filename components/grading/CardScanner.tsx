"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: "Front";
  onCapture: (dataUrl: string) => void;
};

export default function CardScanner({ label, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }

        intervalId = window.setInterval(() => {
          const video = videoRef.current;
          if (!video) return;

          const width = video.videoWidth;
          const height = video.videoHeight;

          if (width > 0 && height > 0) {
            const portraitEnough = height > width;
            setDetected(portraitEnough);
          }
        }, 500);
      } catch (err) {
        console.error(err);
        setError("Unable to access camera.");
      }
    }

    startCamera();

    return () => {
      if (intervalId) window.clearInterval(intervalId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    onCapture(dataUrl);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{label} Scan</h3>
          <p className="text-sm text-slate-300">
            Keep the card slightly back from the camera, align it to the frame,
            and avoid glare or blur.
          </p>
        </div>

        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            detected
              ? "bg-green-500/20 text-green-300 border border-green-400/40"
              : "bg-slate-700/40 text-slate-300 border border-white/10"
          }`}
        >
          {detected ? "Card detected" : "Searching..."}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="h-auto w-full"
            playsInline
            muted
            autoPlay
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={`
                relative
                w-[78%]
                max-w-[360px]
                aspect-[5/7]
                rounded-[20px]
                border-[3px]
                ${detected ? "border-green-400" : "border-slate-300"}
                shadow-[0_0_12px_rgba(34,197,94,0.7),0_0_0_9999px_rgba(0,0,0,0.55)]
              `}
            >
              <div className={`absolute -left-1 -top-1 h-6 w-6 rounded-tl-md border-l-4 border-t-4 ${detected ? "border-green-400" : "border-slate-300"}`} />
              <div className={`absolute -right-1 -top-1 h-6 w-6 rounded-tr-md border-r-4 border-t-4 ${detected ? "border-green-400" : "border-slate-300"}`} />
              <div className={`absolute -bottom-1 -left-1 h-6 w-6 rounded-bl-md border-b-4 border-l-4 ${detected ? "border-green-400" : "border-slate-300"}`} />
              <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-br-md border-b-4 border-r-4 ${detected ? "border-green-400" : "border-slate-300"}`} />
            </div>
          </div>

          {detected && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-green-500/90 px-3 py-1 text-xs font-semibold text-white shadow-lg">
              Card detected
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleCapture}
        disabled={!ready}
        className="rounded-xl bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        Capture {label}
      </button>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}