"use client";

import { useState, useCallback } from "react";
import AdminSubnav from "@/components/admin-subnav";

// ── Types ────────────────────────────────────────────────────────────────────

type Verdict = "buy" | "watch" | "avoid" | "hold" | "grading" | "";

interface Product {
  id: number;
  name: string;
  currentPrice: string;
  targetPrice: string;
  notes: string;
  verdict: Verdict;
}

// ── Constants ────────────────────────────────────────────────────────────────

const EMBED_COLORS: { hex: string; label: string; tw: string }[] = [
  { hex: "3b82f6", label: "Blue",   tw: "bg-blue-500" },
  { hex: "22c55e", label: "Green",  tw: "bg-green-500" },
  { hex: "f59e0b", label: "Amber",  tw: "bg-amber-500" },
  { hex: "ef4444", label: "Red",    tw: "bg-red-500" },
  { hex: "a855f7", label: "Purple", tw: "bg-purple-500" },
  { hex: "14b8a6", label: "Teal",   tw: "bg-teal-500" },
  { hex: "f97316", label: "Orange", tw: "bg-orange-500" },
];

const VERDICT_STYLES: Record<string, { btn: string; tag: string; label: string; emoji: string }> = {
  buy:     { btn: "border-green-500/40 text-green-400 hover:bg-green-500/20",   tag: "border-green-500/30 bg-green-500/10 text-green-400",   label: "Buy",     emoji: "🟢 BUY" },
  watch:   { btn: "border-amber-500/40 text-amber-400 hover:bg-amber-500/20",   tag: "border-amber-500/30 bg-amber-500/10 text-amber-400",   label: "Watch",   emoji: "🟡 WATCH" },
  avoid:   { btn: "border-red-500/40 text-red-400 hover:bg-red-500/20",         tag: "border-red-500/30 bg-red-500/10 text-red-400",         label: "Avoid",   emoji: "🔴 AVOID" },
  hold:    { btn: "border-purple-500/40 text-purple-400 hover:bg-purple-500/20",tag: "border-purple-500/30 bg-purple-500/10 text-purple-400",label: "Hold",    emoji: "🟣 HOLD" },
  grading: { btn: "border-teal-500/40 text-teal-400 hover:bg-teal-500/20",      tag: "border-teal-500/30 bg-teal-500/10 text-teal-400",      label: "Grading", emoji: "🔵 GRADING PLAY" },
};

let counter = 0;
const newProduct = (): Product => ({
  id: ++counter, name: "", currentPrice: "", targetPrice: "", notes: "", verdict: "",
});

// ── Component ────────────────────────────────────────────────────────────────

