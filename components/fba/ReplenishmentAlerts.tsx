"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle, Bell, X, Info } from "lucide-react";

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition";

export default function ReplenishmentAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [asin, setAsin] = useState("");
  const [title, setTitle] = useState("");
  const [threshold, setThreshold] = useState("5");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchAlerts = useCallback(async () => {
    const res = await fetch("/api/fba/replenishment");
    const data = await res.json();
    setAlerts(data.alerts || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  async function handleSync() {
    setSyncing(true); setSyncResult("");
    try {
      const res = await fetch("/api/fba/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (res.ok) { setSyncResult(data.message); fetchAlerts(); }
      else setSyncResult(data.error || "Sync failed.");
    } catch { setSyncResult("Sync failed."); }
    finally { setSyncing(false); }
  }

  async function handleAdd() {
    if (!asin.trim() || !threshold) { setError("ASIN and threshold required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/fba/replenishment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert", asin, title: title || asin, threshold: parseInt(threshold), notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setAsin(""); setTitle(""); setThreshold("5"); setNotes("");
        setShowAdd(false); fetchAlerts();
      } else setError(data.error || "Failed to save.");
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch("/api/fba/replenishment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    fetchAlerts();
  }

  const triggered = alerts.filter(a => a.is_triggered);
  const ok = alerts.filter(a => !a.is_triggered && a.current_stock !== null);
  const unchecked = alerts.filter(a => a.current_stock === null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info size={15} className="mt-0.5 flex-shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">FBA Replenishment Alerts</p>
            <p className="text-xs text-slate-400 mt-1">Add ASINs you sell on FBA and set a reorder threshold. When stock drops to or below that number, the alert fires. Click Sync to check current stock levels against your Amazon account.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {syncing ? "Checking Stock..." : "Sync Stock Levels"}
          </button>
          <button onClick={() => { setShowAdd(!showAdd); setError(""); }}
            className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition">
            <Plus size={13} />Add Alert
          </button>
        </div>
        {syncResult && (
          <p className={`text-xs ${syncResult.includes("failed") || syncResult.includes("error") ? "text-red-400" : "text-emerald-400"}`}>{syncResult}</p>
        )}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">New Replenishment Alert</p>
            <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-white"><X size={15} /></button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">ASIN *</label>
              <input value={asin} onChange={e => setAsin(e.target.value.toUpperCase())}
                placeholder="B08N5WRWNW" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Product Name</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="What is this product?" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Reorder Threshold (units) *</label>
              <input type="number" min="1" value={threshold} onChange={e => setThreshold(e.target.value)} className={inputCls} />
              <p className="mt-1 text-[10px] text-slate-600">Alert fires when stock is at or below this number</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Lead time 2 weeks" className={inputCls} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {saving ? "Saving..." : "Add Alert"}
            </button>
            <button onClick={() => setShowAdd(false)} className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/5">Cancel</button>
          </div>
        </div>
      )}

      {/* Triggered alerts */}
      {triggered.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-300">
            <AlertTriangle size={14} />
            {triggered.length} alert{triggered.length !== 1 ? "s" : ""} triggered — reorder needed
          </div>
          {triggered.map(a => (
            <div key={a.id} className="flex items-center gap-4 rounded-[20px] border border-red-500/25 bg-red-500/8 px-5 py-4">
              <AlertTriangle size={18} className="flex-shrink-0 text-red-400" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{a.title}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{a.asin}</p>
                {a.notes && <p className="text-xs text-slate-500 mt-0.5">{a.notes}</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-red-400">{a.current_stock ?? "?"}</p>
                <p className="text-xs text-slate-500">units left (threshold: {a.threshold})</p>
              </div>
              <button onClick={() => handleDelete(a.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* OK alerts */}
      {ok.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Stock OK</p>
          {ok.map(a => (
            <div key={a.id} className="flex items-center gap-4 rounded-[20px] border border-white/10 bg-[#081120]/80 px-5 py-3.5">
              <CheckCircle size={16} className="flex-shrink-0 text-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-slate-500 font-mono">{a.asin}{a.notes ? ` · ${a.notes}` : ""}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-semibold text-white">{a.current_stock}</p>
                <p className="text-xs text-slate-600">units (alert at {a.threshold})</p>
              </div>
              <button onClick={() => handleDelete(a.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 transition opacity-50 hover:opacity-100">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unchecked */}
      {unchecked.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Not checked yet — click Sync</p>
          {unchecked.map(a => (
            <div key={a.id} className="flex items-center gap-4 rounded-[20px] border border-white/10 bg-[#081120]/80 opacity-60 px-5 py-3.5">
              <Bell size={16} className="flex-shrink-0 text-slate-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-slate-500 font-mono">{a.asin}</p>
              </div>
              <p className="text-xs text-slate-600 flex-shrink-0">Alert at {a.threshold} units</p>
              <button onClick={() => handleDelete(a.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 transition">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
      ) : alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/10 bg-[#081120]/50 py-12 text-center">
          <Bell size={24} className="mb-3 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No replenishment alerts yet</p>
          <p className="mt-1 text-xs text-slate-600">Add your FBA ASINs to start monitoring stock levels</p>
        </div>
      )}
    </div>
  );
}
