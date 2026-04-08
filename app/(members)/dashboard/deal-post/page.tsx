"use client";

import { useMemo, useState } from "react";
import {
  Link as LinkIcon,
  PoundSterling,
  ImageIcon,
  Send,
  Upload,
  Tag,
} from "lucide-react";

type Destination = "amazon" | "sneakers";
type PreviewTab = "website" | "discord" | "x";

type ApiResponse = {
  ok?: boolean;
  error?: string;
  results?: {
    discord?: unknown;
    x?: unknown;
    facebook?: unknown;
    website?: unknown;
  };
  errors?: {
    discord?: string | object | null;
    x?: string | object | null;
    facebook?: string | object | null;
    website?: string | object | null;
  };
};

const BADGE_OPTIONS = ["", "Hot", "New", "Limited", "Flash Sale", "Clearance"];

function calcSavePct(price: string, was: string): string {
  const p = parseFloat(price) || 0;
  const w = parseFloat(was) || 0;
  if (!p || !w || w <= p) return "";
  return Math.round((1 - p / w) * 100) + "%";
}

export default function DealPostPage() {
  const [destination, setDestination] = useState<Destination>("amazon");
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
  const [postToX, setPostToX] = useState(true);
  const [postToFacebook, setPostToFacebook] = useState(false);
  const [postToWebsite, setPostToWebsite] = useState(true);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>("website");

  const previewImage = useMemo(() => {
    if (imageFile) return URL.createObjectURL(imageFile);
    return imageUrl;
  }, [imageFile, imageUrl]);

  const savePct = calcSavePct(price, was);

  const discordConfig = useMemo(() => {
    if (destination === "sneakers") {
      return { title: "Percy Bargains Alert 🚨", color: "border-emerald-500", footer: "Bargain Sniper UK • Sneakers" };
    }
    return { title: "Amazon STEAL! Alert 🚨", color: "border-blue-500", footer: "Bargain Sniper UK • Amazon Deals" };
  }, [destination]);

  function renderStatus(label: string, success: boolean, failure: boolean) {
    const state = success ? "Success" : failure ? "Failed" : "Not sent";
    const stateClass = success
      ? "text-emerald-300 border-emerald-400/20 bg-emerald-500/10"
      : failure
      ? "text-red-300 border-red-400/20 bg-red-500/10"
      : "text-slate-300 border-white/10 bg-white/5";
    return (
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#030814] px-4 py-3">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${stateClass}`}>{state}</span>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("destination", destination);
      formData.append("description", productTitle || description);
      formData.append("price", price);
      formData.append("was", was);
      formData.append("link", link);
      formData.append("imageUrl", imageUrl);
      formData.append("category", category);
      formData.append("badge", badge);
      formData.append("expiry", expiry);
      formData.append("dotd", String(dotd));
      formData.append("productTitle", productTitle);
      formData.append("shortDescription", description);
      formData.append("postToDiscord", String(postToDiscord));
      formData.append("postToX", String(postToX));
      formData.append("postToFacebook", String(postToFacebook));
      formData.append("postToWebsite", String(postToWebsite));
      if (imageFile) formData.append("imageFile", imageFile);

      const res = await fetch("/api/post-discord", { method: "POST", body: formData });
      const data: ApiResponse = await res.json();
      setResult(data);

      if (!res.ok || !data.ok) {
        const failed = data.errors ? Object.keys(data.errors).join(", ") : "";
        setMessage(failed ? `Some posts failed: ${failed}` : data.error || "Failed to post deal.");
        setLoading(false);
        return;
      }

      setMessage("Deal posted successfully. ✅");
      setProductTitle(""); setDescription(""); setPrice(""); setWas("");
      setLink(""); setImageUrl(""); setImageFile(null);
      setCategory(""); setBadge(""); setExpiry(""); setDotd(false);
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const displayTitle = productTitle || "Product title will appear here";
  const displayDesc = description || "Short description will appear here.";
  const displayPrice = price || "0.00";

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <Send size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deal Poster</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Fill in the deal details, preview how it looks on the website, Discord and X, then post to all destinations at once.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* ── FORM ── */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <form onSubmit={handleSubmit} className="grid gap-5">

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Send To</label>
              <select value={destination} onChange={(e) => setDestination(e.target.value as Destination)}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40">
                <option value="amazon">Amazon</option>
                <option value="sneakers">Sneakers</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Product Title <span className="text-slate-500">(shown on website card)</span></label>
              <input value={productTitle} onChange={(e) => setProductTitle(e.target.value)}
                placeholder="e.g. Nike Air Max 90 — Men's Trainers" required
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Short Description <span className="text-slate-500">(for Discord & X)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Iconic cushioned trainer, available in multiple colourways. Huge saving!" rows={3}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Current Price</label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <PoundSterling size={18} className="text-slate-500" />
                  <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="39.99" required
                    className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Was / RRP <span className="text-slate-500">(optional)</span></label>
                <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                  <PoundSterling size={18} className="text-slate-500" />
                  <input value={was} onChange={(e) => setWas(e.target.value)} placeholder="89.99"
                    className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
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
              <label className="mb-2 block text-sm font-medium text-slate-300">Amazon Affiliate Link</label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <LinkIcon size={18} className="text-slate-500" />
                <input value={link} onChange={(e) => setLink(e.target.value)}
                  placeholder="https://amzn.to/xxxxx or https://www.amazon.co.uk/dp/ASIN?tag=YOURTAG-21" required
                  className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Category <span className="text-slate-500">(optional)</span></label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Footwear, Tech, Tools"
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-blue-400/40" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Badge <span className="text-slate-500">(optional)</span></label>
                <select value={badge} onChange={(e) => setBadge(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40">
                  {BADGE_OPTIONS.map(b => <option key={b} value={b}>{b || "None"}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Expiry Date <span className="text-slate-500">(optional)</span></label>
                <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">Deal of the Day?</label>
                <select value={dotd ? "yes" : "no"} onChange={(e) => setDotd(e.target.value === "yes")}
                  className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-3 text-white outline-none focus:border-blue-400/40">
                  <option value="no">No</option>
                  <option value="yes">Yes ⭐</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Product Image URL <span className="text-slate-500">(optional)</span></label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-[#030814] px-4">
                <ImageIcon size={18} className="text-slate-500" />
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..."
                  className="w-full bg-transparent px-2 py-3 text-white outline-none placeholder:text-slate-500" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Upload Image From Device <span className="text-slate-500">(optional)</span></label>
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-[#030814] px-4 py-4 text-slate-300 hover:border-blue-400/40">
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm">{imageFile ? imageFile.name : "Browse your phone/computer and select an image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0] || null; setImageFile(file); }} />
              </label>
              {imageFile ? <button type="button" onClick={() => setImageFile(null)} className="mt-2 text-xs text-red-300 hover:text-red-200">Remove uploaded image</button> : null}
            </div>

            {/* Destinations */}
            <div className="rounded-2xl border border-white/10 bg-[#030814] p-4">
              <div className="mb-3 text-sm font-medium text-slate-300">Post Destinations</div>
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  { label: "Discord", checked: postToDiscord, set: setPostToDiscord },
                  { label: "X / Twitter", checked: postToX, set: setPostToX },
                  { label: "Facebook", checked: postToFacebook, set: setPostToFacebook },
                  { label: "Website", checked: postToWebsite, set: setPostToWebsite },
                ].map(({ label, checked, set }) => (
                  <label key={label} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
                    <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-blue-500" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50">
              {loading ? "Posting..." : "Post Deal"}
            </button>

            {message ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">{message}</div> : null}

            {result ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 text-sm font-semibold text-white">Post Results</div>
                <div className="space-y-3">
                  {renderStatus("Discord", Boolean(result?.results?.discord), Boolean(result?.errors?.discord))}
                  {renderStatus("X / Twitter", Boolean(result?.results?.x), Boolean(result?.errors?.x))}
                  {renderStatus("Facebook", Boolean(result?.results?.facebook), Boolean(result?.errors?.facebook))}
                  {postToWebsite && renderStatus("Website", Boolean(result?.results?.website), Boolean(result?.errors?.website))}
                </div>
                {Boolean(result?.errors?.discord || result?.errors?.x || result?.errors?.website) && (
                  <pre className="mt-4 overflow-auto rounded-xl border border-red-400/10 bg-[#030814] p-3 text-xs text-red-200">
                    {JSON.stringify(result.errors, null, 2)}
                  </pre>
                )}
              </div>
            ) : null}
          </form>
        </div>

        {/* ── PREVIEW ── */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-4 text-xl font-semibold">Live Preview</div>

          {/* Tab switcher */}
          <div className="mb-5 flex gap-2">
            {(["website", "discord", "x"] as PreviewTab[]).map(tab => (
              <button key={tab} type="button" onClick={() => setPreviewTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition capitalize ${
                  previewTab === tab
                    ? "bg-blue-600 text-white"
                    : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}>
                {tab === "x" ? "X / Twitter" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Website Preview */}
          {previewTab === "website" && (
            <div className="rounded-2xl bg-[#1c1c1c] overflow-hidden border border-white/10 max-w-[320px]">
              {badge && (
                <div className="px-3 pt-3">
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white uppercase">
                    🔥 {badge}
                  </span>
                </div>
              )}
              {previewImage ? (
                <div className="bg-[#111] flex items-center justify-center p-4">
                  <img src={previewImage} alt="Product" className="max-h-[180px] w-full object-contain" />
                </div>
              ) : (
                <div className="bg-[#111] flex items-center justify-center p-4 h-[140px] text-slate-600 text-sm">No image</div>
              )}
              <div className="p-4 space-y-2">
                {category && <p className="text-xs font-bold uppercase tracking-widest text-orange-500">{category}</p>}
                <p className="font-bold text-white text-sm leading-snug">{displayTitle}</p>
                {description && <p className="text-xs text-slate-400 leading-relaxed">{description}</p>}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-orange-400 font-mono">£{displayPrice}</span>
                  {was && <span className="text-sm text-slate-500 line-through">£{was}</span>}
                  {savePct && <span className="text-xs font-bold text-green-400">Save {savePct}</span>}
                </div>
                <p className="text-xs text-slate-600">Verify on Amazon before purchasing</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-400">👍 0 votes</span>
                </div>
                <a href={link || "#"} target="_blank" rel="noreferrer"
                  className="mt-2 block w-full rounded-xl bg-orange-500 py-2 text-center text-sm font-bold text-white hover:bg-orange-400 transition">
                  View on Amazon.co.uk →
                </a>
              </div>
            </div>
          )}

          {/* Discord Preview */}
          {previewTab === "discord" && (
            <div className={`rounded-2xl border-l-4 ${discordConfig.color} bg-[#2b2d31] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] space-y-3`}>
              <p className="text-sm font-bold text-white">{discordConfig.title}</p>
              <p className="text-[15px] leading-7 text-slate-200 whitespace-pre-line">{productTitle ? `**${productTitle}**\n${description}` : displayDesc}</p>
              <div className="space-y-1">
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-400">Price:</span>
                  <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-0.5 text-sm font-medium text-blue-300">£{displayPrice}</span>
                  {was && <span className="text-xs text-slate-500 line-through">£{was}</span>}
                  {savePct && <span className="text-xs font-bold text-green-400">Save {savePct}</span>}
                </div>
                {category && <p className="text-xs text-slate-400">Category: <span className="text-slate-200">{category}</span></p>}
              </div>
              {previewImage ? (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <img src={previewImage} alt="Deal" className="h-auto max-h-[240px] w-full object-cover" />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">
                  Image will appear here
                </div>
              )}
              <a href={link || "#"} target="_blank" rel="noreferrer"
                className="inline-flex rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition">
                View Deal
              </a>
              <p className="text-xs text-slate-500 pt-1">{discordConfig.footer}</p>
            </div>
          )}

          {/* X / Twitter Preview */}
          {previewTab === "x" && (
            <div className="rounded-2xl border border-white/10 bg-[#15202b] p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold">KK</div>
                <div>
                  <p className="text-sm font-bold text-white">Kicks Korner</p>
                  <p className="text-xs text-slate-500">@KicksKorner</p>
                </div>
              </div>
              <p className="text-sm text-white whitespace-pre-line leading-relaxed">
                {destination === "sneakers" ? "👟 DEAL ALERT" : "📦 DEAL ALERT"}{"\n\n"}
                {productTitle || description || "Your deal description will appear here."}{"\n\n"}
                💷 £{displayPrice}{was ? ` (was £${was})` : ""}{"\n\n"}
                👉 {link || "https://..."}{"\n\n"}
                <span className="text-blue-400">#amazon #deals #bargain</span>
              </p>
              {previewImage ? (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <img src={previewImage} alt="Deal" className="h-auto max-h-[240px] w-full object-cover" />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">
                  Image will appear here
                </div>
              )}
              <p className="text-xs text-slate-500">Character count: ~{(280 - ((productTitle || description || "").length + displayPrice.length + (link || "").length)).toFixed(0)} remaining</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
