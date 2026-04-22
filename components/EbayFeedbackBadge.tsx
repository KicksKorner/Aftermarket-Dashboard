"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

type FeedbackData = {
  score: number;
  percentage: number;
} | null;

export default function EbayFeedbackBadge() {
  const [data, setData] = useState<FeedbackData>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ebay/feedback/score")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.score !== undefined) setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Don't render if no eBay connection or still loading
  if (loading || !data) return null;

  const isExcellent = data.percentage >= 99;
  const isGood = data.percentage >= 97;

  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
      isExcellent
        ? "border-emerald-500/20 bg-emerald-500/10"
        : isGood
        ? "border-amber-500/20 bg-amber-500/10"
        : "border-red-500/20 bg-red-500/10"
    }`}>
      <Star size={12} className={isExcellent ? "text-emerald-400 fill-emerald-400" : isGood ? "text-amber-400 fill-amber-400" : "text-red-400 fill-red-400"} />
      <span className="font-semibold text-white">{data.score.toLocaleString()}</span>
      <span className={`text-xs ${isExcellent ? "text-emerald-400" : isGood ? "text-amber-400" : "text-red-400"}`}>
        {data.percentage.toFixed(1)}%
      </span>
    </div>
  );
}
