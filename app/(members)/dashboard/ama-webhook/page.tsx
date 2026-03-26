"use client";

import { useMemo, useState } from "react";
import {
  Send,
  Calendar,
  PoundSterling,
  TrendingUp,
  AlertTriangle,
  Tag,
  Link as LinkIcon,
  ChevronDown,
  ImageIcon,
  Upload,
  X,
  Eye,
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

type WebhookTarget = "kicks-flips" | "flips" | "sneakers-clothing";

const WEBHOOK_OPTIONS: { value: WebhookTarget; label: string }[] = [
  { value: "kicks-flips", label: "Kicks Flips" },
  { value: "flips", label: "Flips" },
  { value: "sneakers-clothing", label: "Sneakers & Clothing" },
];

type ApiResponse = { ok?: boolean; error?: string };

const MEMBER_ROLE_ID = "726446805667020892";

function DiscordEmbed({
  title, date, time,
  link1Label, link1Url, link2Label, link2Url,
  retail, resell, profit,
  whyFlips, riskRating, returnsInfo,
  discountCode, cashback,
  previewImage,
}: {
  title: string; date: string; time: string;
  link1Label: string; link1Url: string; link2Label: string; link2Url: string;
  retail: string; resell: string; profit: string;
  whyFlips: string; riskRating: number; returnsInfo: string;
  discountCode: string; cashback: string;
  previewImage: string;
}) {
  const profitColor = profit ? "text-emerald-300" : "text-slate-400";

  return (
    <div className="rounded-2xl border-l-4 border-blue-500 bg-[#2b2d31] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.35)] space-y-4 text-sm">
      <p className="font-bold text-white text-base leading-snug">
        ⚙️ {title || "Drop Title Will Appear Here"}
      </p>

      {(date || time) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🕐 TIME & DATE</p>
          <p className="text-slate-200">
            {date ? new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
            {date && time ? " — " : ""}
            {time ? `${time} GMT` : ""}
          </p>
        </div>
      )}

      {(link1Label || link2Label) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🔗 LINKS</p>
          {link1Label && (
            <p className="text-blue-400">
              ℹ️ {link1Url ? <a href={link1Url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{link1Label}</a> : link1Label}
            </p>
          )}
          {link2Label && (
            <p className="text-blue-400">
              📋 {link2Url ? <a href={link2Url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{link2Label}</a> : link2Label}
            </p>
          )}
        </div>
      )}

      {(retail || resell || profit) && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">💰 PRICING</p>
          {retail && <p className="text-slate-200">🏷️ Retail: <span className="text-white font-medium">{retail}</span></p>}
          {resell && <p className="text-slate-200">📈 Resell: <span className="text-white font-medium">{resell}</span></p>}
          {profit && <p className="text-slate-200">✅ Profit: <span className={`font-medium ${profitColor}`}>{profit} Before Fees Per Unit</span></p>}
        </div>
      )}

      {whyFlips && <p className="text-slate-600 select-none">──────────────────────</p>}
      {whyFlips && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">📊 WHY THIS FLIPS</p>
          <p className="text-slate-200 whitespace-pre-line leading-relaxed">{whyFlips}</p>
        </div>
      )}

      <p className="text-slate-600 select-none">──────────────────────</p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">⚠️ RISK & RETURNS</p>
        <p className="text-slate-200">
          Risk Rating: <span className={`font-semibold ${RISK_COLORS[riskRating].split(" ")[0]}`}>{riskRating}/5 — {RISK_LABELS[riskRating]}</span>
        </p>
        {returnsInfo && <p className="mt-1 text-slate-200 whitespace-pre-line leading-relaxed">{returnsInfo}</p>}
      </div>

      {(discountCode || cashback) && (
        <>
          <p className="text-slate-600 select-none">──────────────────────</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">🎓 DISCOUNTS / CASHBACK</p>
            {discountCode && <p className="text-slate-200">🏷️ Discount Code: <span className="text-white">{discountCode}</span></p>}
            {cashback && <p className="text-slate-200">💳 Cashback: <span className="text-white">{cashback}</span></p>}
          </div>
        </>
      )}

      {previewImage && (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <img src={previewImage} alt="Drop preview" className="h-auto max-h-[280px] w-full object-cover" />
        </div>
      )}

      <p className="text-slate-600 select-none">──────────────────────</p>
      {/* Member ping preview */}
      <p className="text-xs font-medium text-indigo-400">@Members (role ping will fire on send)</p>
      <p className="text-xs text-slate-400 font-medium">Aftermarket Arbitrage | 2026</p>
    </div>
  );
}

