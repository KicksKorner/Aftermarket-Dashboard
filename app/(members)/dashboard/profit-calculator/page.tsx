"use client";

import { useState, useMemo } from "react";
import { Calculator, TrendingUp, TrendingDown } from "lucide-react";

type SellerType = "business" | "private";

const BUSINESS_CATEGORIES = [
  { label: "General / Most categories (12.55%)", fvf: 0.1255 },
  { label: "Books, DVDs & Movies (14.55%)", fvf: 0.1455 },
  { label: "Clothes, Shoes & Accessories (13.4%)", fvf: 0.134 },
  { label: "Trainers ≥ £100 (8%)", fvf: 0.08 },
  { label: "Mobile Phones & Accessories (12.8%)", fvf: 0.128 },
  { label: "Vehicle Parts & Accessories (12.55%)", fvf: 0.1255 },
  { label: "Computing (7.55%)", fvf: 0.0755 },
  { label: "Coins, Banknotes & Bullion (7.55%)", fvf: 0.0755 },
  { label: "Musical Instruments (6.55%)", fvf: 0.0655 },
  { label: "Heavy Equipment & Trucks (3.55%)", fvf: 0.0355 },
];

const PRIVATE_CATEGORIES = [
  { label: "General / Most categories (0%)", fvf: 0 },
  { label: "Trainers ≥ £100 (8%)", fvf: 0.08 },
];