export default function PokemonInvestmentsPage() {
  const [embedTitle, setEmbedTitle]     = useState("🃏 Weekly Investment Breakdown — Pokémon Sealed Product");
  const [embedDesc, setEmbedDesc]       = useState("A busy week with plenty to cover. Let's get into it.");
  const [closingNote, setClosingNote]   = useState("Drop any questions or thoughts in 🍿 general-chat — always love hearing from you all. Have a great week! xx");
  const [botName, setBotName]           = useState("Aftermarket Arbitrage");
  const [webhookUrl, setWebhookUrl]     = useState("");
  const [selectedColor, setSelectedColor] = useState("3b82f6");
  const [products, setProducts]         = useState<Product[]>([newProduct()]);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [sending, setSending]           = useState(false);
  const [showJson, setShowJson]         = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const updateProduct = useCallback((id: number, field: keyof Product, value: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  }, []);

  const removeProduct = (id: number) => setProducts(prev => prev.filter(p => p.id !== id));

  const addProduct = () => setProducts(prev => [...prev, newProduct()]);

  // ── Build Discord embed payload ────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const fields: { name: string; value: string; inline: boolean }[] = [];

    products.forEach(p => {
      if (!p.name.trim()) return;
      let value = "";
      if (p.verdict) value += `**${VERDICT_STYLES[p.verdict].emoji}**\n`;
      if (p.currentPrice) value += `**Current Price:** ${p.currentPrice}\n`;
      if (p.targetPrice)  value += `**Target Price:** ${p.targetPrice}\n`;
      if (p.notes)        value += `\n${p.notes}`;
      fields.push({ name: p.name, value: value.trim() || "No details added.", inline: false });
    });

    const tableRows = products
      .filter(p => p.name.trim())
      .map(p => `${p.name.substring(0, 28).padEnd(29)}| ${(p.targetPrice || "—").padEnd(13)}| ${(p.verdict || "—").toUpperCase()}`)
      .join("\n");

    if (tableRows) {
      fields.push({
        name: "📊 Quick Summary",
        value: "```\nProduct                       | Target Price | Verdict\n------------------------------|--------------|----------\n" + tableRows + "\n```",
        inline: false,
      });
    }

    if (closingNote.trim()) {
      fields.push({ name: "💬 Questions & Discussion", value: closingNote, inline: false });
    }

    return {
      username: botName || "Aftermarket Arbitrage",
      embeds: [{
        title: embedTitle,
        description: embedDesc,
        color: parseInt(selectedColor, 16),
        fields,
        footer: { text: "⚠️ This is not financial advice. Always do your own research before purchasing." },
        timestamp: new Date().toISOString(),
      }],
    };
  }, [products, embedTitle, embedDesc, closingNote, botName, selectedColor]);

  // ── Send webhook ───────────────────────────────────────────────────────────

  const sendWebhook = async () => {
    if (!webhookUrl.trim()) { showToast("⚠️ Please enter a webhook URL", "error"); return; }
    if (!webhookUrl.includes("discord.com/api/webhooks")) { showToast("⚠️ Invalid Discord webhook URL", "error"); return; }
    setSending(true);
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok || res.status === 204) {
        showToast("✅ Posted to Discord successfully!", "success");
      } else {
        showToast(`❌ Discord error: ${res.status}`, "error");
      }
    } catch {
      showToast("❌ Network error — check URL and try again", "error");
    }
    setSending(false);
  };

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(buildPayload(), null, 2));
    showToast("📋 JSON copied to clipboard", "success");
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const accentColor = "#" + selectedColor;

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">🃏 Pokémon Investments</h1>
          <p className="mt-2 text-sm text-slate-400">Compose and send weekly investment breakdowns to Discord.</p>
        </div>

        <AdminSubnav />

        {/* Two-column layout */}
        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">

          {/* ── LEFT: Composer ── */}
          <div className="space-y-6">

            {/* Embed Settings */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Embed Settings</p>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Post Title</label>
                  <input
                    type="text"
                    value={embedTitle}
                    onChange={e => setEmbedTitle(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Opening Summary</label>
                  <textarea
                    rows={3}
                    value={embedDesc}
                    onChange={e => setEmbedDesc(e.target.value)}
                    className="w-full resize-y rounded-2xl border border-white/8 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-400">Embed Colour</label>
                  <div className="flex gap-2 flex-wrap">
                    {EMBED_COLORS.map(c => (
                      <button
                        key={c.hex}
                        onClick={() => setSelectedColor(c.hex)}
                        title={c.label}
                        className={`h-7 w-7 rounded-full ${c.tw} transition hover:scale-110 ${selectedColor === c.hex ? "ring-2 ring-white ring-offset-2 ring-offset-[#071021] scale-110" : ""}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Bot Display Name</label>
                  <input
                    type="text"
                    value={botName}
                    onChange={e => setBotName(e.target.value)}
                    placeholder="Aftermarket Arbitrage"
                    className="w-full rounded-2xl border border-white/8 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Products</p>

              <div className="space-y-4">
                {products.map(p => (
                  <div key={p.id} className="rounded-[20px] border border-white/8 bg-[#030814] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={p.name}
                        onChange={e => updateProduct(p.id, "name", e.target.value)}
                        placeholder="Product name (e.g. Chaos Rising PC ETB)"
                        className="flex-1 rounded-xl border border-white/8 bg-[#071021] px-3 py-2 text-sm font-semibold text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                      />
                      <button
                        onClick={() => removeProduct(p.id)}
                        className="text-slate-600 hover:text-red-400 transition text-lg leading-none px-1"
                      >✕</button>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Current Price</label>
                        <input
                          type="text"
                          value={p.currentPrice}
                          onChange={e => updateProduct(p.id, "currentPrice", e.target.value)}
                          placeholder="e.g. £130"
                          className="w-full rounded-xl border border-white/8 bg-[#071021] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500">Target Price</label>
                        <input
                          type="text"
                          value={p.targetPrice}
                          onChange={e => updateProduct(p.id, "targetPrice", e.target.value)}
                          placeholder="e.g. £110"
                          className="w-full rounded-xl border border-white/8 bg-[#071021] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-xs text-slate-500">Notes</label>
                      <textarea
                        rows={2}
                        value={p.notes}
                        onChange={e => updateProduct(p.id, "notes", e.target.value)}
                        placeholder="Your thoughts on this product..."
                        className="w-full resize-y rounded-xl border border-white/8 bg-[#071021] px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(VERDICT_STYLES) as Verdict[]).filter(Boolean).map(v => (
                        <button
                          key={v}
                          onClick={() => updateProduct(p.id, "verdict", p.verdict === v ? "" : v)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            p.verdict === v
                              ? `border-transparent ${
                                  v === "buy" ? "bg-green-500 text-black" :
                                  v === "watch" ? "bg-amber-500 text-black" :
                                  v === "avoid" ? "bg-red-500 text-white" :
                                  v === "hold" ? "bg-purple-500 text-white" :
                                  "bg-teal-500 text-black"
                                }`
                              : VERDICT_STYLES[v].btn
                          }`}
                        >
                          {VERDICT_STYLES[v].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  onClick={addProduct}
                  className="w-full rounded-[20px] border border-dashed border-white/10 py-3 text-sm text-slate-500 transition hover:border-blue-500/30 hover:text-blue-400"
                >
                  + Add Product
                </button>
              </div>
            </div>

            {/* Closing Note */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Closing Note</p>
              <textarea
                rows={2}
                value={closingNote}
                onChange={e => setClosingNote(e.target.value)}
                className="w-full resize-y rounded-2xl border border-white/8 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
              />
            </div>

            {/* Webhook */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Discord Webhook</p>
              <input
                type="url"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-2xl border border-white/8 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500/40 focus:outline-none"
              />

              <div className="mt-4 flex gap-3">
                <button
                  onClick={copyJson}
                  className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
                >
                  Copy JSON
                </button>
                <button
                  onClick={sendWebhook}
                  disabled={sending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#5865f2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4752c4] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="16" height="12" viewBox="0 0 127.14 96.36" fill="currentColor">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                  {sending ? "Sending..." : "Send to Discord"}
                </button>
              </div>

              <button
                onClick={() => setShowJson(v => !v)}
                className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition"
              >
                {showJson ? "▾ Hide raw JSON" : "▸ View raw JSON"}
              </button>
              {showJson && (
                <pre className="mt-2 max-h-48 overflow-auto rounded-2xl border border-white/8 bg-[#030814] p-4 text-xs text-slate-400">
                  {JSON.stringify(buildPayload(), null, 2)}
                </pre>
              )}
            </div>
          </div>

          {/* ── RIGHT: Discord Preview ── */}
          <div className="xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Live Discord Preview</p>

              <div className="rounded-xl bg-[#313338] p-4 font-sans text-sm">
                {/* Bot header */}
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-500 text-base">🃏</div>
                  <div>
                    <span className="font-bold text-white">{botName || "Aftermarket Arbitrage"}</span>
                    <span className="ml-1.5 rounded bg-[#5865f2] px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">APP</span>
                    <span className="ml-1.5 text-xs text-[#72767d]">Today at {new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                </div>

                {/* Embed */}
                <div className="rounded-r-lg bg-[#2b2d31] pl-1 overflow-hidden" style={{ borderLeft: `4px solid ${accentColor}` }}>
                  <div className="p-3">
                    <p className="font-bold text-white">{embedTitle || "Post Title"}</p>
                    {embedDesc && <p className="mt-1 text-xs leading-relaxed text-[#dbdee1] whitespace-pre-wrap">{embedDesc}</p>}

                    <div className="mt-3 space-y-3">
                      {products.filter(p => p.name.trim()).map(p => (
                        <div key={p.id}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-bold text-white">{p.name}</p>
                            {p.verdict && (
                              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${VERDICT_STYLES[p.verdict].tag}`}>
                                {VERDICT_STYLES[p.verdict].emoji}
                              </span>
                            )}
                          </div>
                          {(p.currentPrice || p.targetPrice) && (
                            <p className="mt-0.5 text-xs text-[#b5bac1]">
                              {p.currentPrice && <><strong className="text-white">Current:</strong> {p.currentPrice} &nbsp;</>}
                              {p.targetPrice && <><strong className="text-white">Target:</strong> {p.targetPrice}</>}
                            </p>
                          )}
                          {p.notes && <p className="mt-0.5 text-xs text-[#b5bac1]">{p.notes}</p>}
                        </div>
                      ))}
                    </div>

                    {products.some(p => p.name.trim()) && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-white">📊 Quick Summary</p>
                        <pre className="mt-1 overflow-x-auto rounded bg-[#1e1f22] p-2 text-[10px] text-[#dbdee1]">
{`Product                       | Target | Verdict\n------------------------------|--------|----------\n` +
  products.filter(p => p.name.trim()).map(p =>
    `${p.name.substring(0,28).padEnd(29)}| ${(p.targetPrice||"—").padEnd(7)}| ${(p.verdict||"—").toUpperCase()}`
  ).join("\n")}
                        </pre>
                      </div>
                    )}

                    {closingNote && (
                      <div className="mt-3">
                        <p className="text-xs font-bold text-white">💬 Questions & Discussion</p>
                        <p className="mt-0.5 text-xs text-[#b5bac1]">{closingNote}</p>
                      </div>
                    )}

                    <p className="mt-3 border-t border-[#3a3c42] pt-2 text-[10px] text-[#72767d]">
                      ⚠️ This is not financial advice. Always do your own research before purchasing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-2xl border px-5 py-3 text-sm font-medium shadow-xl transition-all ${
          toast.type === "success"
            ? "border-green-500/30 bg-green-500/10 text-green-300"
            : "border-red-500/30 bg-red-500/10 text-red-300"
        }`}>
          {toast.msg}
        </div>
      )}
    </main>
  );
}
