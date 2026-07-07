"use client";

import { useMemo, useState } from "react";
import { Link as LinkIcon, PoundSterling, ImageIcon, Send, Upload, Wand2, Loader2 } from "lucide-react";

type Destination = "amazon" | "sneakers";
type PreviewTab = "website" | "discord" | "telegram";
type Priority = "instant_cop" | "profitable" | "personal_bargain";

const PRIORITY_CONFIG: Record<Priority, { label: string; emoji: string; discordColor: number; previewBorder: string; badgeBg: string; badgeText: string; }> = {
  instant_cop: { label: "Instant Cop", emoji: "⚡", discordColor: 0xef4444, previewBorder: "border-red-500", badgeBg: "bg-red-500", badgeText: "text-white" },
  profitable: { label: "Profitable", emoji: "💰", discordColor: 0x22c55e, previewBorder: "border-green-500", badgeBg: "bg-green-600", badgeText: "text-white" },
  personal_bargain: { label: "Personal Bargain", emoji: "🛒", discordColor: 0x3b82f6, previewBorder: "border-blue-500", badgeBg: "bg-blue-600", badgeText: "text-white" },
};

type ApiResponse = {
  ok?: boolean; error?: string;
  results?: { discord?: unknown; telegram?: unknown; website?: unknown; facebook?: unknown; };
  errors?: { discord?: string | object | null; telegram?: string | object | null; website?: string | object | null; facebook?: string | object | null; };
};

const BADGE_OPTIONS = ["", "Hot", "New", "Limited", "Flash Sale", "Clearance"];

function calcSavePct(price: string, was: string): string {
  const p = parseFloat(price) || 0; const w = parseFloat(was) || 0;
  if (!p || !w || w <= p) return "";
  return Math.round((1 - p / w) * 100) + "%";
}

type KeepaVerdict = "genuine_low" | "good_deal" | "not_a_deal" | "unknown";
type KeepaResult = { verdict: KeepaVerdict; message: string } | null;

const KEEPA_BADGE: Record<KeepaVerdict, { emoji: string; label: string; cls: string }> = {
  genuine_low: { emoji: "🟢", label: "Genuine Historic Low", cls: "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" },
  good_deal: { emoji: "🟡", label: "Good Deal (not lowest ever)", cls: "border-amber-400/20 bg-amber-500/10 text-amber-300" },
  not_a_deal: { emoji: "🔴", label: "Not a real deal — price has been lower", cls: "border-red-400/20 bg-red-500/10 text-red-300" },
  unknown: { emoji: "⚪", label: "Price history unavailable", cls: "border-white/10 bg-white/5 text-slate-400" },
};

