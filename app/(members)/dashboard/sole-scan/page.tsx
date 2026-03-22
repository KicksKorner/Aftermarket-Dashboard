"use client";

import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

type Props = {
  onDetected?: (value: string) => void;
};

type Marketplace = "ebay" | "stockx" | "goat";

type AnalyseResult = {
  sku: string;
  avgSold: number;
  lowestSold: number;
  highestSold: number;
  salesCount: number;
  confidence: "low" | "medium" | "high";
  roi: number;
  estimatedProfit: number;
  safeBuyPrice: number;
  flipScore: number;
  source?: string;
};

const RECENT_SCANS_KEY = "sole-scan-recent";
const MAX_RECENT_SCANS = 8;

function normaliseSkuText(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/--+/g, "-")
    .trim();
}

function extractSkuFromText(text: string) {
  const cleaned = text
    .toUpperCase()
    .replace(/[|]/g, "1")
    .replace(/[O]/g, "0")
    .replace(/[—–]/g, "-")
    .replace(/[^A-Z0-9#:\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = cleaned.replace(/\s+/g, "");

  const isNike = (value: string) => /^[A-Z]{2}\d{4}-\d{3}$/.test(value);
  const isAsics = (value: string) => /^\d{4}[A-Z]\d{3}-\d{3}$/.test(value);
  const isAdidas = (value: string) => /^[A-Z]{2}\d{4}$/.test(value);
  const isNewBalance = (value: string) =>
    /^[A-Z]\d{3,4}[A-Z]{2,3}$/.test(value);
  const isSalomon = (value: string) => /^L\d{8}$/.test(value);

  const looksLikeNoise = (value: string) => {
    if (value.length < 6) return true;
    if (/^[A-Z]{5,}$/.test(value)) return true;
    if (/^[A-Z]{2}\d{4}$/.test(value)) return false;
    if (!/^[A-Z0-9-]+$/.test(value)) return true;

    const letters = (value.match(/[A-Z]/g) || []).length;
    const digits = (value.match(/\d/g) || []).length;

    if (digits === 0) return true;
    if (letters >= 4 && digits <= 2) return true;

    return false;
  };

  const candidates = new Set<string>();

  const hintPatterns = [
    /(?:ART|ARTICLE|ART\.)[:\s#-]*([A-Z0-9-]{6,12})/g,
    /(?:SKU|STYLE)[:\s#-]*([A-Z0-9-]{6,12})/g,
  ];

  for (const pattern of hintPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(cleaned)) !== null) {
      const candidate = match[1]?.replace(/\s+/g, "");
      if (candidate) candidates.add(candidate);
    }
  }

  const strictPatterns = [
    /\b[A-Z]{2}\d{4}-\d{3}\b/g,
    /\b\d{4}[A-Z]\d{3}-\d{3}\b/g,
    /\b[A-Z]{2}\d{4}\b/g,
    /\b[A-Z]\d{3,4}[A-Z]{2,3}\b/g,
    /\bL\d{8}\b/g,
  ];

  for (const pattern of strictPatterns) {
    const matches = cleaned.match(pattern);
    if (matches?.length) {
      for (const match of matches) {
        candidates.add(match.trim().replace(/\s+/g, ""));
      }
    }
  }

  const ranked = [...candidates]
    .filter((value) => !looksLikeNoise(value))
    .sort((a, b) => {
      const score = (value: string) => {
        if (isNike(value)) return 100;
        if (isAsics(value)) return 95;
        if (isAdidas(value)) return 90;
        if (isNewBalance(value)) return 80;
        if (isSalomon(value)) return 70;
        return 0;
      };
      return score(b) - score(a);
    });

  for (const value of ranked) {
    if (isNike(value)) return value;
    if (isAsics(value)) return value;
    if (isAdidas(value)) return value;
    if (isNewBalance(value)) return value;
    if (isSalomon(value)) return value;
  }

  const compactMatches = [
    compact.match(/[A-Z]{2}\d{4}-\d{3}/),
    compact.match(/\d{4}[A-Z]\d{3}-\d{3}/),
    compact.match(/[A-Z]{2}\d{4}/),
    compact.match(/[A-Z]\d{3,4}[A-Z]{2,3}/),
    compact.match(/L\d{8}/),
  ];

  for (const match of compactMatches) {
    const candidate = match?.[0];
    if (!candidate) continue;
    if (!looksLikeNoise(candidate)) return candidate;
  }

  return "";
}

function drawPreprocessedLabelCrop(
  sourceVideo: HTMLVideoElement,
  outputCanvas: HTMLCanvasElement
) {
  const vw = sourceVideo.videoWidth;
  const vh = sourceVideo.videoHeight;

  if (!vw || !vh) return false;

  const cropX = vw * 0.12;
  const cropY = vh * 0.22;
  const cropW = vw * 0.76;
  const cropH = vh * 0.42;

  outputCanvas.width = Math.round(cropW * 2.4);
  outputCanvas.height = Math.round(cropH * 2.4);

  const ctx = outputCanvas.getContext("2d");
  if (!ctx) return false;

  ctx.filter = "grayscale(1) contrast(1.25) brightness(1.08) saturate(0)";
  ctx.drawImage(
    sourceVideo,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );

  const imageData = ctx.getImageData(
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  );
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const boosted = Math.max(0, Math.min(255, gray > 165 ? 255 : gray * 1.08));
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);

  return true;
}

function LabelScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [detected, setDetected] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState(
    "Open the camera, line up the size label, then capture."
  );
  const [previewImage, setPreviewImage] = useState("");

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      setError("");
      setDetected(false);
      setPreviewImage("");
      setReady(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setScanning(true);

      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 50));

      const video = videoRef.current;
      if (!video) {
        setError("Video element not found.");
        setScanning(false);
        return;
      }

      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      await video.play();

      setReady(true);
      setHint(
        "Hold the SKU label inside the green frame. Keep the phone slightly back to avoid blur."
      );

      const track = stream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
          focusMode?: string[];
        };

        if (capabilities?.focusMode?.includes("continuous")) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as never],
            });
          } catch (focusError) {
            console.error("Focus constraint not applied:", focusError);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError("Unable to access camera.");
      setReady(false);
      setScanning(false);
    }
  }

  async function stopCamera() {
    try {
      const video = videoRef.current;
      if (video) {
        video.pause();
        video.srcObject = null;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    } catch (err) {
      console.error("Failed to stop camera:", err);
    } finally {
      setReady(false);
      setScanning(false);
    }
  }

  async function captureAndRead() {
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || !ready) {
        setError("Camera is not ready yet.");
        return;
      }

      setOcrLoading(true);
      setError("");
      setDetected(false);
      setHint("Reading SKU text...");

      const drew = drawPreprocessedLabelCrop(video, canvas);
      if (!drew) {
        throw new Error("Could not capture label area.");
      }

      const preview = canvas.toDataURL("image/jpeg", 0.95);
      setPreviewImage(preview);

      let sku = "";

      const pass1 = await Tesseract.recognize(preview, "eng", {
        logger: () => {},
      });
      sku = extractSkuFromText(pass1.data.text || "");

      if (!sku) {
        setHint("Trying enhanced label OCR...");

        const thresholdCanvas = document.createElement("canvas");
        thresholdCanvas.width = canvas.width;
        thresholdCanvas.height = canvas.height;

        const thresholdCtx = thresholdCanvas.getContext("2d");
        if (!thresholdCtx) {
          throw new Error("Could not create threshold canvas.");
        }

        thresholdCtx.drawImage(canvas, 0, 0);

        const imageData = thresholdCtx.getImageData(
          0,
          0,
          thresholdCanvas.width,
          thresholdCanvas.height
        );
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i];
          const value = gray > 150 ? 255 : 0;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }

        thresholdCtx.putImageData(imageData, 0, 0);

        const thresholdPreview = thresholdCanvas.toDataURL("image/jpeg", 0.95);
        const pass2 = await Tesseract.recognize(thresholdPreview, "eng", {
          logger: () => {},
        });

        sku = extractSkuFromText(pass2.data.text || "");
      }

      if (!sku) {
        setHint("Trying full-frame OCR...");

        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = video.videoWidth;
        fullCanvas.height = video.videoHeight;

        const fullCtx = fullCanvas.getContext("2d");
        if (!fullCtx) {
          throw new Error("Could not create full-frame OCR canvas.");
        }

        fullCtx.filter = "grayscale(1) contrast(1.2) brightness(1.05)";
        fullCtx.drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

        const fullImage = fullCanvas.toDataURL("image/jpeg", 0.95);
        const pass3 = await Tesseract.recognize(fullImage, "eng", {
          logger: () => {},
        });

        sku = extractSkuFromText(pass3.data.text || "");
      }

      if (!sku) {
        setHint(
          "No SKU found. Keep the phone slightly farther back, reduce glare, and centre the article code in the frame."
        );
        setError("Could not detect SKU text.");
        return;
      }

      setDetected(true);
      setHint(`SKU detected: ${sku}`);
      onDetected?.(sku);
    } catch (err) {
      console.error(err);
      setError("Failed to read SKU text.");
      setHint("Try again with better light and less blur.");
    } finally {
      setOcrLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Scan Label / Read SKU Text</h2>

        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            detected
              ? "border border-green-400/40 bg-green-500/20 text-green-300"
              : ocrLoading
              ? "border border-amber-400/40 bg-amber-500/20 text-amber-300"
              : "border border-white/10 bg-slate-700/40 text-slate-300"
          }`}
        >
          {detected
            ? "SKU detected"
            : ocrLoading
            ? "Reading..."
            : scanning
            ? "Camera live"
            : "Ready"}
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-400">{hint}</p>

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/30">
        <video
          ref={videoRef}
          className={`h-auto w-full ${scanning ? "block" : "hidden"}`}
          playsInline
          muted
        />

        {!scanning ? (
          <div className="flex min-h-[260px] items-center justify-center px-4 text-center text-sm text-slate-500">
            Camera is closed. Open it to scan the trainer size label and read the
            SKU text.
          </div>
        ) : null}

        {scanning ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[150px] w-[82%] max-w-[420px] rounded-xl border-[3px] border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.7),0_0_0_9999px_rgba(0,0,0,0.5)]">
              <div className="absolute -left-1 -top-1 h-5 w-5 border-l-4 border-t-4 border-green-400" />
              <div className="absolute -right-1 -top-1 h-5 w-5 border-r-4 border-t-4 border-green-400" />
              <div className="absolute -bottom-1 -left-1 h-5 w-5 border-b-4 border-l-4 border-green-400" />
              <div className="absolute -bottom-1 -right-1 h-5 w-5 border-b-4 border-r-4 border-green-400" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {!scanning ? (
          <button
            onClick={() => void startCamera()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Open Camera
          </button>
        ) : (
          <>
            <button
              onClick={() => void captureAndRead()}
              disabled={!ready || ocrLoading}
              className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {ocrLoading ? "Reading SKU..." : "Capture & Read SKU"}
            </button>

            <button
              onClick={() => void stopCamera()}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/5"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {previewImage ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            OCR Preview
          </p>
          <img
            src={previewImage}
            alt="OCR preview"
            className="max-w-full rounded-xl border border-white/10"
          />
        </div>
      ) : null}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function formatCurrency(value: number) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function getDecisionBadge(roi: number, flipScore: number) {
  if (roi >= 25 || flipScore >= 8) {
    return {
      label: "BUY",
      className:
        "border border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    };
  }

  if (roi >= 10 || flipScore >= 5) {
    return {
      label: "MAYBE",
      className:
        "border border-amber-400/30 bg-amber-500/15 text-amber-300",
    };
  }

  return {
    label: "AVOID",
    className: "border border-red-400/30 bg-red-500/15 text-red-300",
  };
}

function ResultSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#081120] p-5">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="h-7 w-44 animate-pulse rounded bg-white/5" />
          <div className="h-4 w-56 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-16 w-24 animate-pulse rounded-xl bg-white/5" />
      </div>

      <div className="mb-4 h-32 animate-pulse rounded-2xl bg-white/5" />

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 animate-pulse rounded-xl bg-white/5"
          />
        ))}
      </div>
    </div>
  );
}

export default function SoleScanPage() {
  const [sku, setSku] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const skuInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SCANS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecentScans(
          parsed.filter((item): item is string => typeof item === "string")
        );
      }
    } catch (error) {
      console.error("Failed to load recent scans:", error);
    }
  }, []);

  function normaliseSku(value: string) {
    return value.trim().toUpperCase();
  }

  function saveRecentScan(value: string) {
    const cleaned = normaliseSku(value);
    if (!cleaned) return;

    setRecentScans((prev) => {
      const next = [cleaned, ...prev.filter((item) => item !== cleaned)].slice(
        0,
        MAX_RECENT_SCANS
      );

      try {
        localStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("Failed to save recent scans:", error);
      }

      return next;
    });
  }

  function getMarketplaceUrl(marketplace: Marketplace, searchSku: string) {
    const encoded = encodeURIComponent(searchSku);

    switch (marketplace) {
      case "ebay":
        return `https://www.ebay.co.uk/sch/i.html?_nkw=${encoded}&LH_Sold=1&LH_Complete=1`;
      case "stockx":
        return `https://stockx.com/search?s=${encoded}`;
      case "goat":
        return `https://www.goat.com/search?query=${encoded}`;
      default:
        return "";
    }
  }

  function openMarketplace(marketplace: Marketplace, searchSku?: string) {
    const finalSku = normaliseSku(searchSku ?? sku);

    if (!finalSku) {
      setErrorMessage("Enter or scan a SKU first.");
      return;
    }

    saveRecentScan(finalSku);
    setErrorMessage("");

    const url = getMarketplaceUrl(marketplace, finalSku);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleDetected(value: string) {
    const cleaned = normaliseSku(value);
    setSku(cleaned);
    saveRecentScan(cleaned);
    setErrorMessage("");
    skuInputRef.current?.focus();
  }

  function clearHistory() {
    setRecentScans([]);
    try {
      localStorage.removeItem(RECENT_SCANS_KEY);
    } catch (error) {
      console.error("Failed to clear recent scans:", error);
    }
  }

  async function handleAnalyse(searchSku?: string) {
    const finalSku = normaliseSku(searchSku ?? sku);

    if (!finalSku) {
      setErrorMessage("Enter or scan a SKU first.");
      return;
    }

    const parsedBuyPrice = Number(buyPrice);

    if (!buyPrice || Number.isNaN(parsedBuyPrice) || parsedBuyPrice <= 0) {
      setErrorMessage("Enter a valid buy price first.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      saveRecentScan(finalSku);
      setResult(null);

      const res = await fetch("/api/sole-scan/analyse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sku: finalSku,
          buyPrice: parsedBuyPrice,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to analyse SKU");
        return;
      }

      setResult(data);
    } catch (error) {
      console.error("Analyse error:", error);
      setErrorMessage("Something went wrong while analysing the SKU.");
    } finally {
      setLoading(false);
    }
  }

  const badge = result
    ? getDecisionBadge(result.roi, result.flipScore)
    : null;

  return (
    <div className="space-y-6 p-6 text-white">
      <div>
        <h1 className="text-3xl font-bold">👟 Sole Scan</h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter or scan a trainer SKU, check marketplaces, then analyse ROI.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#081120] p-5">
        <h2 className="mb-4 text-lg font-semibold">Search by SKU</h2>

        <div className="space-y-3">
          <input
            ref={skuInputRef}
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleAnalyse();
              }
            }}
            autoFocus
            placeholder="Example: DD0204-004"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />

          <input
            type="number"
            step="0.01"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleAnalyse();
              }
            }}
            placeholder="Enter buy price e.g. 59.99"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
          />

          <div className="grid gap-3 sm:grid-cols-4">
            <button
              onClick={() => openMarketplace("ebay")}
              className="rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white transition hover:opacity-90"
            >
              eBay Sold
            </button>

            <button
              onClick={() => openMarketplace("stockx")}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:opacity-90"
            >
              StockX
            </button>

            <button
              onClick={() => openMarketplace("goat")}
              className="rounded-xl bg-white px-5 py-3 font-semibold text-black transition hover:opacity-90"
            >
              GOAT
            </button>

            <button
              onClick={() => void handleAnalyse()}
              disabled={loading}
              className={`rounded-xl px-5 py-3 font-semibold transition ${
                loading
                  ? "cursor-not-allowed bg-amber-400/70 text-black"
                  : "bg-amber-400 text-black hover:opacity-90"
              }`}
            >
              {loading ? "Analysing..." : "Analyse"}
            </button>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </div>

      <LabelScanner onDetected={handleDetected} />

      {loading ? <ResultSkeleton /> : null}

      {result && badge ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 transition-all duration-300">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{result.sku}</h2>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${badge.className}`}
                >
                  {badge.label}
                </span>
              </div>

              <p className="mt-2 text-sm text-emerald-200/80">
                Confidence: {result.confidence.toUpperCase()} • Based on{" "}
                {result.salesCount} recent listings
              </p>

              {result.source ? (
                <p className="mt-1 text-xs text-emerald-200/70">
                  {result.source}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl bg-black/20 px-4 py-3 text-right">
              <div className="text-xs uppercase tracking-wide text-emerald-200/70">
                Flip Score
              </div>
              <div className="text-2xl font-bold text-blue-300">
                {result.flipScore}/10
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-black/20 p-5">
            <div className="text-sm text-slate-400">Avg Sold</div>
            <div className="mt-2 text-4xl font-bold text-emerald-300">
              {formatCurrency(result.avgSold)}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                ROI
              </div>
              <div className="mt-2 text-2xl font-bold">
                {result.roi.toFixed(1)}%
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Estimated Profit
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(result.estimatedProfit)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Lowest
              </div>
              <div className="mt-2 text-xl font-semibold">
                {formatCurrency(result.lowestSold)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Highest
              </div>
              <div className="mt-2 text-xl font-semibold">
                {formatCurrency(result.highestSold)}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4 md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-slate-400">
                Safe Buy Price
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatCurrency(result.safeBuyPrice)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(
                result.sku
              )}&LH_Sold=1&LH_Complete=1`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/20"
            >
              View Sold Listings →
            </a>

            <button
              onClick={() => openMarketplace("stockx", result.sku)}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Open StockX
            </button>

            <button
              onClick={() => openMarketplace("goat", result.sku)}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              Open GOAT
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-[#081120] p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Recent Scan History</h2>

          {recentScans.length > 0 ? (
            <button
              onClick={clearHistory}
              className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
            >
              Clear History
            </button>
          ) : null}
        </div>

        {recentScans.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
            No recent scans yet.
          </div>
        ) : (
          <div className="space-y-3">
            {recentScans.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <button
                    onClick={() => {
                      setSku(item);
                      skuInputRef.current?.focus();
                    }}
                    className="text-left text-base font-semibold text-white transition hover:text-blue-300"
                  >
                    {item}
                  </button>

                  <div className="grid gap-2 sm:grid-cols-4 md:w-auto">
                    <button
                      onClick={() => openMarketplace("ebay", item)}
                      className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                    >
                      eBay Sold
                    </button>

                    <button
                      onClick={() => openMarketplace("stockx", item)}
                      className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      StockX
                    </button>

                    <button
                      onClick={() => openMarketplace("goat", item)}
                      className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      GOAT
                    </button>

                    <button
                      onClick={() => void handleAnalyse(item)}
                      disabled={loading}
                      className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
                    >
                      Analyse
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}