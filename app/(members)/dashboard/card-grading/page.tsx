"use client";

import { useState } from "react";
import CardScanner from "@/components/grading/CardScanner";
import GradeResults from "@/components/grading/GradeResults";
import ManualCardAdjuster from "@/components/grading/ManualCardAdjuster";
import type { ScanAnalysis } from "@/lib/types";

export default function GradingPage() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanAnalysis | null>(null);
  const [error, setError] = useState("");

  const analyze = async () => {
    try {
      setLoading(true);
      setResult(null);
      setError("");

      if (!frontImage) {
        setError("Please capture and adjust the front of the card first.");
        return;
      }

      const payload = {
        front: { left: 22, right: 20, top: 19, bottom: 20 },
        back: { left: 22, right: 20, top: 19, bottom: 20 },
      };

      const res = await fetch("/api/card-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to analyze card");
      }

      const json: ScanAnalysis = await res.json();
      setResult(json);
    } catch (err) {
      console.error(err);
      setError("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Card Grading Scanner</h1>
        <p className="text-slate-300">
          Capture the front, manually adjust the frame, then run a rough PSA and
          ACE centering guide.
        </p>
      </div>

      {!capturedImage && !frontImage && (
        <CardScanner label="Front" onCapture={setCapturedImage} />
      )}

      {capturedImage && !frontImage && (
        <ManualCardAdjuster
          image={capturedImage}
          onConfirm={(cropped) => {
            setFrontImage(cropped);
            setCapturedImage(null);
          }}
          onCancel={() => {
            setCapturedImage(null);
            setFrontImage(null);
            setResult(null);
            setError("");
          }}
        />
      )}

      {frontImage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white">Final Front Image</h2>
            <button
              type="button"
              onClick={() => {
                setCapturedImage(frontImage);
                setFrontImage(null);
                setResult(null);
              }}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-white"
            >
              Adjust Again
            </button>
          </div>

          <img
            src={frontImage}
            alt="Front capture"
            className="max-w-md rounded-2xl border border-white/10"
          />
        </div>
      )}

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button
        onClick={analyze}
        disabled={!frontImage || loading}
        className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze Card"}
      </button>

      {result && <GradeResults result={result} />}
    </div>
  );
}