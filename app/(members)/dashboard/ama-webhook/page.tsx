"use client";

import { useMemo, useState } from "react";
import {
  Send,
  BadgePoundSterling,
  ImageIcon,
  Upload,
  Trash2,
} from "lucide-react";

type WebhookTarget = "kicks-flips" | "flips" | "sneakers-clothing";

const WEBHOOK_OPTIONS: { value: WebhookTarget; label: string }[] = [
  { value: "kicks-flips", label: "Kicks Flips" },
  { value: "flips", label: "Flips" },
  { value: "sneakers-clothing", label: "Sneakers & Clothing" },
];

const RISK_LABELS: Record<number, string> = {
  1: "Very Low ✅",
  2: "Low 🟢",
  3: "Medium 🟡",
  4: "High 🟠",
  5: "Very High 🔴",
};

const RISK_ACTIVE: Record<number, string> = {
  1: "border-emerald-400/60 text-emerald-300 bg-emerald-500/10",
  2: "border-lime-400/60 text-lime-300 bg-lime-500/10",
  3: "border-yellow-400/60 text-yellow-300 bg-yellow-500/10",
  4: "border-orange-400/60 text-orange-300 bg-orange-500/10",
  5: "border-red-400/60 text-red-300 bg-red-500/10",
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

function parsePrice(val: string): number {
  return parseFloat(val.replace(/[^0-9.]/g, "")) || 0;
}

export default function AmaWebhookPage() {
  const [webhookTarget, setWebhookTarget] = useState<WebhookTarget>("kicks-flips");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [link1Label, setLink1Label] = useState("");
  const [link1Url, setLink1Url] = useState("");
  const [link2Label, setLink2Label] = useState("");
  const [link2Url, setLink2Url] = useState("");
  const [retail, setRetail] = useState("");
  const [resell, setResell] = useState("");
  const [whyFlips, setWhyFlips] = useState("");
  const [riskRating, setRiskRating] = useState(3);
  const [returnsInfo, setReturnsInfo] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [cashback, setCashback] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);

  const previewImage = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return imageUrl;
  }, [imageFile, imageUrl]);

  const selectedLabel = useMemo(() => {
    return WEBHOOK_OPTIONS.find((o) => o.value === webhookTarget)?.label ?? "";
  }, [webhookTarget]);

  const retailNum = parsePrice(retail);
  const resellNum = parsePrice(resell);
  const profitNum = retailNum > 0 && resellNum > 0 ? resellNum - retailNum : null;
  const profitStr = profitNum !== null ? `£${profitNum.toFixed(2)}` : "";
  const roiStr = profitNum !== null && retailNum > 0
    ? `${((profitNum / retailNum) * 100).toFixed(1)}%`
    : "";

  function clearAll() {
    setTitle("");
    setDate("");
    setTime("");
    setLink1Label("");
    setLink1Url("");
    setLink2Label("");
    setLink2Url("");
    setRetail("");
    setResell("");
    setWhyFlips("");
    setRiskRating(3);
    setReturnsInfo("");
    setDiscountCode("");
    setCashback("");
    setImageUrl("");
    setImageFile(null);
    setMessage("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("webhookTarget", webhookTarget);
      formData.append("title", title);
      formData.append("date", date);
      formData.append("time", time);
      formData.append("link1Label", link1Label);
      formData.append("link1Url", link1Url);
      formData.append("link2Label", link2Label);
      formData.append("link2Url", link2Url);
      formData.append("retail", retailNum > 0 ? `£${retailNum.toFixed(2)}` : "");
      formData.append("resell", resellNum > 0 ? `£${resellNum.toFixed(2)}` : "");
      formData.append("profit", profitStr);
      formData.append("roi", roiStr);
      formData.append("whyFlips", whyFlips);
      formData.append("riskRating", String(riskRating));
      formData.append("returnsInfo", returnsInfo);
      formData.append("discountCode", discountCode);
      formData.append("cashback", cashback);
      formData.append("imageUrl", imageUrl);
      if (imageFile) formData.append("imageFile", imageFile);

      const res = await fetch("/api/ama-webhook", {
        method: "POST",
        body: formData,
      });

      const data: ApiResponse = await res.json();
      setResult(data);

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to send webhook.");
        setLoading(false);
        return;
      }

      setMessage("Drop alert sent to " + selectedLabel + "! ✅");
      setTitle("");
      setDate("");
      setTime("");
      setLink1Label("");
      setLink1Url("");
      setLink2Label("");
      setLink2Url("");
      setRetail("");
      setResell("");
      setWhyFlips("");
      setRiskRating(3);
      setReturnsInfo("");
      setDiscountCode("");
      setCashback("");
      setImageUrl("");
      setImageFile(null);
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Send size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AMA Webhook</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Build a drop alert, check the live preview on the right, then send it to your chosen Discord channel. Members will be pinged automatically.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Form */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-5">

            {/* Send To */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Send To</label>
              <select
                value={webhookTarget}
                onChange={(e) => setWebhookTarget(e.target.value as WebhookTarget)}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
              >
                {WEBHOOK_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Drop Title */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Drop Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Nike Air Max 95 — OG Neon"
                required
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </div>

            {/* Date & Time */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Time (GMT) <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
                />
              </div>
            </div>

            {/* Links */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 Label</label>
                <input
                  value={link1Label}
                  onChange={(e) => setLink1Label(e.target.value)}
                  placeholder="e.g. Buy Here"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 URL</label>
                <input
                  value={link1Url}
                  onChange={(e) => setLink1Url(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Link 2 Label <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={link2Label}
                  onChange={(e) => setLink2Label(e.target.value)}
                  placeholder="e.g. Checklist PDF"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Link 2 URL <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={link2Url}
                  onChange={(e) => setLink2Url(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Retail Price</label>
                <input
                  value={retail}
                  onChange={(e) => setRetail(e.target.value)}
                  placeholder="e.g. 180"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Resell Price</label>
                <input
                  value={resell}
                  onChange={(e) => setResell(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
            </div>

            {profitStr ? (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Auto-calculated</span>
                <span className="text-sm font-semibold text-emerald-300">{profitStr} profit</span>
                {roiStr ? (
                  <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                    {roiStr} ROI
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Why This Flips */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Why This Flips</label>
              <textarea
                value={whyFlips}
                onChange={(e) => setWhyFlips(e.target.value)}
                placeholder="Explain why this drop is worth picking up..."
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </div>

            {/* Risk Rating */}
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-300">
                Risk Rating — <span className="font-semibold">{RISK_LABELS[riskRating]}</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRiskRating(n)}
                    className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                      riskRating === n
                        ? RISK_ACTIVE[n]
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Returns Info */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Returns Information</label>
              <textarea
                value={returnsInfo}
                onChange={(e) => setReturnsInfo(e.target.value)}
                placeholder="e.g. Consistently sells within 48 hrs. eBay comps show £230–£270..."
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </div>

            {/* Discount & Cashback */}
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Discount Code <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="e.g. SAVE10"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Cashback <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={cashback}
                  onChange={(e) => setCashback(e.target.value)}
                  placeholder="e.g. 3.5% via TopCashback"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
            </div>

            {/* Image URL */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Image URL <span className="text-slate-500">(optional)</span>
              </label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-transparent py-3 text-white outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Upload Image From Device <span className="text-slate-500">(optional)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-[#030814] px-4 py-4 text-slate-300 hover:border-blue-400/40">
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm">
                  {imageFile ? imageFile.name : "Browse your phone/computer and select an image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                  }}
                />
              </label>
              {imageFile ? (
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="mt-2 text-xs text-red-300 hover:text-red-200"
                >
                  Remove uploaded image
                </button>
              ) : null}
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Sending..." : `Send to ${selectedLabel}`}
              </button>
              <button
                type="button"
                onClick={clearAll}
                title="Clear all fields"
                className="flex items-center justify-center rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-4 text-red-300 transition hover:bg-red-500/20"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </div>
            ) : null}

            {result && !result.ok ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {result.error || "Something went wrong."}
              </div>
            ) : null}

          </form>
        </div>

        {/* Live Preview */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <BadgePoundSterling size={20} className="text-blue-300" />
            Live Preview
          </div>

          <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">
            Sending to: {selectedLabel}
          </div>

          <div className="rounded-2xl border-l-4 border-blue-500 bg-[#2b2d31] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] space-y-3 text-sm">

            <p className="font-bold text-white text-base">
              ⚙️ {title || "Drop Title Will Appear Here"}
            </p>

            {(date || time) ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🕐 TIME &amp; DATE</p>
                <p className="text-slate-200">
                  {date ? new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
                  {date && time ? " — " : ""}
                  {time ? time + " GMT" : ""}
                </p>
              </div>
            ) : null}

            {(link1Label || link2Label) ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🔗 LINKS</p>
                {link1Label ? <p className="text-blue-400">ℹ️ {link1Label}</p> : null}
                {link2Label ? <p className="text-blue-400">📋 {link2Label}</p> : null}
              </div>
            ) : null}

            {(retail || resell || profitStr) ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">💰 PRICING</p>
                {retail ? <p className="text-slate-200">🏷️ Retail: <span className="font-medium text-white">£{retailNum.toFixed(2)}</span></p> : null}
                {resell ? <p className="text-slate-200">📈 Resell: <span className="font-medium text-white">£{resellNum.toFixed(2)}</span></p> : null}
                {profitStr ? (
                  <p className="text-slate-200">
                    ✅ Profit: <span className="font-medium text-emerald-300">{profitStr} Before Fees Per Unit</span>
                    {roiStr ? <span className="ml-2 text-xs text-slate-400">({roiStr} ROI)</span> : null}
                  </p>
                ) : null}
              </div>
            ) : null}

            {whyFlips ? (
              <div>
                <p className="text-slate-600">──────────────────────</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">📊 WHY THIS FLIPS</p>
                <p className="text-slate-200 whitespace-pre-line leading-relaxed">{whyFlips}</p>
              </div>
            ) : null}

            <div>
              <p className="text-slate-600">──────────────────────</p>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">⚠️ RISK &amp; RETURNS</p>
              <p className="text-slate-200">Risk Rating: <span className="font-semibold">{riskRating}/5 — {RISK_LABELS[riskRating]}</span></p>
              {returnsInfo ? <p className="mt-1 text-slate-200 whitespace-pre-line">{returnsInfo}</p> : null}
            </div>

            {(discountCode || cashback) ? (
              <div>
                <p className="text-slate-600">──────────────────────</p>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🎓 DISCOUNTS / CASHBACK</p>
                {discountCode ? <p className="text-slate-200">🏷️ Discount Code: <span className="text-white">{discountCode}</span></p> : null}
                {cashback ? <p className="text-slate-200">💳 Cashback: <span className="text-white">{cashback}</span></p> : null}
              </div>
            ) : null}

            {previewImage ? (
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img src={previewImage} alt="Drop preview" className="h-auto max-h-[320px] w-full object-cover" />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">
                Optional image preview will appear here
              </div>
            )}

            <p className="text-slate-600">──────────────────────</p>
            <p className="text-xs font-medium text-indigo-400">@Members (role ping will fire on send)</p>
            <p className="text-xs font-medium text-slate-400">Aftermarket Arbitrage | 2026</p>
          </div>
        </div>
      </section>
    </div>
  );
}
