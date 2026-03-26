"use client";

import { useState } from "react";
import {
  Send,
  Calendar,
  PoundSterling,
  TrendingUp,
  AlertTriangle,
  Tag,
  FileText,
  Link as LinkIcon,
} from "lucide-react";

const RISK_LABELS: Record<number, string> = {
  1: "Very Low ✅",
  2: "Low 🟢",
  3: "Medium 🟡",
  4: "High 🟠",
  5: "Very High 🔴",
};

const RISK_COLORS: Record<number, string> = {
  1: "text-emerald-300 border-emerald-400/20 bg-emerald-500/10",
  2: "text-lime-300 border-lime-400/20 bg-lime-500/10",
  3: "text-yellow-300 border-yellow-400/20 bg-yellow-500/10",
  4: "text-orange-300 border-orange-400/20 bg-orange-500/10",
  5: "text-red-300 border-red-400/20 bg-red-500/10",
};

type ApiResponse = {
  ok?: boolean;
  error?: string;
};

export default function AmaWebhookPage() {
  // Drop Info
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Links
  const [link1Label, setLink1Label] = useState("");
  const [link1Url, setLink1Url] = useState("");
  const [link2Label, setLink2Label] = useState("");
  const [link2Url, setLink2Url] = useState("");

  // Pricing
  const [retail, setRetail] = useState("");
  const [resell, setResell] = useState("");
  const [profit, setProfit] = useState("");

  // Why This Flips
  const [whyFlips, setWhyFlips] = useState("");

  // Risk & Returns
  const [riskRating, setRiskRating] = useState(3);
  const [returnsInfo, setReturnsInfo] = useState("");

  // Discounts & Cashback
  const [studentDiscount, setStudentDiscount] = useState("");
  const [cashback, setCashback] = useState("");

  // Partnership
  const [partnershipInfo, setPartnershipInfo] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const res = await fetch("/api/ama-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          date,
          time,
          link1Label,
          link1Url,
          link2Label,
          link2Url,
          retail,
          resell,
          profit,
          whyFlips,
          riskRating,
          returnsInfo,
          studentDiscount,
          cashback,
          partnershipInfo,
        }),
      });

      const data: ApiResponse = await res.json();
      setResult(data);

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to send webhook.");
        setLoading(false);
        return;
      }

      setMessage("Drop alert sent successfully! ✅");
      // Reset form
      setTitle(""); setDate(""); setTime("");
      setLink1Label(""); setLink1Url(""); setLink2Label(""); setLink2Url("");
      setRetail(""); setResell(""); setProfit("");
      setWhyFlips(""); setRiskRating(3); setReturnsInfo("");
      setStudentDiscount(""); setCashback(""); setPartnershipInfo("");
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Derived profit colour for preview
  const profitColor = profit ? "text-emerald-300" : "text-slate-400";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Send size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AMA Webhook</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Build a full drop alert — pricing, flip analysis, risk rating, discounts and partnership info — then fire it straight to your Discord channel.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* ── FORM ── */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-6">

            {/* Drop Info */}
            <FormSection icon={<Calendar size={16} />} label="Drop Info">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Drop Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Topps® UCC Gold 2025/26 — Hobby Box"
                  required
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Time (GMT)</label>
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40"
                  />
                </div>
              </div>
            </FormSection>

            {/* Links */}
            <FormSection icon={<LinkIcon size={16} />} label="Links">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 Label</label>
                  <input
                    value={link1Label}
                    onChange={e => setLink1Label(e.target.value)}
                    placeholder="e.g. Topps UK — UCC Gold"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 URL</label>
                  <input
                    value={link1Url}
                    onChange={e => setLink1Url(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Link 2 Label <span className="text-slate-500">(optional)</span></label>
                  <input
                    value={link2Label}
                    onChange={e => setLink2Label(e.target.value)}
                    placeholder="e.g. Checklist PDF"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Link 2 URL <span className="text-slate-500">(optional)</span></label>
                  <input
                    value={link2Url}
                    onChange={e => setLink2Url(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
              </div>
            </FormSection>

            {/* Pricing */}
            <FormSection icon={<PoundSterling size={16} />} label="Pricing">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Retail Price</label>
                  <input
                    value={retail}
                    onChange={e => setRetail(e.target.value)}
                    placeholder="e.g. £180"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Resell Price</label>
                  <input
                    value={resell}
                    onChange={e => setResell(e.target.value)}
                    placeholder="e.g. £250"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Profit (Before Fees)</label>
                  <input
                    value={profit}
                    onChange={e => setProfit(e.target.value)}
                    placeholder="e.g. £70"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
              </div>
            </FormSection>

            {/* Why This Flips */}
            <FormSection icon={<TrendingUp size={16} />} label="Why This Flips">
              <textarea
                value={whyFlips}
                onChange={e => setWhyFlips(e.target.value)}
                placeholder="Explain why this drop is worth picking up — key details, demand drivers, historical performance..."
                rows={5}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </FormSection>

            {/* Risk & Returns */}
            <FormSection icon={<AlertTriangle size={16} />} label="Risk & Returns">
              <div>
                <label className="mb-3 block text-sm font-medium text-slate-300">
                  Risk Rating — <span className={`font-semibold ${RISK_COLORS[riskRating].split(" ")[0]}`}>{RISK_LABELS[riskRating]}</span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRiskRating(n)}
                      className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                        riskRating === n
                          ? `${RISK_COLORS[n]} border-current`
                          : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Returns Information</label>
                <textarea
                  value={returnsInfo}
                  onChange={e => setReturnsInfo(e.target.value)}
                  placeholder="e.g. Online exclusives typically sell through within 48 hrs. eBay comp shows consistent £230-£270 range..."
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                />
              </div>
            </FormSection>

            {/* Student Discounts & Cashback */}
            <FormSection icon={<Tag size={16} />} label="Student Discounts / Cashback">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Student Discount</label>
                  <input
                    value={studentDiscount}
                    onChange={e => setStudentDiscount(e.target.value)}
                    placeholder="e.g. 10% off with UNIDAYS"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Cashback</label>
                  <input
                    value={cashback}
                    onChange={e => setCashback(e.target.value)}
                    placeholder="e.g. 3.5% via TopCashback"
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
                  />
                </div>
              </div>
            </FormSection>

            {/* Partnership Info */}
            <FormSection icon={<FileText size={16} />} label="Partnership Info">
              <textarea
                value={partnershipInfo}
                onChange={e => setPartnershipInfo(e.target.value)}
                placeholder="e.g. HitTheDrop is running this drop for ResellRadar members. Check them out: #hit-the-drop"
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40"
              />
            </FormSection>

            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Drop Alert"}
            </button>

            {message && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${
                message.includes("✅")
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                  : "border-red-400/20 bg-red-500/10 text-red-300"
              }`}>
                {message}
              </div>
            )}
          </form>
        </div>

        {/* ── LIVE PREVIEW ── */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Send size={20} className="text-blue-300" />
            Discord Preview
          </div>

          {/* Simulated Discord embed */}
          <div className="rounded-2xl border-l-4 border-blue-500 bg-[#2b2d31] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4 text-sm">

            {/* Title */}
            <div>
              <p className="font-bold text-white text-base leading-snug">
                ⚙️ {title || "Drop Title Will Appear Here"}
              </p>
            </div>

            {/* Time & Date */}
            {(date || time) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🕐 TIME & DATE</p>
                <p className="text-slate-200">
                  {date ? new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}{date && time ? " — " : ""}{time ? `${time} GMT` : ""}
                </p>
              </div>
            )}

            {/* Links */}
            {(link1Label || link2Label) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🔗 LINKS</p>
                {link1Label && <p className="text-blue-400">ℹ️ {link1Label}</p>}
                {link2Label && <p className="text-blue-400">📋 {link2Label}</p>}
              </div>
            )}

            {/* Pricing */}
            {(retail || resell || profit) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">💰 PRICING</p>
                {retail && <p className="text-slate-200">🏷️ Retail: <span className="text-white font-medium">{retail}</span></p>}
                {resell && <p className="text-slate-200">📈 Resell: <span className="text-white font-medium">{resell}</span></p>}
                {profit && <p className="text-slate-200">✅ Profit: <span className={`font-medium ${profitColor}`}>{profit} Before Fees Per Unit</span></p>}
              </div>
            )}

            {/* Divider */}
            {whyFlips && <p className="text-slate-600 select-none">──────────────────────</p>}

            {/* Why This Flips */}
            {whyFlips && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">📊 WHY THIS FLIPS</p>
                <p className="text-slate-200 whitespace-pre-line leading-relaxed">{whyFlips}</p>
              </div>
            )}

            {/* Divider */}
            {(riskRating || returnsInfo) && <p className="text-slate-600 select-none">──────────────────────</p>}

            {/* Risk & Returns */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">⚠️ RISK & RETURNS</p>
              <p className="text-slate-200">
                Risk Rating: <span className={`font-semibold rounded px-1 ${RISK_COLORS[riskRating].split(" ")[0]}`}>{riskRating}/5 — {RISK_LABELS[riskRating]}</span>
              </p>
              {returnsInfo && <p className="mt-1 text-slate-200 whitespace-pre-line leading-relaxed">{returnsInfo}</p>}
            </div>

            {/* Student / Cashback */}
            {(studentDiscount || cashback) && (
              <>
                <p className="text-slate-600 select-none">──────────────────────</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🎓 STUDENT DISCOUNTS / CASHBACK</p>
                  {studentDiscount && <p className="text-slate-200">🎒 Student: <span className="text-white">{studentDiscount}</span></p>}
                  {cashback && <p className="text-slate-200">💳 Cashback: <span className="text-white">{cashback}</span></p>}
                </div>
              </>
            )}

            {/* Partnership */}
            {partnershipInfo && (
              <>
                <p className="text-slate-600 select-none">──────────────────────</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🤝 PARTNERSHIP INFO</p>
                  <p className="text-slate-200 whitespace-pre-line leading-relaxed">{partnershipInfo}</p>
                </div>
              </>
            )}

            {/* Footer */}
            <p className="text-slate-600 select-none">──────────────────────</p>
            <p className="text-xs text-slate-400 font-medium">ResellRadar® | Your Edge in Reselling</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── Small helper components ── */
function FormSection({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#030814] p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
        <span className="text-blue-400">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}
