"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Package, Search, PoundSterling, TrendingUp, RefreshCw, Upload,
  AlertCircle, CheckCircle, Loader2, ExternalLink, Download,
  BarChart3, ShoppingCart, Layers, FileSpreadsheet, X, Plus,
  ChevronDown, ChevronUp, Tag, Info,
} from "lucide-react";

const supabase = createClient();

type FbaTab = "wholesale" | "reimbursements" | "reverse-asin" | "fifo" | "vat";

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400/40 transition";

// ── Wholesale Scanner ─────────────────────────────────────────────────────────
function WholesaleScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [scanName, setScanName] = useState("");
  const [vatRate, setVatRate] = useState("20");
  const [minRoi, setMinRoi] = useState("20");
  const [minProfit, setMinProfit] = useState("1");
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [scanSummary, setScanSummary] = useState<any>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "profitable">("profitable");
  const [pastScans, setPastScans] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPastScans = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fba_wholesale_scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setPastScans(data || []);
  }, []);

  useEffect(() => { fetchPastScans(); }, [fetchPastScans]);

  async function handleScan() {
    if (!file) { setError("Please select a CSV file."); return; }
    setScanning(true); setError(""); setResults([]);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("scanName", scanName || file.name.replace(".csv", ""));
      fd.append("vatRate", vatRate);
      fd.append("minRoi", minRoi);
      fd.append("minProfit", minProfit);

      const res = await fetch("/api/fba/wholesale-scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Scan failed."); return; }
      setResults(data.results || []);
      setScanSummary({ total: data.total, profitable: data.profitable, message: data.message });
      fetchPastScans();
    } catch { setError("Scan failed. Please try again."); }
    finally { setScanning(false); }
  }

  function downloadCsv() {
    const rows = [
      ["ASIN", "Title", "Buy Price", "Amazon Price", "FBA Fees", "Profit", "ROI %", "Margin %", "BSR", "Category", "Profitable"],
      ...results.map(r => [
        r.asin, r.title, r.buy_price, r.amazon_price, r.fba_fees,
        r.profit, r.roi, r.margin, r.bsr, r.category, r.is_profitable ? "Yes" : "No",
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "wholesale-scan-results.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  const filtered = filter === "profitable" ? results.filter(r => r.is_profitable) : results;

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileSpreadsheet size={16} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Upload Wholesale List</h3>
        </div>
        <p className="text-xs text-slate-400">Upload your supplier's CSV. Needs an ASIN or EAN/Barcode column plus a price/cost column. We'll look up every product on Amazon and show you which ones are profitable.</p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Scan Name</label>
            <input value={scanName} onChange={e => setScanName(e.target.value)} placeholder="e.g. Supplier ABC June" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">VAT Rate (%)</label>
            <select value={vatRate} onChange={e => setVatRate(e.target.value)} className={selectCls}>
              <option value="20">20% Standard</option>
              <option value="5">5% Reduced</option>
              <option value="0">0% Zero rated</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Min ROI (%)</label>
            <input type="number" value={minRoi} onChange={e => setMinRoi(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Min Profit (£)</label>
            <input type="number" step="0.01" value={minProfit} onChange={e => setMinProfit(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${file ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5"}`}>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle size={18} className="text-emerald-400" />
              <span className="text-sm font-medium text-white">{file.name}</span>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>
          ) : (
            <>
              <Upload size={20} className="mx-auto mb-2 text-slate-500" />
              <p className="text-sm text-slate-400">Click to upload CSV file</p>
              <p className="mt-1 text-xs text-slate-600">Needs ASIN or EAN column + price column. Max 100 products per scan.</p>
            </>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <AlertCircle size={14} />{error}
          </div>
        )}

        <button onClick={handleScan} disabled={scanning || !file}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50">
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {scanning ? "Scanning Amazon..." : "Start Scan"}
        </button>
      </div>

      {scanSummary && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-4">
            <p className="text-xl font-semibold text-white">{scanSummary.total}</p>
            <p className="mt-0.5 text-xs text-slate-500">Products Scanned</p>
          </div>
          <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-4">
            <p className="text-xl font-semibold text-emerald-400">{scanSummary.profitable}</p>
            <p className="mt-0.5 text-xs text-slate-500">Profitable Opportunities</p>
          </div>
          <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-4">
            <p className="text-xl font-semibold text-white">{scanSummary.total > 0 ? ((scanSummary.profitable / scanSummary.total) * 100).toFixed(0) : 0}%</p>
            <p className="mt-0.5 text-xs text-slate-500">Hit Rate</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(["profitable", "all"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition capitalize ${filter === f ? "border-blue-500/30 bg-blue-500/15 text-blue-300" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}>
                  {f === "profitable" ? `✅ Profitable (${results.filter(r => r.is_profitable).length})` : `All (${results.length})`}
                </button>
              ))}
            </div>
            <button onClick={downloadCsv} className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition">
              <Download size={12} />Export CSV
            </button>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">ASIN</th>
                    <th className="px-4 py-3 font-medium">Buy Price</th>
                    <th className="px-4 py-3 font-medium">Amazon Price</th>
                    <th className="px-4 py-3 font-medium">FBA Fees</th>
                    <th className="px-4 py-3 font-medium">Profit</th>
                    <th className="px-4 py-3 font-medium">ROI</th>
                    <th className="px-4 py-3 font-medium">BSR</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} className={`border-b border-white/5 hover:bg-white/[0.02] ${!r.is_profitable ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 text-white max-w-[240px] truncate font-medium" title={r.title}>{r.title}</td>
                      <td className="px-4 py-3">
                        {r.asin ? (
                          <a href={`https://www.amazon.co.uk/dp/${r.asin}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
                            {r.asin}<ExternalLink size={10} />
                          </a>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-300">£{Number(r.buy_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-300">£{Number(r.amazon_price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-400">£{Number(r.fba_fees).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={Number(r.profit) >= 0 ? "text-emerald-400 font-semibold" : "text-red-400"}>£{Number(r.profit).toFixed(2)}</span></td>
                      <td className="px-4 py-3"><span className={Number(r.roi) >= 20 ? "text-emerald-400 font-semibold" : "text-slate-400"}>{Number(r.roi).toFixed(1)}%</span></td>
                      <td className="px-4 py-3 text-slate-400">{r.bsr ? r.bsr.toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pastScans.length > 0 && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Scans</p>
          <div className="space-y-2">
            {pastScans.map(scan => (
              <div key={scan.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">{scan.scan_name}</p>
                  <p className="text-xs text-slate-500">{new Date(scan.created_at).toLocaleDateString("en-GB")} · {scan.total_products} products</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-semibold ${scan.status === "complete" ? "text-emerald-400" : "text-amber-400"}`}>{scan.profitable_count} profitable</span>
                  <p className="text-xs text-slate-600 capitalize">{scan.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reimbursement Scanner ─────────────────────────────────────────────────────
function ReimbursementScanner() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => { fetchExisting(); }, []);

  async function fetchExisting() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fba_reimbursements")
      .select("*")
      .eq("user_id", user.id)
      .order("found_at", { ascending: false });
    setResults(data || []);
    if (data) {
      const open = data.filter((r: any) => r.status === "open");
      setSummary({
        totalOpen: open.length,
        totalEstimated: open.reduce((s: number, r: any) => s + Number(r.estimated_value || 0), 0),
      });
    }
  }

  async function handleScan() {
    setScanning(true); setError("");
    try {
      const res = await fetch("/api/fba/reimbursements", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Scan failed."); return; }
      setSummary({ totalOpen: data.totalOpen, totalEstimated: data.totalEstimated });
      setResults(data.reimbursements || []);
    } catch { setError("Scan failed. Try again."); }
    finally { setScanning(false); }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUpdatingId(null); return; }
    await supabase.from("fba_reimbursements").update({
      status,
      ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
    }).eq("id", id).eq("user_id", user.id);
    fetchExisting();
    setUpdatingId(null);
  }

  const caseColors: Record<string, string> = {
    lost: "border-red-500/20 bg-red-500/10 text-red-300",
    damaged: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    return: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    other: "border-slate-500/20 bg-slate-500/10 text-slate-300",
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white">How This Works</p>
            <p className="text-xs text-slate-400 mt-1">Amazon regularly loses or damages FBA stock and owes you money. This scanner connects to your SP-API, checks inventory adjustments over the last 180 days, and flags cases where Amazon has reduced your stock counts for loss or damage reasons — these are reimbursable. Click Scan to find what you're owed.</p>
          </div>
        </div>
        <button onClick={handleScan} disabled={scanning}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90 transition disabled:opacity-50">
          {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {scanning ? "Scanning..." : "Scan for Reimbursements"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-4">
            <p className="text-xl font-semibold text-white">{summary.totalOpen}</p>
            <p className="mt-0.5 text-xs text-slate-500">Open Cases Found</p>
          </div>
          <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-4">
            <p className="text-xl font-semibold text-emerald-400">£{Number(summary.totalEstimated).toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Estimated Value Owed</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
          <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Reimbursement Cases</p>
            <p className="text-xs text-slate-500">{results.length} total</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b border-white/10 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">ASIN</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Est. Value</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white max-w-[200px] truncate font-medium">{r.title || "Unknown"}</td>
                    <td className="px-4 py-3">
                      {r.asin ? (
                        <a href={`https://www.amazon.co.uk/dp/${r.asin}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
                          {r.asin}<ExternalLink size={10} />
                        </a>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${caseColors[r.case_type] || caseColors.other}`}>{r.case_type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.quantity}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(r.estimated_value).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${r.status === "open" ? "border-amber-500/20 bg-amber-500/10 text-amber-300" : r.status === "claimed" ? "border-blue-500/20 bg-blue-500/10 text-blue-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {r.status === "open" && (
                          <button onClick={() => updateStatus(r.id, "claimed")} disabled={updatingId === r.id}
                            className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300 hover:bg-blue-500/20 transition">
                            Mark Claimed
                          </button>
                        )}
                        {r.status === "claimed" && (
                          <button onClick={() => updateStatus(r.id, "resolved")} disabled={updatingId === r.id}
                            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                            Resolved
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {results.length === 0 && !scanning && (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/10 bg-[#081120]/50 py-12 text-center">
          <PoundSterling size={24} className="mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No cases found yet</p>
          <p className="mt-1 text-xs text-slate-600">Click Scan to check your Amazon account for reimbursable cases</p>
        </div>
      )}
    </div>
  );
}

// ── Reverse ASIN Search ───────────────────────────────────────────────────────
function ReverseAsinSearch() {
  const [asin, setAsin] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [showScenarios, setShowScenarios] = useState(false);

  useEffect(() => { fetchHistory(); }, []);

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fba_asin_searches")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    setHistory(data || []);
  }

  async function handleSearch() {
    if (!asin.trim()) { setError("Enter an ASIN"); return; }
    setSearching(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/fba/reverse-asin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asin: asin.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Search failed."); return; }
      setResult(data);
      fetchHistory();
    } catch { setError("Search failed. Try again."); }
    finally { setSearching(false); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-white mb-1">Reverse ASIN Lookup</p>
          <p className="text-xs text-slate-400">Paste any Amazon ASIN to see the current price, FBA fees, break-even point, and sourcing links across UK retailers — so you know exactly what to pay to hit your target ROI.</p>
        </div>
        <div className="flex gap-3">
          <input value={asin} onChange={e => setAsin(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="e.g. B08N5WRWNW" maxLength={10}
            className={`${inputCls} font-mono`} />
          <button onClick={handleSearch} disabled={searching || !asin.trim()}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50 flex-shrink-0">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? "Looking up..." : "Search"}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          {/* Product header */}
          <div className="flex items-start gap-4 rounded-[20px] border border-white/10 bg-[#081120] p-5">
            {result.image_url && (
              <img src={result.image_url} alt={result.title} className="h-20 w-20 flex-shrink-0 rounded-xl object-contain bg-white/5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white leading-snug">{result.title || result.asin}</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-400">
                {result.brand && <span>Brand: <span className="text-white">{result.brand}</span></span>}
                {result.category && <span>Category: <span className="text-white">{result.category}</span></span>}
                {result.bsr && <span>BSR: <span className="text-white">#{result.bsr.toLocaleString()}</span></span>}
                {result.num_offers > 0 && <span>Sellers: <span className="text-white">{result.num_offers}</span></span>}
                {result.ean && <span>EAN: <span className="text-white">{result.ean}</span></span>}
              </div>
            </div>
            <a href={`https://www.amazon.co.uk/dp/${result.asin}`} target="_blank" rel="noopener noreferrer"
              className="flex-shrink-0 rounded-xl border border-blue-500/20 bg-blue-500/10 p-2 text-blue-300 hover:bg-blue-500/20 transition">
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Amazon Price", value: `£${Number(result.amazon_price).toFixed(2)}`, color: "border-blue-500/15" },
              { label: "FBA Fees", value: `£${Number(result.fba_fees).toFixed(2)}`, color: "border-red-500/15" },
              { label: "Referral Fee (~15%)", value: `£${Number(result.referral_fee).toFixed(2)}`, color: "border-orange-500/15" },
              { label: "Break-Even Buy Price", value: `£${Number(result.break_even).toFixed(2)}`, color: "border-emerald-500/15" },
            ].map(s => (
              <div key={s.label} className={`rounded-[20px] border ${s.color} bg-[#081120] p-4`}>
                <p className="text-xl font-semibold text-white">{s.value}</p>
                <p className="mt-0.5 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {/* ROI scenarios */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120] p-4">
            <button onClick={() => setShowScenarios(!showScenarios)}
              className="flex w-full items-center justify-between text-sm font-semibold text-white">
              <span>Max Buy Price by Target ROI</span>
              {showScenarios ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showScenarios && (
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                {(result.profit_scenarios || []).map((s: any) => (
                  <div key={s.roi} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-center">
                    <p className="text-lg font-semibold text-white">£{s.maxBuyPrice}</p>
                    <p className="text-xs text-slate-500">max buy for {s.roi}% ROI</p>
                    <p className="text-xs text-emerald-400 mt-0.5">£{s.profit} profit</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sourcing links */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120] p-4">
            <p className="mb-3 text-sm font-semibold text-white">Find This Product — Sourcing Links</p>
            <div className="flex flex-wrap gap-2">
              {(result.sourcing_links || []).map((link: any) => (
                <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 transition">
                  {link.name}<ExternalLink size={10} />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Recent Searches</p>
          <div className="space-y-2">
            {history.map((h: any) => (
              <button key={h.id} onClick={() => { setAsin(h.asin); setResult(h.results); }}
                className="flex w-full items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-left hover:bg-white/[0.06] transition">
                <div>
                  <p className="text-sm font-medium text-white">{h.asin}</p>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">{h.title || "—"}</p>
                </div>
                <span className="text-xs text-blue-400 flex-shrink-0">£{Number(h.amazon_price).toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── FIFO Cost of Goods ────────────────────────────────────────────────────────
function FifoCog() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [asin, setAsin] = useState("");
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const fetchBatches = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fba_cog_batches")
      .select("*")
      .eq("user_id", user.id)
      .order("purchase_date", { ascending: true });
    setBatches(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Group by ASIN and calculate FIFO weighted average cost
  const fifoSummary = batches.reduce<Record<string, any>>((acc, b) => {
    if (!acc[b.asin]) {
      acc[b.asin] = { asin: b.asin, title: b.title, batches: [], totalQty: 0, totalCost: 0, remainingQty: 0, fifoAvgCost: 0 };
    }
    acc[b.asin].batches.push(b);
    acc[b.asin].totalQty += b.quantity;
    acc[b.asin].totalCost += b.quantity * b.unit_cost;
    acc[b.asin].remainingQty += b.quantity_remaining;
    return acc;
  }, {});

  // Calculate FIFO avg cost from remaining batches only
  Object.values(fifoSummary).forEach((item: any) => {
    const remainingBatches = item.batches.filter((b: any) => b.quantity_remaining > 0);
    const totalRemainingCost = remainingBatches.reduce((s: number, b: any) => s + b.quantity_remaining * b.unit_cost, 0);
    const totalRemainingQty = remainingBatches.reduce((s: number, b: any) => s + b.quantity_remaining, 0);
    item.fifoAvgCost = totalRemainingQty > 0 ? totalRemainingCost / totalRemainingQty : 0;
  });

  async function handleAdd() {
    if (!asin || !title || !qty || !cost) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("fba_cog_batches").insert({
      user_id: user.id,
      asin: asin.toUpperCase(),
      title,
      quantity: parseInt(qty),
      unit_cost: parseFloat(cost),
      purchase_date: purchaseDate,
      quantity_remaining: parseInt(qty),
    });
    setAsin(""); setTitle(""); setQty(""); setCost("");
    setShowAdd(false); setSaving(false);
    fetchBatches();
  }

  async function handleSell(batchId: string, qtySold: number, currentRemaining: number) {
    const newRemaining = Math.max(0, currentRemaining - qtySold);
    await supabase.from("fba_cog_batches").update({ quantity_remaining: newRemaining }).eq("id", batchId);
    fetchBatches();
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-5">
        <div className="mb-3 flex items-start gap-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-white">FIFO Cost of Goods Tracking</p>
            <p className="text-xs text-slate-400 mt-1">Track multiple purchase batches per ASIN at different costs. FIFO (First In, First Out) means the oldest stock is sold first — giving you the most accurate profit calculation when you buy the same product at different prices over time.</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition">
          <Plus size={14} />Add Purchase Batch
        </button>
      </div>

      {showAdd && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120] p-5 space-y-4">
          <p className="text-sm font-semibold text-white">New Purchase Batch</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">ASIN</label>
              <input value={asin} onChange={e => setAsin(e.target.value.toUpperCase())} placeholder="B08N5WRWNW" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Product Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Product name" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity Purchased</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="50" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Unit Cost (£)</label>
              <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="5.99" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Purchase Date</label>
              <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className={inputCls} />
            </div>
            {qty && cost && (
              <div className="flex items-end pb-1">
                <p className="text-xs text-slate-400">Total cost: <span className="text-white font-semibold">£{(parseInt(qty || "0") * parseFloat(cost || "0")).toFixed(2)}</span></p>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving || !asin || !title || !qty || !cost}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {saving ? "Saving..." : "Add Batch"}
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/5">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
      ) : Object.keys(fifoSummary).length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/10 bg-[#081120]/50 py-12 text-center">
          <Layers size={24} className="mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No FIFO batches yet</p>
          <p className="mt-1 text-xs text-slate-600">Add a purchase batch to start tracking cost of goods accurately</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(fifoSummary).map((item: any) => (
            <div key={item.asin} className="rounded-[20px] border border-white/10 bg-[#081120]/80 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.asin} · {item.remainingQty} units remaining</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-amber-400">£{item.fifoAvgCost.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">FIFO avg cost</p>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {item.batches.map((b: any) => (
                  <div key={b.id} className={`flex items-center justify-between rounded-xl border border-white/5 px-4 py-2.5 ${b.quantity_remaining === 0 ? "opacity-40" : ""}`}>
                    <div>
                      <p className="text-sm text-white">{b.purchase_date} · {b.quantity_remaining}/{b.quantity} remaining</p>
                      <p className="text-xs text-slate-500">£{Number(b.unit_cost).toFixed(2)}/unit · Total: £{(b.quantity_remaining * b.unit_cost).toFixed(2)}</p>
                    </div>
                    {b.quantity_remaining > 0 && (
                      <button onClick={() => handleSell(b.id, 1, b.quantity_remaining)}
                        className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                        -1 Sold
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VAT P&L ───────────────────────────────────────────────────────────────────
function VatPnl() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [vatRate, setVatRate] = useState(20);
  const [vatRegistered, setVatRegistered] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => { fetchData(); }, [period]);

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    let startDate: string;
    if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    } else if (period === "quarter") {
      const q = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), q * 3, 1).toISOString().split("T")[0];
    } else {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
    }

    const [{ data: invSales }, { data: ebSales }, { data: expenses }] = await Promise.all([
      supabase.from("inventory_sales").select("sold_price, quantity_sold, fees, shipping").eq("user_id", user.id).gte("sold_date", startDate),
      supabase.from("ebay_sales").select("sale_price, quantity_sold, platform_fees, postage_cost").eq("user_id", user.id).gte("sold_date", startDate),
      supabase.from("expenses").select("amount, platform").eq("user_id", user.id).gte("expense_date", startDate),
    ]);

    const grossRevenue =
      (invSales || []).reduce((s: number, r: any) => s + Number(r.sold_price) * Number(r.quantity_sold), 0) +
      (ebSales || []).reduce((s: number, r: any) => s + Number(r.sale_price) * Number(r.quantity_sold), 0);

    const totalFees =
      (invSales || []).reduce((s: number, r: any) => s + Number(r.fees || 0) + Number(r.shipping || 0), 0) +
      (ebSales || []).reduce((s: number, r: any) => s + Number(r.platform_fees || 0) + Number(r.postage_cost || 0), 0);

    const totalExpenses = (expenses || []).reduce((s: number, e: any) => s + Number(e.amount), 0);
    const netRevenue = grossRevenue - totalFees;
    const grossProfit = netRevenue - totalExpenses;

    // VAT calculations
    const vatOnSales = vatRegistered ? grossRevenue * (vatRate / (100 + vatRate)) : 0; // VAT included in price
    const vatOnExpenses = vatRegistered ? totalExpenses * (vatRate / (100 + vatRate)) : 0; // Reclaimable input VAT
    const vatOwed = vatRegistered ? vatOnSales - vatOnExpenses : 0;

    const netRevenueExVat = netRevenue - vatOnSales;
    const expensesExVat = totalExpenses - vatOnExpenses;
    const netProfitAfterVat = netRevenueExVat - expensesExVat;

    setData({
      grossRevenue,
      netRevenue,
      totalFees,
      totalExpenses,
      grossProfit,
      vatOnSales,
      vatOnExpenses,
      vatOwed,
      netRevenueExVat,
      expensesExVat,
      netProfitAfterVat,
      effectiveTaxRate: grossRevenue > 0 ? (vatOwed / grossRevenue) * 100 : 0,
    });
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[20px] border border-violet-500/15 bg-[#081120] p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-violet-400" />
          <div>
            <p className="text-sm font-semibold text-white">VAT-Aware Profit & Loss</p>
            <p className="text-xs text-slate-400 mt-1">This pulls all your sales and expenses across eBay, Amazon, and inventory then calculates your real profit with VAT separated out — so you know exactly what you owe HMRC vs what you actually keep.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Period</label>
            <select value={period} onChange={e => { setPeriod(e.target.value); }} className={`${selectCls} w-36`}>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">VAT Rate</label>
            <select value={vatRate} onChange={e => setVatRate(Number(e.target.value))} className={`${selectCls} w-36`}>
              <option value={20}>20% Standard</option>
              <option value={5}>5% Reduced</option>
              <option value={0}>0% Not Registered</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <input type="checkbox" checked={vatRegistered} onChange={e => setVatRegistered(e.target.checked)} className="rounded" />
              <span className="text-xs text-slate-400">VAT Registered</span>
            </label>
          </div>
          <div className="flex items-end">
            <button onClick={fetchData} className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition">
              <RefreshCw size={13} />Recalculate
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
      ) : data && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Gross Revenue (inc VAT)", value: `£${data.grossRevenue.toFixed(2)}`, sub: "All sales before any deductions", color: "border-blue-500/15" },
              { label: "Net Revenue (ex VAT)", value: `£${data.netRevenueExVat.toFixed(2)}`, sub: "Revenue with VAT removed", color: "border-cyan-500/15" },
              { label: "Net Profit (after VAT)", value: `£${data.netProfitAfterVat.toFixed(2)}`, sub: "What you actually keep", color: data.netProfitAfterVat >= 0 ? "border-emerald-500/15" : "border-red-500/15" },
              { label: "VAT Owed to HMRC", value: vatRegistered ? `£${data.vatOwed.toFixed(2)}` : "N/A", sub: "Output VAT minus input VAT", color: "border-amber-500/15" },
            ].map(s => (
              <div key={s.label} className={`rounded-[20px] border ${s.color} bg-[#081120] p-4`}>
                <p className={`text-xl font-semibold ${s.label.includes("Profit") && data.netProfitAfterVat < 0 ? "text-red-400" : s.label.includes("VAT Owed") ? "text-amber-400" : "text-white"}`}>{s.value}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-300">{s.label}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Full breakdown */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120] p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Full P&L Breakdown</p>
            <div className="space-y-2">
              {[
                { label: "Gross Revenue", value: data.grossRevenue, type: "income" },
                { label: "Platform Fees & Postage", value: -data.totalFees, type: "deduction" },
                { label: "= Net Revenue", value: data.netRevenue, type: "subtotal" },
                { label: "Total Expenses", value: -data.totalExpenses, type: "deduction" },
                { label: "= Gross Profit", value: data.grossProfit, type: "subtotal" },
                ...(vatRegistered ? [
                  { label: "VAT on Sales (output)", value: -data.vatOnSales, type: "vat" },
                  { label: "VAT on Expenses (input, reclaimable)", value: data.vatOnExpenses, type: "vatback" },
                  { label: "= Net VAT Owed", value: -data.vatOwed, type: "vatowed" },
                ] : []),
                { label: "= NET PROFIT", value: data.netProfitAfterVat, type: "total" },
              ].map((row, i) => (
                <div key={i} className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                  row.type === "total" ? "border border-emerald-500/20 bg-emerald-500/5"
                  : row.type === "subtotal" ? "border border-white/10 bg-white/5"
                  : row.type === "vatowed" ? "border border-amber-500/20 bg-amber-500/5"
                  : "border-transparent"
                }`}>
                  <span className={`text-sm ${row.type === "total" ? "font-bold text-white" : row.type === "subtotal" ? "font-semibold text-white" : "text-slate-400"}`}>
                    {row.label}
                  </span>
                  <span className={`text-sm font-semibold ${
                    row.type === "total" ? row.value >= 0 ? "text-emerald-400" : "text-red-400"
                    : row.type === "vatowed" ? "text-amber-400"
                    : row.value >= 0 ? "text-white" : "text-red-400"
                  }`}>
                    {row.value >= 0 ? "+" : ""}£{Math.abs(row.value).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 pt-1">Disclaimer: This is an estimate for planning purposes. Consult a qualified accountant for official VAT returns.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FBA Hub Page ─────────────────────────────────────────────────────────
export default function FbaHubPage() {
  const [activeTab, setActiveTab] = useState<FbaTab>("wholesale");
  const [hasAmazonConn, setHasAmazonConn] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkConn() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("amazon_connections").select("user_id").eq("user_id", user.id).single();
      setHasAmazonConn(!!data);
    }
    checkConn();
  }, []);

  const tabs = [
    { id: "wholesale" as FbaTab, label: "Wholesale Scanner", icon: FileSpreadsheet },
    { id: "reimbursements" as FbaTab, label: "Reimbursements", icon: PoundSterling },
    { id: "reverse-asin" as FbaTab, label: "Reverse ASIN", icon: Search },
    { id: "fifo" as FbaTab, label: "FIFO Cost of Goods", icon: Layers },
    { id: "vat" as FbaTab, label: "VAT P&L", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                <ShoppingCart size={16} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">FBA Hub</h1>
            </div>
            <p className="text-sm text-slate-400">Amazon FBA tools — wholesale scanning, reimbursements, ASIN research, FIFO costing and VAT P&L.</p>
          </div>
          {hasAmazonConn === false && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
              <AlertCircle size={13} />
              <span>Connect Amazon in AIO Tracker → Amazon tab for full functionality</span>
            </div>
          )}
          {hasAmazonConn === true && (
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-300">
              <CheckCircle size={13} />Amazon SP-API Connected
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
              activeTab === id
                ? "border border-blue-500/30 bg-blue-500/15 text-blue-300"
                : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "wholesale" && <WholesaleScanner />}
        {activeTab === "reimbursements" && <ReimbursementScanner />}
        {activeTab === "reverse-asin" && <ReverseAsinSearch />}
        {activeTab === "fifo" && <FifoCog />}
        {activeTab === "vat" && <VatPnl />}
      </div>
    </div>
  );
}
