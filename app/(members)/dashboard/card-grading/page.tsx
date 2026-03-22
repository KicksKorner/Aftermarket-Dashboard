"use client";

import { useState } from "react";
import CardScanner from "@/components/grading/CardScanner";
import GradeResults from "@/components/grading/GradeResults";
import type { ScanAnalysis } from "@/lib/types";

export default function GradingPage() {
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
        setError("Please capture the front of the card first.");
        return;
      }

      // Placeholder measurements for MVP.
      // Front only for now. We reuse front values as back so existing API/type flow still works.
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
          Capture the front of your card to get a rough PSA and ACE centering guide.
        </p>
      </div>

      <CardScanner label="Front" onCapture={setFrontImage} />

      {frontImage && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Front Preview</h2>
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