"use client";

import { useState } from "react";
import { Wand2, Send, RefreshCw, Copy, Check, Loader2, Eye } from "lucide-react";

type DiscordEmbed = {
  title?: string;
  description?: string;
  color?: number;
  image?: { url: string };
  footer?: { text: string };
  timestamp?: string;
};

type DiscordPayload = {
  content?: string;
  embeds?: DiscordEmbed[];
};

const CHANNELS = [
  { id: "flips_update",        label: "📋 flips-update",                 envKey: "FLIPS_UPDATE" },
  { id: "flips",               label: "💰 flips",                        envKey: "FLIPS" },
  { id: "kicks_flips",         label: "👟 kicks-flips",                  envKey: "KICKS_FLIPS" },
  { id: "member_flips",        label: "🎁 member-flips",                 envKey: "MEMBER_FLIPS" },
  { id: "pokemon_flips",       label: "🃏 pokemon-flips",                envKey: "POKEMON_FLIPS" },
  { id: "sneaker_streetwear",  label: "👟 sneaker-and-streetwear-flips", envKey: "SNEAKERS" },
  { id: "pokemon_investments", label: "🔵 pokemon-investments",          envKey: "POKEMON_INVESTMENTS" },
];

const STYLES = [
  { id: "detailed",  label: "Detailed",  desc: "Full breakdown with pricing, risk, why it flips" },
  { id: "quick",     label: "Quick Hit",  desc: "Short punchy alert — fast read" },
  { id: "restock",   label: "Restock",    desc: "In-store restock format with SKUs/EANs" },
  { id: "investment",label: "Investment", desc: "Long-term hold analysis style" },
];