function fmt(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function ProfitCalculatorPage() {
  const [sellerType, setSellerType] = useState<SellerType>("business");
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [shippingCost, setShippingCost] = useState("");
  const [shippingCharged, setShippingCharged] = useState("");
  const [topRated, setTopRated] = useState(false);
  const [international, setInternational] = useState(false);
  const [promotedRate, setPromotedRate] = useState(0);

  const categories = sellerType === "business" ? BUSINESS_CATEGORIES : PRIVATE_CATEGORIES;
  const safeIndex = Math.min(categoryIndex, categories.length - 1);
  const category = categories[safeIndex];

  const calc = useMemo(() => {
    const buy = parseFloat(buyPrice) || 0;
    const sell = parseFloat(sellPrice) || 0;
    const qty = parseInt(quantity) || 1;
    const shipCost = parseFloat(shippingCost) || 0;
    const shipCharged = parseFloat(shippingCharged) || 0;

    const totalSale = (sell + shipCharged) * qty;
    const stockCost = buy * qty;
    const totalShipCost = shipCost * qty;

    // eBay fees
    let fvfRate = category.fvf;
    if (topRated && sellerType === "business") fvfRate = fvfRate * 0.9;

    const finalValueFee = sellerType === "private" && fvfRate === 0 ? 0 : totalSale * fvfRate;
    const perOrderFee = sellerType === "business" ? 0.30 * qty : 0;
    const regOpFee = sellerType === "business" ? totalSale * 0.0035 : 0;
    const internationalFee = international ? totalSale * 0.017 : 0;
    const promotedFee = totalSale * (promotedRate / 100);

    const subtotalFees = finalValueFee + perOrderFee + regOpFee + internationalFee + promotedFee;
    const vatOnFees = sellerType === "business" ? subtotalFees * 0.2 : 0;
    const totalFees = subtotalFees + vatOnFees;

    const totalCost = stockCost + totalShipCost + totalFees;
    const netProfit = totalSale - totalCost;
    const margin = totalSale > 0 ? (netProfit / totalSale) * 100 : 0;
    const roi = stockCost > 0 ? (netProfit / stockCost) * 100 : 0;

    // Target prices
    const breakeven = totalCost > 0
      ? (() => {
          // Solve: sell - sell*fvfRate - 0.30 - sell*0.0035 - sell*vatRate*... = cost
          // Simplified: sell * (1 - effective_rate) = cost
          const effectiveRate = fvfRate + (sellerType === "business" ? 0.0035 : 0) +
            (international ? 0.017 : 0) + (promotedRate / 100);
          const vatMult = sellerType === "business" ? 1.2 : 1;
          const denominator = 1 - effectiveRate * vatMult;
          const fixedCosts = stockCost + totalShipCost + (sellerType === "business" ? perOrderFee * 1.2 : 0);
          return denominator > 0 ? fixedCosts / denominator : 0;
        })()
      : 0;

    const target20 = breakeven > 0 ? breakeven / 0.8 : 0;

    return {
      totalSale,
      finalValueFee,
      perOrderFee,
      regOpFee,
      vatOnFees,
      internationalFee,
      promotedFee,
      totalFees,
      totalFeesPct: totalSale > 0 ? (totalFees / totalSale) * 100 : 0,
      stockCost,
      totalShipCost,
      totalCost,
      netProfit,
      margin,
      roi,
      breakeven,
      target20,
    };
  }, [buyPrice, sellPrice, quantity, shippingCost, shippingCharged, topRated, international, promotedRate, category, sellerType]);

  const profitPositive = calc.netProfit >= 0;

  function numInput(
    label: string,
    value: string,
    onChange: (v: string) => void,
    prefix = "£",
    placeholder = "0"
  ) {
    return (
      <div>
        <label className="mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-slate-500">
          {label}
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 transition focus-within:border-blue-400/40">
          {prefix && <span className="text-slate-500">{prefix}</span>}
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-white outline-none placeholder:text-slate-600"
          />
        </div>
      </div>
    );
  }

  function toggle(label: string, sub: string, checked: boolean, onChange: (v: boolean) => void) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-slate-500">{sub}</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${checked ? "bg-blue-600" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>
    );
  }

  function row(label: string, value: string, highlight = false) {
    return (
      <div className="flex items-center justify-between py-2.5 text-sm">
        <span className="text-slate-400">{label}</span>
        <span className={highlight ? "font-semibold text-amber-400" : "text-white"}>{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <Calculator size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">eBay Profit Calculator</h1>
          <p className="text-sm text-slate-400">UK fee & margin calculator — updated Apr 2026</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

        {/* LEFT — inputs */}
        <div className="space-y-4">

          {/* Seller type */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Seller type</p>
            <div className="grid grid-cols-2 gap-2">
              {(["business", "private"] as SellerType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setSellerType(t); setCategoryIndex(0); }}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium capitalize transition ${
                    sellerType === t
                      ? "border border-blue-500/30 bg-blue-500/15 text-blue-300"
                      : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {t} Seller
                </button>
              ))}
            </div>

            {sellerType === "private" && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                <span className="mt-0.5 flex-shrink-0 text-amber-400">ℹ</span>
                Private sellers pay £0 in fees (standard categories). Use category 'Trainers ≥ £100' for the 8% exception.
              </div>
            )}
          </div>

          {/* Category */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Category</p>
            <select
              value={safeIndex}
              onChange={(e) => setCategoryIndex(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/40"
            >
              {categories.map((c, i) => (
                <option key={i} value={i}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Prices */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Prices</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {numInput("Buy Price", buyPrice, setBuyPrice)}
              {numInput("Sell Price", sellPrice, setSellPrice)}
              {numInput("Quantity", quantity, setQuantity, "", "1")}
              {numInput("Shipping Cost (your cost)", shippingCost, setShippingCost)}
              {numInput("Shipping Charged to Buyer", shippingCharged, setShippingCharged)}
            </div>
          </div>

          {/* Options */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Options</p>
            <div className="space-y-4">
              {sellerType === "business" && toggle("Top Rated Seller", "10% FVF discount", topRated, setTopRated)}
              {toggle("International Sale", "+1.7% international fee", international, setInternational)}

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Promoted Listing Rate</p>
                    <p className="text-xs text-slate-500">Added as % of sale price</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-300">{pct(promotedRate)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.1"
                  value={promotedRate}
                  onChange={(e) => setPromotedRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="mt-1 flex justify-between text-xs text-slate-600">
                  <span>0%</span><span>10%</span><span>20%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — results */}
        <div className="space-y-4">

          {/* Net profit hero */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6 text-center">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Net Profit</p>
            <div className={`flex items-center justify-center gap-2 text-5xl font-bold tracking-tight ${profitPositive ? "text-emerald-400" : "text-red-400"}`}>
              {profitPositive ? <TrendingUp size={32} /> : <TrendingDown size={32} />}
              {profitPositive ? "+" : ""}£{fmt(calc.netProfit)}
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/5">
              <div className="py-3 text-center">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Margin</p>
                <p className={`mt-1 text-lg font-semibold ${calc.margin >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pct(calc.margin)}%
                </p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">ROI</p>
                <p className={`mt-1 text-lg font-semibold ${calc.roi >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {calc.roi !== 0 ? `${pct(calc.roi)}%` : "—"}
                </p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Total Sale</p>
                <p className="mt-1 text-lg font-semibold text-white">£{fmt(calc.totalSale)}</p>
              </div>
            </div>
          </div>

          {/* eBay fee breakdown */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">eBay Fee Breakdown</p>
            <div className="divide-y divide-white/5">
              {row(`Final Value Fee (${pct(category.fvf * 100 * (topRated && sellerType === "business" ? 0.9 : 1))}%)`, `£${fmt(calc.finalValueFee)}`)}
              {sellerType === "business" && row("Per-order fee", `£${fmt(calc.perOrderFee)}`)}
              {sellerType === "business" && row("Regulatory operating fee (0.35%)", `£${fmt(calc.regOpFee)}`)}
              {international && row("International fee (1.7%)", `£${fmt(calc.internationalFee)}`)}
              {promotedRate > 0 && row(`Promoted listing (${pct(promotedRate)}%)`, `£${fmt(calc.promotedFee)}`)}
              {sellerType === "business" && row("VAT on fees (20%)", `£${fmt(calc.vatOnFees)}`)}
            </div>
            <div className="mt-2 border-t border-white/10 pt-3 flex items-center justify-between text-sm font-semibold">
              <span className="text-white">Total eBay Fees</span>
              <span className="text-amber-400">£{fmt(calc.totalFees)} ({pct(calc.totalFeesPct)}%)</span>
            </div>
          </div>

          {/* Cost breakdown */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Cost Breakdown</p>
            <div className="divide-y divide-white/5">
              {row("Stock cost", `£${fmt(calc.stockCost)}`)}
              {row("Shipping (your cost)", `£${fmt(calc.totalShipCost)}`)}
              {row("eBay fees", `£${fmt(calc.totalFees)}`)}
            </div>
            <div className="mt-2 border-t border-white/10 pt-3 flex items-center justify-between text-sm font-semibold">
              <span className="text-white">Total Cost</span>
              <span className="text-amber-400">£{fmt(calc.totalCost)}</span>
            </div>
          </div>

          {/* Target prices */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-slate-500">Target Prices</p>
            <div className="divide-y divide-white/5">
              <div className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400">Break-even (minimum to not lose money)</span>
                <span className="font-semibold text-white">
                  {calc.breakeven > 0 ? `£${fmt(calc.breakeven)}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-400">Target sell price for 20% margin</span>
                <span className="font-semibold text-emerald-400">
                  {calc.target20 > 0 ? `£${fmt(calc.target20)}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
