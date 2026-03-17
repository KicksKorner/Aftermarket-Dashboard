"use client";

import { useEffect, useRef, useState } from "react";

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

function BarcodeScanner({ onDetected }: Props) {
  const [scannerLoaded, setScannerLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const readerRef = useRef<HTMLDivElement | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    async function loadLibrary() {
      try {
        await import("html5-qrcode");
        if (mounted) setScannerLoaded(true);
      } catch (error) {
        console.error("Failed to load scanner library:", error);
      }
    }

    loadLibrary();

    return () => {
      mounted = false;
      void stopScanner();
    };
  }, []);

  async function startScanner() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (!readerRef.current) return;

      const html5QrCode = new Html5Qrcode("sole-scan-reader");
      html5QrCodeRef.current = html5QrCode;
      setScanning(true);

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 280, height: 140 },
        },
        (decodedText: string) => {
          const cleaned = decodedText.trim();
          onDetected?.(cleaned);
          void stopScanner();
        },
        () => {}
      );
    } catch (error) {
      console.error("Failed to start scanner:", error);
      setScanning(false);
      alert("Could not start camera scanner.");
    }
  }

  async function stopScanner() {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (error) {
      console.error("Failed to stop scanner:", error);
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Scan Label</h2>

        {scanning ? (
          <button
            onClick={() => void stopScanner()}
            className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white transition hover:bg-white/5"
          >
            Stop Scan
          </button>
        ) : (
          <button
            onClick={() => void startScanner()}
            disabled={!scannerLoaded}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            Open Camera
          </button>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-400">
        Scan the barcode or manually enter the SKU below.
      </p>

      <div
        id="sole-scan-reader"
        ref={readerRef}
        className="min-h-[220px] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30"
      />

      {!scannerLoaded ? (
        <p className="mt-3 text-xs text-slate-500">Loading scanner...</p>
      ) : null}
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

      <BarcodeScanner onDetected={handleDetected} />

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