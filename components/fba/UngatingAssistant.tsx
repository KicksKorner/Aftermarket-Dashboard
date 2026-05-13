"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2, AlertCircle, CheckCircle, Copy, ChevronDown,
  ChevronUp, Clock, Sparkles,
} from "lucide-react";

const supabase = createClient();
const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-400/40 transition";

function parseAppeal(text: string) {
  const sections: { heading: string; content: string }[] = [];
  const lines = text.split("\n");
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const headingMatch = line.match(/^\*?\*?(\d+\.\s+[^*]+)\*?\*?/);
    if (headingMatch && line.trim().startsWith("**")) {
      if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
      current = { heading: headingMatch[1].replace(/\*\*/g, "").trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push({ heading: current.heading, content: current.lines.join("\n").trim() });
  return sections.length > 0 ? sections : [{ heading: "Generated Appeal", content: text }];
}

export default function UngatingAssistant() {
  const [rejectionReason, setRejectionReason] = useState("");
  const [asin, setAsin] = useState("");
  const [category, setCategory] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceDetails, setInvoiceDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchHistory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fba_ungating_history")
      .select("id, rejection_reason, asin, category, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory(data || []);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  async function handleGenerate() {
    if (!rejectionReason.trim()) { setError("Paste your rejection reason first."); return; }
    setGenerating(true); setError(""); setAppeal(""); setExpanded(0);
    try {
      const res = await fetch("/api/fba/ungating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectionReason, asin, category, supplierName, invoiceDetails }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to generate."); return; }
      setAppeal(data.appeal);
      fetchHistory();
    } catch { setError("Something went wrong. Please try again."); }
    finally { setGenerating(false); }
  }

  function copySection(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const sections = appeal ? parseAppeal(appeal) : [];

  return (
    <div className="space-y-5">
      {/* Intro */}
      <div className="rounded-[20px] border border-orange-500/15 bg-[#081120] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
            <Sparkles size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Claude-Powered Ungating Appeal Generator</p>
            <p className="text-xs text-slate-400 mt-1">Paste your Amazon rejection reason below. Claude will analyse exactly why you were rejected, tell you what Amazon actually wants, write a professional appeal letter, and give you a document checklist — all tailored to your specific rejection.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Amazon Rejection Reason <span className="text-orange-400">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              rows={5}
              placeholder="Paste the full rejection message from Amazon Seller Central here. The more detail you include, the better the appeal will be..."
              className="w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-3 text-sm text-white outline-none focus:border-orange-400/40 transition placeholder:text-slate-600 resize-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">ASIN (optional)</label>
              <input value={asin} onChange={e => setAsin(e.target.value.toUpperCase())}
                placeholder="e.g. B08N5WRWNW" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Category / Brand (optional)</label>
              <input value={category} onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Toys, Lego, Health & Beauty" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Supplier Used (optional)</label>
              <input value={supplierName} onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. Wholesale supplier name" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Invoice Details (optional)</label>
              <input value={invoiceDetails} onChange={e => setInvoiceDetails(e.target.value)}
                placeholder="e.g. 10 units, dated 3 months ago" className={inputCls} />
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={14} />{error}
          </div>
        )}

        <button onClick={handleGenerate} disabled={generating || !rejectionReason.trim()}
          className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition disabled:opacity-50">
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating ? "Generating Appeal..." : "Generate Appeal with Claude"}
        </button>
      </div>

      {/* Generated appeal */}
      {sections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Generated Appeal</p>
            <button onClick={() => copySection(appeal, "all")}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10 transition">
              {copied === "all" ? <><CheckCircle size={11} className="text-emerald-400" />Copied!</> : <><Copy size={11} />Copy All</>}
            </button>
          </div>

          {sections.map((section, i) => (
            <div key={i} className="rounded-[20px] border border-white/10 bg-[#081120] overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-white/[0.03] transition">
                <span className="text-sm font-semibold text-white">{section.heading}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); copySection(section.content, String(i)); }}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-400 hover:bg-white/10 transition">
                    {copied === String(i) ? "Copied!" : "Copy"}
                  </button>
                  {expanded === i ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                </div>
              </button>
              {expanded === i && (
                <div className="border-t border-white/10 px-5 py-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    {section.content.split("\n").map((line, j) => {
                      if (line.startsWith("- ") || line.startsWith("• ") || line.match(/^\d+\./)) {
                        return <p key={j} className="text-sm text-slate-300 my-1">{line}</p>;
                      }
                      if (line.startsWith("**") && line.endsWith("**")) {
                        return <p key={j} className="text-sm font-semibold text-white mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>;
                      }
                      if (!line.trim()) return <div key={j} className="h-2" />;
                      return <p key={j} className="text-sm text-slate-300">{line}</p>;
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
          <button onClick={() => setShowHistory(!showHistory)}
            className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Previous Appeals ({history.length})</span>
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
                  <Clock size={12} className="flex-shrink-0 text-slate-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-slate-300">{h.rejection_reason.substring(0, 80)}...</p>
                    <p className="text-[10px] text-slate-600">{h.asin || ""} {h.category || ""} · {new Date(h.created_at).toLocaleDateString("en-GB")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
