"use client";

import { useState } from "react";
import { Calculator, TrendingUp, PoundSterling, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400/40 transition";

// Approximate FBA fee rates by category (UK)
const CATEGORY_FEES: Record<string, { referral: number; label: string }> = {
  "electronics": { referral: 0.07, label: "Electronics" },
  "computers": { referral: 0.07, label: "Computers" },
  "toys": { referral: 0.15, label: "Toys & Games" },
  "clothing": { referral: 0.15, label: "Clothing" },
  "shoes": { referral: 0.15, label: "Shoes" },
  "beauty": { referral: 0.15, label: "Beauty" },
  "health": { referral: 0.15, label: "Health & Personal Care" },
  "sports": { referral: 0.15, label: "Sports & Outdoors" },
  "kitchen": { referral: 0.15, label: "Kitchen & Home" },
  "books": { referral: 0.15, label: "Books" },
  "grocery": { referral: 0.15, label: "Grocery" },
  "automotive": { referral: 0.12, label: "Automotive" },
  "tools": { referral: 0.12, label: "Tools & DIY" },
  "garden": { referral: 0.15, label: "Garden" },
  "pet": { referral: 0.15, label: "Pet Supplies" },
  "baby": { referral: 0.15, label: "Baby" },
  "office": { referral: 0.15, label: "Office Products" },
  "music": { referral: 0.15, label: "Music" },
  "video_games": { referral: 0.15, label: "Video Games" },
  "other": { referral: 0.15, label: "Other / Default" },
};

// Estimated FBA fulfilment fees by size/weight tier (UK 2024)
const SIZE_TIERS = [
  { id: "small", label: "Small (< 300g)", fee: 2.23 },
  { id: "standard_300", label: "Standard (300g–400g)", fee: 2.55 },
  { id: "standard_500", label: "Standard (400g–500g)", fee: 2.63 },
  { id: "standard_1000", label: "Standard (500g–1000g)", fee: 3.09 },
  { id: "standard_2000", label: "Standard (1kg–2kg)", fee: 3.84 },
  { id: "large", label: "Large / Heavy (2kg+)", fee: 5.50 },
  { id: "oversized", label: "Oversized / Bulky", fee: 9.00 },
];

function getVerdict(roi: number, profit: number): { label: string; icon: any; color: string; bg: string } {
  if (profit < 0) return { label: "Loss — Do Not Buy", icon: XCircle, color: "text-red-300", bg: "border-red-500/25 bg-red-500/10" };
  if (roi >= 30 && profit >= 3) return { label: "Strong Buy ✅", icon: CheckCircle, color: "text-emerald-300", bg: "border-emerald-500/25 bg-emerald-500/10" };
  if (roi >= 20 && profit >= 1.5) return { label: "Good Deal 👍", icon: CheckCircle, color: "text-blue-300", bg: "border-blue-500/25 bg-blue-500/10" };
  if (roi >= 10) return { label: "Marginal — Proceed Carefully", icon: AlertCircle, color: "text-amber-300", bg: "border-amber-500/25 bg-amber-500/10" };
  return { label: "Poor ROI — Avoid", icon: XCircle, color: "text-red-300", bg: "border-red-500/25 bg-red-500/10" };
}

export default function AsinProfitCalc() {
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [category, setCategory] = useState("other");
  const [sizeTier, setSizeTier] = useState("standard_500");
  const [vatRegistered, setVatRegistered] = useState(false);
  const [vatRate] = useState(20);
  const [prepCost, setPrepCost] = useState("0");
  const [shippingToFba, setShippingToFba] = useState("0");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [quantity, setQuantity] = useState("1");

  // Calculate everything
  const buy = parseFloat(buyPrice) || 0;
  const sell = parseFloat(sellPrice) || 0;
  const qty = parseInt(quantity) || 1;
  const prep = parseFloat(prepCost) || 0;
  const shipToFba = parseFloat(shippingToFba) || 0;

  const catFee = CATEGORY_FEES[category] || CATEGORY_FEES.other;
  const sizeFee = SIZE_TIERS.find(s => s.id === sizeTier)?.fee || 2.63;
  const referralFee = sell * catFee.referral;
  const fbaFee = sizeFee;

  // VAT: if registered, buy price has recoverable input VAT
  const buyExVat = vatRegistered ? buy / (1 + vatRate / 100) : buy;
  const totalCostPerUnit = buyExVat + prep + (shipToFba / Math.max(qty, 1));

  const totalFees = referralFee + fbaFee;
  const profit = sell - totalCostPerUnit - totalFees;
  const roi = totalCostPerUnit > 0 ? (profit / totalCostPerUnit) * 100 : 0;
  const margin = sell > 0 ? (profit / sell) * 100 : 0;
  const breakEven = totalCostPerUnit + totalFees;
  const totalProfit = profit * qty;

  const verdict = sell > 0 && buy > 0 ? getVerdict(roi, profit) : null;
  const VerdictIcon = verdict?.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calculator size={16} className="text-blue-400" />
          <p className="text-sm font-semibold text-white">FBA Profit Calculator</p>
        </div>
        <p className="text-xs text-slate-400">Enter your buy price and Amazon sell price — we calculate exact FBA fees, referral fees, profit, ROI, and tell you whether it's worth buying. All calculations update in real time as you type.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Buy Price (£) *</label>
            <input type="number" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
              placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Amazon Sell Price (£) *</label>
            <input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
              placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)}
              placeholder="1" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
              {Object.entries(CATEGORY_FEES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Size / Weight Tier</label>
            <select value={sizeTier} onChange={e => setSizeTier(e.target.value)} className={selectCls}>
              {SIZE_TIERS.map(t => (
                <option key={t.id} value={t.id}>{t.label} (£{t.fee.toFixed(2)} FBA fee)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Prep Cost / unit (£)</label>
            <input type="number" step="0.01" value={prepCost} onChange={e => setPrepCost(e.target.value)}
              placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Shipping to FBA total (£)</label>
            <input type="number" step="0.01" value={shippingToFba} onChange={e => setShippingToFba(e.target.value)}
              placeholder="0.00" className={inputCls} />
            <p className="mt-1 text-[10px] text-slate-600">Split across quantity above</p>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={vatRegistered} onChange={e => setVatRegistered(e.target.checked)} />
              <span className="text-xs text-slate-400">VAT Registered (recovers 20% input VAT on buy price)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      {buy > 0 && sell > 0 && (
        <div className="space-y-4">
          {/* Verdict */}
          {verdict && VerdictIcon && (
            <div className={`flex items-center gap-3 rounded-[20px] border px-5 py-4 ${verdict.bg}`}>
              <VerdictIcon size={20} className={verdict.color} />
              <p className={`text-base font-bold ${verdict.color}`}>{verdict.label}</p>
            </div>
          )}

          {/* Key numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Profit per Unit", value: `£${profit.toFixed(2)}`, color: profit >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "ROI", value: `${roi.toFixed(1)}%`, color: roi >= 20 ? "text-emerald-400" : roi >= 10 ? "text-amber-400" : "text-red-400" },
              { label: "Margin", value: `${margin.toFixed(1)}%`, color: "text-white" },
              { label: qty > 1 ? `Total Profit (×${qty})` : "Break-Even", value: qty > 1 ? `£${totalProfit.toFixed(2)}` : `£${breakEven.toFixed(2)}`, color: qty > 1 && totalProfit >= 0 ? "text-emerald-400" : "text-white" },
            ].map(s => (
              <div key={s.label} className="rounded-[20px] border border-white/10 bg-[#081120] p-4">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Full breakdown */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120] p-4">
            <button onClick={() => setShowBreakdown(!showBreakdown)}
              className="flex w-full items-center justify-between text-sm font-semibold text-white">
              <span>Full Cost Breakdown</span>
              {showBreakdown ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showBreakdown && (
              <div className="mt-3 space-y-2">
                {[
                  { label: "Amazon Sell Price", value: sell, type: "income" },
                  { label: `Referral Fee (${(catFee.referral * 100).toFixed(0)}% — ${catFee.label})`, value: -referralFee, type: "fee" },
                  { label: `FBA Fulfilment Fee (${SIZE_TIERS.find(s => s.id === sizeTier)?.label})`, value: -fbaFee, type: "fee" },
                  { label: `Buy Price${vatRegistered ? " (ex VAT)" : ""}`, value: -buyExVat, type: "cost" },
                  ...(prep > 0 ? [{ label: "Prep Cost / unit", value: -prep, type: "cost" }] : []),
                  ...(shipToFba > 0 ? [{ label: `Shipping to FBA (÷${qty})`, value: -(shipToFba / qty), type: "cost" }] : []),
                  { label: "= NET PROFIT", value: profit, type: "total" },
                ].map((row, i) => (
                  <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2 ${row.type === "total" ? "border border-white/10 bg-white/5" : ""}`}>
                    <span className={`text-sm ${row.type === "total" ? "font-bold text-white" : row.type === "income" ? "text-white" : "text-slate-400"}`}>{row.label}</span>
                    <span className={`text-sm font-semibold ${row.type === "total" ? row.value >= 0 ? "text-emerald-400" : "text-red-400" : row.value >= 0 ? "text-white" : "text-red-400"}`}>
                      {row.value >= 0 ? "+" : ""}£{Math.abs(row.value).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ROI targets */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120] p-4">
            <p className="mb-3 text-sm font-semibold text-white">Max Buy Price by Target ROI</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {[10, 20, 30, 50].map(targetRoi => {
                const maxBuy = (sell - totalFees) / (1 + targetRoi / 100);
                const actualBuy = vatRegistered ? maxBuy * (1 + vatRate / 100) : maxBuy;
                return (
                  <div key={targetRoi} className={`rounded-xl border px-3 py-2.5 text-center ${buy <= actualBuy ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                    <p className={`text-base font-bold ${buy <= actualBuy ? "text-emerald-400" : "text-white"}`}>£{actualBuy.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">max for {targetRoi}% ROI</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {(!buy || !sell) && (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/10 bg-[#081120]/50 py-10 text-center">
          <Calculator size={28} className="mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">Enter buy and sell prices above to see your profit calculation</p>
        </div>
      )}
    </div>
  );
}