export default function DealFormatterPage() {
  const [rawInput, setRawInput] = useState("");
  const [channel, setChannel] = useState("pokemon_flips");
  const [style, setStyle] = useState("detailed");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<DiscordPayload | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");

  async function handleFormat() {
    if (!rawInput.trim()) return;
    setLoading(true);
    setError("");
    setPreview(null);
    setSent(false);
    try {
      const res = await fetch("/api/admin/format-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: rawInput, channel, style }),
      });
      const data = await res.json();
      if (res.ok && data.payload) {
        setPreview(data.payload);
        setRawJson(JSON.stringify(data.payload, null, 2));
      } else {
        setError(data.error || "Failed to format. Try again.");
      }
    } catch { setError("Something went wrong."); }
    setLoading(false);
  }

  async function handleSend() {
    if (!preview) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/send-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: preview, channel }),
      });
      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 5000);
      } else {
        const d = await res.json();
        setError(d.error || "Failed to send.");
      }
    } catch { setError("Send failed."); }
    setSending(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function embedColor(color?: number) {
    if (!color) return "#5865F2";
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-center gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
          <Wand2 size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Deal Formatter</h1>
          <p className="mt-1 text-sm text-slate-400">
            Paste raw deal info — Claude rewrites it into a polished Discord embed. Every output is unique.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* LEFT */}
        <div className="space-y-4">
          <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-5 space-y-5">

            {/* Channel */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">1 — Choose channel</p>
              <div className="grid grid-cols-2 gap-2">
                {CHANNELS.map(c => (
                  <button key={c.id} onClick={() => setChannel(c.id)}
                    className={`rounded-xl px-3 py-2.5 text-left text-sm font-medium transition border ${
                      channel === c.id
                        ? "border-violet-500/30 bg-violet-500/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">2 — Post style</p>
              <div className="grid grid-cols-2 gap-2">
                {STYLES.map(s => (
                  <button key={s.id} onClick={() => setStyle(s.id)}
                    className={`rounded-xl px-3 py-2.5 text-left transition border ${
                      style === s.id
                        ? "border-blue-500/30 bg-blue-500/15"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}>
                    <p className={`text-sm font-medium ${style === s.id ? "text-white" : "text-slate-400"}`}>{s.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Raw input */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">3 — Paste your raw info</p>
              <textarea
                value={rawInput}
                onChange={e => setRawInput(e.target.value)}
                placeholder={`Just paste whatever you have. Examples:\n\n• Tesco Pokémon restock - Ascended Heroes Wave 2\n  Sleeved Boosters £6 retail ~£10 resale EAN: 0820650880247\n  First Partner Series 1 £15 retail ~£50+ resale\n  Stores from Monday onwards\n\n• Nike Air Max 1 OG - dropping Thursday 10am\n  RRP £130, resale £200-250, limited sizes\n  Use code SAVE10 for cashback`}
                rows={12}
                className="w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-3 text-sm text-white placeholder-slate-700 outline-none focus:border-violet-400/30 transition resize-none font-mono leading-relaxed"
              />
              <p className="mt-1.5 text-xs text-slate-600">Claude will rewrite this — spelling mistakes, rough notes, copied text all fine.</p>
            </div>

            <button onClick={handleFormat} disabled={!rawInput.trim() || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Claude is formatting...</>
                : <><Wand2 size={14} /> Format with AI</>}
            </button>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}
          </div>
        </div>

        {/* RIGHT — Preview */}
        <div className="space-y-4">
          <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-5 space-y-4 min-h-[400px] flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">4 — Preview & send</p>
              {preview && (
                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
                    <button onClick={() => setViewMode("visual")}
                      className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition ${viewMode === "visual" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
                      <Eye size={10} /> Visual
                    </button>
                    <button onClick={() => setViewMode("json")}
                      className={`rounded-lg px-3 py-1 text-xs font-medium transition ${viewMode === "json" ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
                      JSON
                    </button>
                  </div>
                  <button onClick={handleFormat} title="Regenerate — get a different version"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white transition">
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>
              )}
            </div>

            {!preview && !loading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                <Wand2 size={36} className="mb-3 text-slate-700" />
                <p className="text-sm font-medium text-slate-500">Your preview will appear here</p>
                <p className="mt-1 text-xs text-slate-600">Paste your info and click Format with AI</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                <Loader2 size={28} className="animate-spin mb-3 text-violet-400" />
                <p className="text-sm text-slate-400">Claude is writing your deal post...</p>
                <p className="mt-1 text-xs text-slate-600">Usually takes 3-5 seconds</p>
              </div>
            )}

            {preview && !loading && viewMode === "visual" && (
              <div className="flex-1 space-y-2">
                {/* Discord mock */}
                <div className="rounded-xl overflow-hidden bg-[#313338]">
                  {/* Message content (ping etc) */}
                  {preview.content && (
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-sm text-[#dbdee1] whitespace-pre-wrap">{preview.content}</p>
                    </div>
                  )}
                  {/* Embeds */}
                  {preview.embeds?.map((embed, i) => (
                    <div key={i} className="mx-3 mb-3 flex overflow-hidden rounded">
                      <div className="w-1 flex-shrink-0" style={{ backgroundColor: embedColor(embed.color) }} />
                      <div className="flex-1 bg-[#2b2d31] px-3 py-3 space-y-2">
                        {embed.title && (
                          <p className="text-sm font-semibold leading-snug" style={{ color: embedColor(embed.color) }}>
                            {embed.title}
                          </p>
                        )}
                        {embed.description && (
                          <p className="text-xs text-[#dbdee1] whitespace-pre-wrap leading-relaxed">{embed.description}</p>
                        )}
                        {embed.image?.url && (
                          <img src={embed.image.url} alt="" className="rounded mt-2 max-h-48 object-cover" />
                        )}
                        {embed.footer && (
                          <p className="text-[10px] text-[#87898c] pt-1 border-t border-white/5">{embed.footer.text}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {preview && !loading && viewMode === "json" && (
              <div className="relative flex-1">
                <button onClick={handleCopy}
                  className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-white/10 bg-[#030814] px-2 py-1 text-xs text-slate-400 hover:text-white transition">
                  {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                </button>
                <pre className="rounded-xl bg-[#030814] p-4 text-xs text-slate-300 overflow-auto max-h-72 font-mono">
                  {rawJson}
                </pre>
              </div>
            )}

            {preview && !loading && (
              <div className="flex gap-3 pt-3 border-t border-white/10 mt-auto">
                <button onClick={handleSend} disabled={sending || sent}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
                    sent
                      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                  }`}>
                  {sending ? <><Loader2 size={14} className="animate-spin" /> Sending...</>
                    : sent ? <><Check size={14} /> Sent to Discord!</>
                    : <><Send size={14} /> Send to Discord</>}
                </button>
                <button onClick={() => { setPreview(null); setRawInput(""); setSent(false); }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-400 hover:text-white transition">
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
