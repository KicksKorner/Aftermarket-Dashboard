"use client";

import { useState } from "react";
import { Trophy, Send, X, TrendingUp } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  sale: {
    id: string;
    item_name: string;
    buy_price: number;
    sold_price: number;
  } | null;
};

export default function SalesCardModal({ open, onClose, sale }: Props) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (!open || !sale) return null;

  const profit = Number(sale.sold_price) - Number(sale.buy_price);
  const roi = Number(sale.buy_price) > 0
    ? ((profit / Number(sale.buy_price)) * 100).toFixed(0)
    : "0";
  const profitPositive = profit >= 0;

  async function handleSend() {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/success/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale!.id,
          itemName: sale!.item_name,
          buyPrice: sale!.buy_price,
          sellPrice: sale!.sold_price,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to send. Please try again.");
        setSending(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setSent(false);
    setError("");
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: "16px" }}>
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#081120] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">

        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Trophy size={18} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Post Sales Card</h2>
              <p className="text-xs text-slate-500">Send to the success channel</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-xl p-1.5 text-slate-500 hover:bg-white/5 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          /* Success state */
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
              <Trophy size={26} />
            </div>
            <h3 className="text-lg font-semibold text-white">Posted to Success Channel!</h3>
            <p className="mt-2 text-sm text-slate-400">Your sales card has been sent to Discord.</p>
            <button onClick={handleClose} className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-medium text-white hover:bg-white/10">
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Discord embed preview */}
            <div className="mb-5 overflow-hidden rounded-2xl border border-white/8" style={{ background: "#2b2d31" }}>
              {/* Left green accent bar */}
              <div style={{ display: "flex" }}>
                <div style={{ width: "4px", background: "#22c55e", flexShrink: 0, borderRadius: "0 0 0 8px" }} />
                <div style={{ padding: "12px 14px", flex: 1 }}>
                  {/* Author */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#0d1f14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "7px", fontWeight: 700, color: "#22c55e" }}>AA</div>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#b5bac1", fontFamily: "sans-serif" }}>Aftermarket Arbitrage · Success Channel</span>
                  </div>

                  {/* Title */}
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "#fff", marginBottom: "4px", fontFamily: "sans-serif" }}>
                    🏆 Win — {sale.item_name}
                  </div>

                  {/* Description */}
                  <div style={{ fontSize: "13px", color: "#b5bac1", marginBottom: "12px", fontFamily: "sans-serif" }}>
                    <span style={{ color: "#22c55e", fontWeight: 600 }}>You</span> just posted a sale to the success channel!
                  </div>

                  {/* Fields */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                    {[
                      { label: "Buy Price", value: `£${Number(sale.buy_price).toFixed(2)}`, color: "#f87171" },
                      { label: "Sell Price", value: `£${Number(sale.sold_price).toFixed(2)}`, color: "#fff" },
                      { label: "Profit", value: `+£${profit.toFixed(2)}`, color: profitPositive ? "#22c55e" : "#f87171" },
                    ].map((f) => (
                      <div key={f.label} style={{ background: "#1e1f22", borderRadius: "6px", padding: "7px 9px" }}>
                        <div style={{ fontSize: "10px", fontWeight: 600, color: "#87909c", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "3px", fontFamily: "sans-serif" }}>{f.label}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: f.color, fontFamily: "sans-serif" }}>{f.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* ROI badge */}
                  <div style={{ display: "inline-block", background: "#0d2e18", border: "1px solid #166534", borderRadius: "6px", padding: "4px 9px", fontSize: "11px", fontWeight: 600, color: "#4ade80", fontFamily: "sans-serif" }}>
                    {roi}% ROI
                  </div>

                  {/* Footer */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: "10px", paddingTop: "8px", fontSize: "11px", color: "#4e5058", fontFamily: "sans-serif" }}>
                    Aftermarket Arbitrage · Members Dashboard
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <p className="mb-5 text-xs text-slate-500 text-center">
              This will be posted publicly to the Discord success channel. Make sure the details look correct above.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
              >
                <Send size={15} />
                {sending ? "Sending..." : "Send to Success Channel"}
              </button>
              <button
                onClick={handleClose}
                className="rounded-2xl border border-white/10 px-5 py-3 text-sm text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