export default function DealPostPage() {
  const [amazonUrl, setAmazonUrl] = useState("");
  const [asin, setAsin] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [keepaChecking, setKeepaChecking] = useState(false);
  const [keepaResult, setKeepaResult] = useState<KeepaResult>(null);
  const [destination, setDestination] = useState<Destination>("amazon");
  const [priority, setPriority] = useState<Priority>("instant_cop");
  const [productTitle, setProductTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [was, setWas] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [badge, setBadge] = useState("");
  const [expiry, setExpiry] = useState("");
  const [dotd, setDotd] = useState(false);
  const [postToDiscord, setPostToDiscord] = useState(true);
  const [postToTelegram, setPostToTelegram] = useState(true);
  const [postToWebsite, setPostToWebsite] = useState(true);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("website");

  const previewImage = useMemo(() => { if (imageFile) return URL.createObjectURL(imageFile); return imageUrl; }, [imageFile, imageUrl]);
  const savePct = calcSavePct(price, was);
  const cfg = PRIORITY_CONFIG[priority];
  const displayTitle = productTitle || "Product title will appear here";
  const displayDesc = description || "Short description will appear here.";
  const displayPrice = price || "0.00";

  function renderStatus(label: string, success: boolean, failure: boolean) {
    const state = success ? "Success" : failure ? "Failed" : "Not sent";
    const cls = success ? "text-emerald-300 border-emerald-400/20 bg-emerald-500/10" : failure ? "text-red-300 border-red-400/20 bg-red-500/10" : "text-slate-300 border-white/10 bg-white/5";
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#030814] px-4 py-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${cls}`}>{state}</span>
      </div>
    );
  }

  async function runKeepaCheck(asinToCheck: string, currentPrice: string) {
    setKeepaChecking(true);
    setKeepaResult(null);
    try {
      const res = await fetch("/api/keepa-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: asinToCheck, currentPrice }),
      });
      const data = await res.json();
      if (data.ok) setKeepaResult({ verdict: data.verdict, message: data.message });
    } catch {
      // Keepa check is a nice-to-have — silently skip on failure.
    } finally {
      setKeepaChecking(false);
    }
  }

  async function handleFetchAmazon() {
    if (!amazonUrl) return;
    setFetching(true);
    setFetchError("");
    setKeepaResult(null);
    try {
      const res = await fetch("/api/scrape-amazon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: amazonUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setFetchError(data.error || "Couldn't fetch that product. Please fill the fields in manually.");
        return;
      }
      if (data.title) setProductTitle(data.title);
      if (data.image) setImageUrl(data.image);
      if (data.price) setPrice(data.price);
      if (data.wasPrice) setWas(data.wasPrice);
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      if (data.affiliateLink) setLink(data.affiliateLink);
      setAsin(data.asin || "");
      if (data.asin && data.price) runKeepaCheck(data.asin, data.price);
    } catch {
      setFetchError("Something went wrong reaching Amazon. Please fill the fields in manually.");
    } finally {
      setFetching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setMessage(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("destination", destination); fd.append("priority", priority);
      fd.append("description", productTitle || description); fd.append("price", price);
      fd.append("was", was); fd.append("link", link); fd.append("imageUrl", imageUrl);
      fd.append("category", category); fd.append("badge", badge); fd.append("expiry", expiry);
      fd.append("dotd", String(dotd)); fd.append("productTitle", productTitle);
      fd.append("shortDescription", description); fd.append("postToDiscord", String(postToDiscord));
      fd.append("postToTelegram", String(postToTelegram)); fd.append("postToWebsite", String(postToWebsite)); fd.append("postToFacebook", String(postToFacebook));
      if (imageFile) fd.append("imageFile", imageFile);
      const res = await fetch("/api/post-discord", { method: "POST", body: fd });
      const data: ApiResponse = await res.json();
      setResult(data);
      if (!res.ok || !data.ok) { const failed = data.errors ? Object.keys(data.errors).join(", ") : ""; setMessage(failed ? `Some posts failed: ${failed}` : data.error || "Failed."); setLoading(false); return; }
      setMessage("Deal posted successfully. ✅");
      setProductTitle(""); setDescription(""); setPrice(""); setWas(""); setLink(""); setImageUrl(""); setImageFile(null); setCategory(""); setBadge(""); setExpiry(""); setDotd(false); setPriority("instant_cop");
      setAmazonUrl(""); setAsin(""); setKeepaResult(null); setFetchError("");
    } catch { setMessage("Something went wrong."); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300"><Send size={24} /></div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deal Poster</h1>
            <p className="mt-2 text-slate-400">Post deals to Discord, Telegram, Facebook and your website simultaneously.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4">
              <label className="mb-2 block text-sm font-medium text-slate-300">Amazon URL <span className="text-slate-500">(auto-fill the fields below)</span></label>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <LinkIcon size={18} className="text-slate-500" />
                  <input
                    value={amazonUrl}
                    onChange={e => setAmazonUrl(e.target.value)}
                    placeholder="https://www.amazon.co.uk/dp/XXXXXXXXXX"
                    className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleFetchAmazon}
                  disabled={fetching || !amazonUrl}
                  className="flex items-center gap-2 whitespace-nowrap rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
                >
                  {fetching ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  {fetching ? "Fetching..." : "Fetch Details"}
                </button>
              </div>
              {fetchError && (
                <p className="mt-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{fetchError}</p>
              )}
              {(keepaChecking || keepaResult) && (
                <div className="mt-3 flex items-center gap-2">
                  {keepaChecking ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-400">
                      <Loader2 size={12} className="animate-spin" /> Checking price history on Keepa...
                    </span>
                  ) : keepaResult ? (
                    <span
                      title={keepaResult.message}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${KEEPA_BADGE[keepaResult.verdict].cls}`}
                    >
                      {KEEPA_BADGE[keepaResult.verdict].emoji} {KEEPA_BADGE[keepaResult.verdict].label}
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Send To</label>
              <select value={destination} onChange={e => setDestination(e.target.value as Destination)} className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none">
                <option value="amazon">Amazon</option><option value="sneakers">Sneakers</option>
              </select>
            </div>

<div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Product Title</label>
              <input value={productTitle} onChange={e => setProductTitle(e.target.value)} placeholder="e.g. Nike Air Max 90 — Men's Trainers" required className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Short Description <span className="text-slate-500">(for Discord & Telegram)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Iconic trainer, huge saving!" rows={3} className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Current Price</label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <PoundSterling size={18} className="text-slate-500" />
                  <input value={price} onChange={e => setPrice(e.target.value)} placeholder="39.99" required className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Was / RRP <span className="text-slate-500">(optional)</span></label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <PoundSterling size={18} className="text-slate-500" />
                  <input value={was} onChange={e => setWas(e.target.value)} placeholder="89.99" className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
                </div>
              </div>
            </div>

            {savePct && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Saving</span>
                <span className="text-sm font-semibold text-emerald-300">Save {savePct} off RRP</span>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Affiliate Link</label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <LinkIcon size={18} className="text-slate-500" />
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://amzn.to/xxxxx" required className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Category <span className="text-slate-500">(optional)</span></label>
                <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Footwear, Tech" className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Badge <span className="text-slate-500">(optional)</span></label>
                <select value={badge} onChange={e => setBadge(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none">
                  {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b || "None"}</option>)}
                </select>
              </div>
            </div>

<div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Product Image URL <span className="text-slate-500">(optional)</span></label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <ImageIcon size={18} className="text-slate-500" />
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Upload Image From Device <span className="text-slate-500">(optional)</span></label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-[#030814] px-4 py-4 text-slate-300 hover:border-blue-400/40">
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm">{imageFile ? imageFile.name : "Browse and select an image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => { setImageFile(e.target.files?.[0] || null); }} />
              </label>
              {imageFile && <button type="button" onClick={() => setImageFile(null)} className="mt-2 text-xs text-red-300 hover:text-red-200">Remove image</button>}
            </div>

            {/* Destinations */}
            <div className="rounded-2xl border border-white/10 bg-[#030814] p-4">
              <div className="mb-3 text-sm font-medium text-slate-300">Post Destinations</div>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: "Discord", emoji: "🎮", checked: postToDiscord, set: setPostToDiscord },
                  { label: "Telegram", emoji: "✈️", checked: postToTelegram, set: setPostToTelegram },
                  { label: "Website", emoji: "🌐", checked: postToWebsite, set: setPostToWebsite },
                  { label: "Facebook", emoji: "📘", checked: postToFacebook, set: setPostToFacebook },
                ].map(({ label, emoji, checked, set }) => (
                  <label key={label} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm text-slate-200 cursor-pointer transition ${checked ? "border-blue-500/30 bg-blue-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
                    <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} className="h-4 w-4 accent-blue-500" />
                    <span>{emoji} {label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading} className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
              {loading ? "Posting..." : "🚀 Post Deal"}
            </button>

            {message && <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{message}</div>}

            {result && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-semibold text-white">Post Results</div>
                <div className="space-y-3">
                  {postToDiscord && renderStatus("🎮 Discord", Boolean(result?.results?.discord), Boolean(result?.errors?.discord))}
                  {postToTelegram && renderStatus("✈️ Telegram", Boolean(result?.results?.telegram), Boolean(result?.errors?.telegram))}
                  {postToWebsite && renderStatus("🌐 Website", Boolean(result?.results?.website), Boolean(result?.errors?.website))}
                  {postToFacebook && renderStatus("📘 Facebook", Boolean(result?.results?.facebook), Boolean(result?.errors?.facebook))}
                </div>
                {Boolean(result?.errors?.discord || result?.errors?.telegram || result?.errors?.website || result?.errors?.facebook) && (
                  <pre className="mt-4 overflow-auto rounded-xl border border-red-400/10 bg-[#030814] p-3 text-xs text-red-200">{JSON.stringify(result.errors, null, 2)}</pre>
                )}
              </div>
            )}
          </form>
        </div>

        {/* PREVIEW */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 text-xl font-semibold">Live Preview</div>
          <div className="mb-5 flex gap-2">
            {(["website", "discord", "telegram"] as PreviewTab[]).map(tab => (
              <button key={tab} type="button" onClick={() => setPreviewTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${previewTab === tab ? "bg-blue-600 text-white" : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
                {tab === "telegram" ? "✈️ Telegram" : tab === "discord" ? "🎮 Discord" : "🌐 Website"}
              </button>
            ))}
          </div>

          {previewTab === "website" && (
            <div className="rounded-2xl bg-[#1c1c1c] overflow-hidden border border-white/10 max-w-[320px]">
              {badge && <div className="px-3 pt-3"><span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white uppercase">🔥 {badge}</span></div>}
              {previewImage ? <div className="bg-[#111] flex items-center justify-center p-4"><img src={previewImage} alt="Product" className="max-h-[180px] w-full object-contain" /></div> : <div className="bg-[#111] flex items-center justify-center p-4 h-[140px] text-slate-600 text-sm">No image</div>}
              <div className="p-4 space-y-2">
                {category && <p className="text-xs font-bold uppercase tracking-widest text-orange-500">{category}</p>}
                <p className="font-bold text-white text-sm leading-snug">{displayTitle}</p>
                {description && <p className="text-xs text-slate-400">{description}</p>}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-orange-400">£{displayPrice}</span>
                  {was && <span className="text-sm text-slate-500 line-through">£{was}</span>}
                  {savePct && <span className="text-xs font-bold text-green-400">Save {savePct}</span>}
                </div>
                <a href={link || "#"} target="_blank" rel="noreferrer" className="mt-2 block w-full rounded-xl bg-orange-500 py-2 text-center text-sm font-bold text-white">View on Amazon.co.uk →</a>
              </div>
            </div>
          )}

          {previewTab === "discord" && (
            <div className={`rounded-2xl border-l-4 ${cfg.previewBorder} bg-[#2b2d31] p-4 space-y-3`}>
              <p className="text-sm font-bold text-white">{destination === "sneakers" ? "Percy Bargains Alert 🚨" : "Amazon STEAL! Alert 🚨"}</p>
              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cfg.badgeBg} ${cfg.badgeText}`}>{cfg.emoji} {cfg.label.toUpperCase()}</div>
              <p className="text-[15px] leading-7 text-slate-200">{productTitle ? `${productTitle}\n${description}` : displayDesc}</p>
              <div className="flex gap-2 items-center">
                <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-0.5 text-sm font-medium text-blue-300">£{displayPrice}</span>
                {was && <span className="text-xs text-slate-500 line-through">£{was}</span>}
                {savePct && <span className="text-xs font-bold text-green-400">Save {savePct}</span>}
              </div>
              {previewImage ? <img src={previewImage} alt="Deal" className="rounded-xl max-h-[200px] w-full object-cover" /> : <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">Image will appear here</div>}
              <a href={link || "#"} className="inline-flex rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300">View Deal</a>
              <p className="text-xs text-slate-500">Bargain Sniper UK</p>
            </div>
          )}

          {previewTab === "telegram" && (
            <div className="rounded-2xl bg-[#17212b] border border-white/10 overflow-hidden max-w-[360px]">
              <div className="flex items-center gap-3 border-b border-white/10 bg-[#232e3c] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white text-sm font-bold">BS</div>
                <div><p className="text-sm font-semibold text-white">Bargain Sniper UK</p><p className="text-xs text-slate-400">Channel</p></div>
              </div>
              <div className="p-4">
                <div className="rounded-2xl rounded-tl-sm bg-[#182533] p-4 space-y-2">
                  {previewImage && <img src={previewImage} alt="Deal" className="w-full max-h-[200px] object-cover rounded-xl mb-2" />}
                  <p className="text-sm font-bold text-white">{cfg.emoji} {productTitle || "Deal Title"}</p>
                  {description && <p className="text-sm text-slate-300">{description}</p>}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold text-white">💷 £{displayPrice}</span>
                    {was && <span className="text-sm text-slate-500 line-through">£{was}</span>}
                    {savePct && <span className="text-xs font-bold text-green-400">Save {savePct}</span>}
                  </div>
                  {category && <p className="text-xs text-slate-400">📂 {category}</p>}
                  <a href={link || "#"} className="block w-full rounded-xl bg-blue-500 py-2 text-center text-sm font-bold text-white">👉 View Deal</a>
                  <p className="text-[10px] text-slate-500 text-right">Bargain Sniper UK</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