function PreviewModal({
  selectedLabel, onClose, onConfirm, loading, embedProps,
}: {
  selectedLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  embedProps: React.ComponentProps<typeof DiscordEmbed>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close preview" />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[24px] border border-white/10 bg-[#071021] p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Preview Before Sending</h2>
            <p className="mt-1 text-xs text-slate-400">
              Sending to <span className="font-medium text-white">{selectedLabel}</span> — members will be pinged
            </p>
          </div>
          <button type="button" onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white transition">
            <X size={16} />
          </button>
        </div>
        <DiscordEmbed {...embedProps} />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10">
            ← Go Back & Edit
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
            {loading ? "Sending..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const [profit, setProfit] = useState("");
  const [whyFlips, setWhyFlips] = useState("");
  const [riskRating, setRiskRating] = useState(3);
  const [returnsInfo, setReturnsInfo] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [cashback, setCashback] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);

  const previewImage = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return imageUrl;
  }, [imageFile, imageUrl]);

  const selectedLabel = WEBHOOK_OPTIONS.find(o => o.value === webhookTarget)?.label ?? "";

  const embedProps = {
    title, date, time,
    link1Label, link1Url, link2Label, link2Url,
    retail, resell, profit,
    whyFlips, riskRating, returnsInfo,
    discountCode, cashback,
    previewImage,
  };

  async function sendWebhook() {
    setLoading(true);
    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = () => rej(new Error("Failed to read file"));
          r.readAsDataURL(imageFile);
        });
      }

      const res = await fetch("/api/ama-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookTarget, title, date, time,
          link1Label, link1Url, link2Label, link2Url,
          retail, resell, profit,
          whyFlips, riskRating, returnsInfo,
          discountCode, cashback,
          imageUrl: finalImageUrl || undefined,
        }),
      });

      const data: ApiResponse = await res.json();
      setResult(data);
      setShowPreview(false);

      if (!res.ok || !data.ok) {
        setMessage(data.error || "Failed to send webhook.");
        return;
      }

      setMessage(`Drop alert sent to ${selectedLabel}! ✅`);
      setTitle(""); setDate(""); setTime("");
      setLink1Label(""); setLink1Url(""); setLink2Label(""); setLink2Url("");
      setRetail(""); setResell(""); setProfit("");
      setWhyFlips(""); setRiskRating(3); setReturnsInfo("");
      setDiscountCode(""); setCashback("");
      setImageUrl(""); setImageFile(null);
    } catch {
      setMessage("Something went wrong.");
      setShowPreview(false);
    } finally {
      setLoading(false);
    }
  }

  function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setShowPreview(true);
  }

  return (
    <>
      {showPreview && (
        <PreviewModal
          selectedLabel={selectedLabel}
          onClose={() => setShowPreview(false)}
          onConfirm={sendWebhook}
          loading={loading}
          embedProps={embedProps}
        />
      )}

      <div className="space-y-8">
        <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
              <Send size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">AMA Webhook</h1>
              <p className="mt-3 max-w-2xl text-slate-400">
                Build a full drop alert, preview exactly how it will look in Discord, then fire it to your chosen channel. Members will be pinged automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
            <form onSubmit={handlePreview} className="grid gap-6">

              {/* Webhook Destination */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <ChevronDown size={16} className="text-blue-400" />
                  Send To
                </label>
                <select value={webhookTarget} onChange={e => setWebhookTarget(e.target.value as WebhookTarget)}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40">
                  {WEBHOOK_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Drop Info */}
              <FormSection icon={<Calendar size={16} />} label="Drop Info">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Drop Title</label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Nike Air Max 95 — OG Neon" required
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Time (GMT)</label>
                    <input type="time" value={time} onChange={e => setTime(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40" />
                  </div>
                </div>
              </FormSection>

              {/* Links */}
              <FormSection icon={<LinkIcon size={16} />} label="Links">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 Label</label>
                    <input value={link1Label} onChange={e => setLink1Label(e.target.value)} placeholder="e.g. Buy Here"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Link 1 URL</label>
                    <input value={link1Url} onChange={e => setLink1Url(e.target.value)} placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Link 2 Label <span className="text-slate-500">(optional)</span></label>
                    <input value={link2Label} onChange={e => setLink2Label(e.target.value)} placeholder="e.g. Checklist PDF"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Link 2 URL <span className="text-slate-500">(optional)</span></label>
                    <input value={link2Url} onChange={e => setLink2Url(e.target.value)} placeholder="https://..."
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                </div>
              </FormSection>

              {/* Pricing */}
              <FormSection icon={<PoundSterling size={16} />} label="Pricing">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Retail Price</label>
                    <input value={retail} onChange={e => setRetail(e.target.value)} placeholder="e.g. £180"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Resell Price</label>
                    <input value={resell} onChange={e => setResell(e.target.value)} placeholder="e.g. £250"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Profit (Before Fees)</label>
                    <input value={profit} onChange={e => setProfit(e.target.value)} placeholder="e.g. £70"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                </div>
              </FormSection>

              {/* Why This Flips */}
              <FormSection icon={<TrendingUp size={16} />} label="Why This Flips">
                <textarea value={whyFlips} onChange={e => setWhyFlips(e.target.value)} rows={5}
                  placeholder="Explain why this drop is worth picking up..."
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
              </FormSection>

              {/* Risk & Returns */}
              <FormSection icon={<AlertTriangle size={16} />} label="Risk & Returns">
                <div>
                  <label className="mb-3 block text-sm font-medium text-slate-300">
                    Risk Rating — <span className={`font-semibold ${RISK_COLORS[riskRating].split(" ")[0]}`}>{RISK_LABELS[riskRating]}</span>
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => setRiskRating(n)}
                        className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                          riskRating === n ? `${RISK_COLORS[n]} border-current` : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Returns Information</label>
                  <textarea value={returnsInfo} onChange={e => setReturnsInfo(e.target.value)} rows={3}
                    placeholder="e.g. Consistently sells within 48 hrs. eBay comps show £230–£270..."
                    className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                </div>
              </FormSection>

              {/* Discounts & Cashback */}
              <FormSection icon={<Tag size={16} />} label="Discounts / Cashback">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Discount Code</label>
                    <input value={discountCode} onChange={e => setDiscountCode(e.target.value)} placeholder="e.g. SAVE10"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-300">Cashback</label>
                    <input value={cashback} onChange={e => setCashback(e.target.value)} placeholder="e.g. 3.5% via TopCashback"
                      className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
                  </div>
                </div>
              </FormSection>

              {/* Image */}
              <FormSection icon={<ImageIcon size={16} />} label="Image (optional)">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-300">Image URL</label>
                  <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                    <ImageIcon size={16} className="shrink-0 text-slate-500" />
                    <input value={imageUrl}
                      onChange={e => { setImageUrl(e.target.value); if (e.target.value) setImageFile(null); }}
                      placeholder="https://..."
                      className="w-full bg-transparent px-3 py-3 text-white outline-none placeholder:text-slate-500" />
                    {imageUrl && (
                      <button type="button" onClick={() => setImageUrl("")} className="text-slate-500 hover:text-red-300 transition">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <div className="h-px flex-1 bg-white/10" />
                  <span>or upload from device</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-[#030814] px-4 py-4 text-slate-300 hover:border-blue-400/40 transition">
                  <Upload size={18} className="shrink-0 text-slate-400" />
                  <span className="text-sm truncate">
                    {imageFile ? imageFile.name : "Browse your phone or computer"}
                  </span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0] || null;
                      setImageFile(file);
                      if (file) setImageUrl("");
                    }} />
                </label>
                {imageFile && (
                  <button type="button" onClick={() => setImageFile(null)} className="text-xs text-red-300 hover:text-red-200 transition">
                    Remove uploaded image
                  </button>
                )}
                {previewImage && (
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <img src={previewImage} alt="Preview" className="h-auto max-h-[180px] w-full object-cover" />
                  </div>
                )}
              </FormSection>

              <button type="submit"
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500">
                <Eye size={18} />
                Preview Before Sending
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

          {/* Live Preview */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
            <div className="mb-2 flex items-center gap-2 text-xl font-semibold">
              <Send size={20} className="text-blue-300" />
              Live Preview
            </div>
            <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              Sending to: <span className="ml-1 font-semibold text-white">{selectedLabel}</span>
            </div>
            <DiscordEmbed {...embedProps} />
          </div>
        </section>
      </div>
    </>
  );
}

function FormSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
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
