"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Mail, RefreshCw, CheckCircle, XCircle, Clock, Unlink,
  ShoppingBag, Package, ChevronDown, ChevronUp, Pencil, AlertCircle,
} from "lucide-react";

const supabase = createClient();

type ImportStatus = "pending" | "approved" | "skipped";

type ParsedItem = {
  item_name: string;
  quantity: number;
  unit_price_gbp: number | null;
};

type GmailImport = {
  id: string;
  retailer: string;
  subject: string;
  sender_email: string;
  order_number: string | null;
  order_date: string | null;
  order_total_gbp: number | null;
  parsed_items: ParsedItem[] | null;
  status: ImportStatus;
  created_at: string;
};

type ConnectionStatus = "loading" | "connected" | "disconnected";

const statusColours: Record<ImportStatus, string> = {
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  skipped: "border-slate-500/20 bg-slate-500/10 text-slate-400",
};

export default function GmailSyncPage() {
  const [connStatus, setConnStatus] = useState<ConnectionStatus>("loading");
  const [gmailAddress, setGmailAddress] = useState<string | null>(null);
  const [imports, setImports] = useState<GmailImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ImportStatus | "all">("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<Record<string, ParsedItem[]>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setConnStatus("disconnected"); setLoading(false); return; }

    const { data } = await supabase
      .from("gmail_connections")
      .select("gmail_address")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setConnStatus("connected");
      setGmailAddress(data.gmail_address);
      fetchImports();
    } else {
      setConnStatus("disconnected");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Handle redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      setSyncResult("Gmail connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("gmail") === "error") {
      setSyncResult("Failed to connect Gmail. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
    checkConnection();
  }, [checkConnection]);

  async function fetchImports() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("gmail_imports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setImports((data || []) as GmailImport[]);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data.message);
        fetchImports();
      } else {
        setSyncResult(data.error || "Sync failed.");
      }
    } catch {
      setSyncResult("Sync failed. Please try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect Gmail? Your import history will be kept.")) return;
    await fetch("/api/gmail/disconnect", { method: "POST" });
    setConnStatus("disconnected");
    setGmailAddress(null);
  }

  async function handleApprove(imp: GmailImport) {
    setProcessing(imp.id);
    const items = editItems[imp.id] ?? imp.parsed_items ?? [];
    const res = await fetch("/api/gmail/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importId: imp.id, items }),
    });
    const data = await res.json();
    if (res.ok) {
      setSyncResult(`Approved — ${data.itemsCreated} item(s) added to inventory.`);
      fetchImports();
    } else {
      setSyncResult(data.error || "Failed to approve.");
    }
    setProcessing(null);
  }

  async function handleSkip(importId: string) {
    setProcessing(importId);
    await fetch("/api/gmail/skip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ importId }),
    });
    fetchImports();
    setProcessing(null);
  }

  function getEditItems(imp: GmailImport): ParsedItem[] {
    return editItems[imp.id] ?? imp.parsed_items ?? [];
  }

  function updateItem(importId: string, index: number, field: keyof ParsedItem, value: string | number) {
    const current = imports.find((i) => i.id === importId);
    const items = [...(editItems[importId] ?? current?.parsed_items ?? [])];
    items[index] = { ...items[index], [field]: value };
    setEditItems((prev) => ({ ...prev, [importId]: items }));
  }

  const filteredImports = imports.filter((i) =>
    activeFilter === "all" ? true : i.status === activeFilter
  );
  const pendingCount = imports.filter((i) => i.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        Loading Gmail Sync...
      </div>
    );
  }

  if (connStatus === "disconnected") {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <span className="text-blue-400">📧</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gmail Sync</h1>
            <p className="mt-1 text-sm text-slate-400">Connect your Gmail to automatically detect order confirmation emails.</p>
          </div>
        </div>

        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-10 text-center">
          <div className="mb-5 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
              <Mail size={28} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-white">Connect your Gmail</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-400">
            Link your Gmail account and we'll scan for order confirmation emails from Nike, ASOS, JD Sports, Amazon and hundreds of other retailers — then add them to your inventory with one click.
          </p>

          <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left">
            {[
              { icon: Mail, text: "Scans for order confirmations automatically" },
              { icon: ShoppingBag, text: "Detects 30+ retailers including Nike, ASOS, Amazon and more" },
              { icon: Package, text: "Review each order before it's added to inventory" },
              { icon: CheckCircle, text: "Approve or skip — you're always in control" },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                  <Icon size={15} className="flex-shrink-0 text-blue-400" />
                  <span className="text-sm text-slate-300">{f.text}</span>
                </div>
              );
            })}
          </div>

          <a href="/api/gmail/connect"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500">
            <Mail size={16} />
            Connect Gmail Account
          </a>

          {syncResult && (
            <p className="mt-4 text-sm text-red-300">{syncResult}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-blue-400">📧</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Gmail Sync</h1>
            <p className="mt-1 text-sm text-slate-400">
              Connected as <span className="text-blue-300">{gmailAddress}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Scanning..." : "Scan Inbox"}
          </button>
          <button onClick={handleDisconnect}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20">
            <Unlink size={14} />Disconnect
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="flex items-center gap-2 rounded-2xl border border-blue-500/15 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
          <AlertCircle size={14} />
          {syncResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Pending review", value: imports.filter((i) => i.status === "pending").length, color: "text-amber-300" },
          { label: "Approved", value: imports.filter((i) => i.status === "approved").length, color: "text-emerald-300" },
          { label: "Skipped", value: imports.filter((i) => i.status === "skipped").length, color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-[20px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{s.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="mb-5 flex flex-wrap gap-2">
          {(["pending", "approved", "skipped", "all"] as const).map((f) => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition capitalize ${
                activeFilter === f
                  ? "border border-blue-500/30 bg-blue-500/15 text-blue-300"
                  : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              }`}>
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-300">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {filteredImports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Mail size={32} className="mb-3 text-slate-700" />
            <p className="text-sm font-medium text-slate-400">
              {activeFilter === "pending" ? "No orders pending review." : `No ${activeFilter} orders.`}
            </p>
            {activeFilter === "pending" && (
              <p className="mt-1 text-xs text-slate-600">Click "Scan Inbox" to check for new order emails.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredImports.map((imp) => {
              const isExpanded = expanded === imp.id;
              const items = getEditItems(imp);

              return (
                <div key={imp.id} className="rounded-[20px] border border-white/8 bg-[#081120] overflow-hidden">
                  {/* Header row */}
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        <ShoppingBag size={15} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{imp.retailer}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusColours[imp.status]}`}>
                            {imp.status}
                          </span>
                        </div>
                        {imp.order_number && (
                          <p className="mt-0.5 text-xs text-slate-500">Order #{imp.order_number}</p>
                        )}
                        <p className="mt-0.5 text-xs text-slate-600 truncate max-w-xs">{imp.subject}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-right">
                        {imp.order_total_gbp && (
                          <p className="text-sm font-semibold text-white">£{Number(imp.order_total_gbp).toFixed(2)}</p>
                        )}
                        {imp.order_date && (
                          <p className="text-xs text-slate-500">{imp.order_date}</p>
                        )}
                      </div>

                      <button onClick={() => setExpanded(isExpanded ? null : imp.id)}
                        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        {items.length} item{items.length !== 1 ? "s" : ""}
                      </button>

                      {imp.status === "pending" && (
                        <>
                          <button onClick={() => handleApprove(imp)} disabled={processing === imp.id}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
                            <CheckCircle size={13} />
                            {processing === imp.id ? "Approving..." : "Approve"}
                          </button>
                          <button onClick={() => handleSkip(imp.id)} disabled={processing === imp.id}
                            className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50">
                            <XCircle size={13} />Skip
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="border-t border-white/8 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Pencil size={12} className="text-slate-500" />
                        <p className="text-xs text-slate-500">Review and edit items before approving</p>
                      </div>
                      <div className="space-y-2">
                        {items.map((item, idx) => (
                          <div key={idx} className="grid gap-2 sm:grid-cols-3">
                            <input
                              value={item.item_name}
                              onChange={(e) => updateItem(imp.id, idx, "item_name", e.target.value)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none sm:col-span-1"
                              placeholder="Item name"
                              disabled={imp.status !== "pending"}
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateItem(imp.id, idx, "quantity", parseInt(e.target.value) || 1)}
                                className="w-20 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                                placeholder="Qty"
                                disabled={imp.status !== "pending"}
                              />
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price_gbp ?? ""}
                                onChange={(e) => updateItem(imp.id, idx, "unit_price_gbp", parseFloat(e.target.value) || 0)}
                                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                                placeholder="Price £"
                                disabled={imp.status !== "pending"}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {imp.status === "pending" && (
                        <div className="mt-4 flex gap-2">
                          <button onClick={() => handleApprove(imp)} disabled={processing === imp.id}
                            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-50">
                            <CheckCircle size={13} />
                            {processing === imp.id ? "Adding to inventory..." : "Approve & Add to Inventory"}
                          </button>
                          <button onClick={() => handleSkip(imp.id)}
                            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300 hover:bg-red-500/20">
                            <XCircle size={13} />Skip this order
                          </button>
                        </div>
                      )}

                      {imp.status === "approved" && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle size={12} />Added to inventory
                        </p>
                      )}
                      {imp.status === "skipped" && (
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock size={12} />Skipped
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
