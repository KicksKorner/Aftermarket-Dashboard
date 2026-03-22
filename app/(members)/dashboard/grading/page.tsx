"use client";

import { useState } from "react";
import CardScanner from "@/components/grading/CardScanner";
import GradeResults from "@/components/grading/GradeResults";
import type { ScanAnalysis } from "@/lib/types";

export default function GradingPage() {
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanAnalysis | null>(null);

  const analyze = async () => {
    try {
      setLoading(true);
      setResult(null);

      const payload = {
        front: { left: 22, right: 20, top: 19, bottom: 20 },
        back: { left: 24, right: 18, top: 20, bottom: 19 },
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
    } catch (error) {
      console.error("Analyze error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Card Grading Scanner</h1>
        <p className="text-gray-500">
          Capture the front and back of your card to get a rough PSA and ACE
          centering guide.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <CardScanner label="Front" onCapture={setFrontImage} />
        <CardScanner label="Back" onCapture={setBackImage} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {frontImage && (
          <img
            src={frontImage}
            alt="Front capture"
            className="rounded-2xl border"
          />
        )}
        {backImage && (
          <img
            src={backImage}
            alt="Back capture"
            className="rounded-2xl border"
          />
        )}
      </div>

      <button
        onClick={analyze}
        disabled={!frontImage || !backImage || loading}
        className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze Card"}
      </button>

      {result && <GradeResults result={result} />}
    </div>
  );
}