"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingCart, RefreshCw, Unlink, CheckCircle, AlertCircle, Package, Link2,
  Trash2, Star, Loader2, TrendingUp, PoundSterling, BarChart3,
  AlertTriangle, RotateCcw, Filter, Receipt,
} from "lucide-react";

const supabase = createClient();

type OrderStatus =
  | "COMPLETED" | "SHIPPED" | "PAID" | "CANCELLED" | "REFUNDED"
  | "PARTIALLY_REFUNDED" | "RETURNED" | null;

type EbaySale = {
  id: string;
  ebay_order_id: string;
  item_title: string;
  quantity_sold: number;
  sale_price: number;
  sold_date: string;
  auto_matched: boolean;
  matched_inventory_id: string | null;
  order_status: OrderStatus;
  postage_cost: number;
  platform_fees: number;
  return_reason: string | null;
  return_status: string | null;
  refund_amount: number | null;
  has_open_case: boolean;
};

type InventoryItem = {
  id: string;
  item_name: string;
  quantity_remaining: number;
  buy_price: number;
};

type ConnectionStatus = "loading" | "connected" | "disconnected" | "broken";

type FeedbackOrder = {
  orderId: string;
  itemId: string;
  transactionId: string;
  buyerUsername: string;
  itemTitle: string;
  saleDate: string;
};

type StatusFilter = "all" | "active" | "COMPLETED" | "SHIPPED" | "CANCELLED" | "REFUNDED" | "RETURNED";

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  COMPLETED:          { label: "Completed",     classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
  SHIPPED:            { label: "Shipped",        classes: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
  PAID:               { label: "Paid",           classes: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300" },
  CANCELLED:          { label: "Cancelled",      classes: "border-red-500/20 bg-red-500/10 text-red-300" },
  REFUNDED:           { label: "Refunded",       classes: "border-orange-500/20 bg-orange-500/10 text-orange-300" },
  PARTIALLY_REFUNDED: { label: "Partial Refund", classes: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
  RETURNED:           { label: "Returned",       classes: "border-purple-500/20 bg-purple-500/10 text-purple-300" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  if (!status) return <span className="text-slate-500 text-xs">—</span>;
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return <span className="text-slate-500 text-xs">{status}</span>;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function isInactive(status: OrderStatus) {
  return status === "CANCELLED" || status === "REFUNDED" || status === "RETURNED";
}

function netProfit(sale: EbaySale): number {
  // sale_price is per-unit, multiply by quantity for total revenue
  const revenue = Number(sale.sale_price) * Number(sale.quantity_sold);
  return (
    revenue -
    Number(sale.platform_fees ?? 0) -
    Number(sale.postage_cost ?? 0) -
    Number(sale.refund_amount ?? 0)
  );
}

export default function EbayTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [sales, setSales] = useState<EbaySale[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [ebayExpenses, setEbayExpenses] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"sales" | "feedback">("sales");
  const [feedbackOrders, setFeedbackOrders] = useState<FeedbackOrder[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("Great buyer, fast payment. Highly recommended! A++");
  const [leavingFeedback, setLeavingFeedback] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchSales = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("ebay_sales").select("*").eq("user_id", user.id)
      .order("sold_date", { ascending: false }).limit(200);
    setSales((data || []) as EbaySale[]);
  }, []);

  const fetchInventory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("inventory_items").select("id, item_name, quantity_remaining, buy_price")
      .eq("user_id", user.id).gt("quantity_remaining", 0).order("item_name", { ascending: true });
    setInventoryItems((data || []) as InventoryItem[]);
  }, []);

  const fetchExpenses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("expenses").select("amount, platform").eq("user_id", user.id);
    const total = (data || [])
      .filter((e: any) => e.platform === "ebay" || e.platform === "all" || !e.platform)
      .reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    setEbayExpenses(total);
  }, []);

  const checkConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("disconnected"); return; }
    const { data } = await supabase
      .from("ebay_connections").select("user_id, token_expires_at")
      .eq("user_id", user.id).single();
    if (!data) { setStatus("disconnected"); return; }
    const expired = new Date(data.token_expires_at) < new Date(Date.now() - 86400000);
    setStatus(expired ? "broken" : "connected");
    fetchSales();
    fetchInventory();
    fetchExpenses();
  }, [fetchSales, fetchInventory, fetchExpenses]);

  useEffect(() => {
    checkConnection();
    const params = new URLSearchParams(window.location.search);
    if (params.get("ebay") === "connected") {
      setSyncResult("eBay account connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("ebay") === "error") {
      setSyncResult("Failed to connect eBay. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkConnection]);

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/ebay/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${data.synced} order(s). ${data.matched} matched to inventory. ${data.updated} updated.`);
        if (status === "broken") setStatus("connected");
        fetchSales(); fetchInventory();
      } else {
        if (data.broken) setStatus("broken");
        setSyncResult(data.error || "Sync failed.");
      }
    } catch { setSyncResult("Sync failed. Please try again."); }
    finally { setSyncing(false); }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect your eBay account? Your synced sales history will be kept.")) return;
    setDisconnecting(true);
    await fetch("/api/ebay/disconnect", { method: "POST" });
    setStatus("disconnected"); setDisconnecting(false);
  }

  async function handleManualMatch(sale: EbaySale) {
    const inventoryId = selectedMatch[sale.id];
    if (!inventoryId) return;
    setMatching(sale.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMatching(null); return; }
    const inventoryItem = inventoryItems.find((i) => i.id === inventoryId);
    if (!inventoryItem) { setMatching(null); return; }
    const qty = Number(sale.quantity_sold) || 1;
    const newRemaining = Math.max(0, Number(inventoryItem.quantity_remaining) - qty);
    const soldDate = new Date(sale.sold_date).toISOString().split("T")[0];
    await supabase.from("inventory_sales").insert({
      user_id: user.id, inventory_item_id: inventoryItem.id,
      item_name: inventoryItem.item_name, quantity_sold: qty,
      sold_price: Number(sale.sale_price), fees: 0, shipping: 0, sold_date: soldDate,
    });
    await supabase.from("inventory_items").update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? "sold" : "in_stock",
      sold_price: Number(sale.sale_price), sold_date: soldDate,
    }).eq("id", inventoryItem.id);
    await supabase.from("ebay_sales").update({
      matched_inventory_id: inventoryId, auto_matched: false,
    }).eq("id", sale.id);
    fetchSales(); fetchInventory();
    setMatching(null);
  }

  async function handleDeleteSale(id: string) {
    if (!window.confirm("Delete this sale record?")) return;
    setDeleting(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(null); return; }
    await supabase.from("ebay_sales").delete().eq("id", id).eq("user_id", user.id);
    fetchSales(); setDeleting(null);
  }

  async function handleDeleteAll() {
    if (!window.confirm("Delete ALL eBay sales records? This cannot be undone.")) return;
    setDeletingAll(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingAll(false); return; }
    await supabase.from("ebay_sales").delete().eq("user_id", user.id);
    setSales([]); setDeletingAll(false);
  }

  async function fetchFeedbackOrders() {
    setLoadingFeedback(true); setFeedbackResult(null);
    try {
      const res = await fetch("/api/ebay/feedback");
      const data = await res.json();
      if (res.ok) setFeedbackOrders(data.orders || []);
      else setFeedbackResult({ ok: false, msg: data.error || "Failed to fetch feedback orders." });
    } catch { setFeedbackResult({ ok: false, msg: "Failed to fetch feedback orders." }); }
    finally { setLoadingFeedback(false); }
  }

  async function handleLeaveFeedback() {
    if (selectedFeedback.size === 0) return;
    setLeavingFeedback(true); setFeedbackResult(null);
    const orders = feedbackOrders.filter(o => selectedFeedback.has(o.orderId));
    try {
      const res = await fetch("/api/ebay/feedback/leave", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders, message: feedbackMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackResult({ ok: true, msg: `Left feedback for ${data.successful} buyer(s).${data.failed > 0 ? ` ${data.failed} failed.` : ""}` });
        setFeedbackOrders(prev => prev.filter(o => !selectedFeedback.has(o.orderId)));
        setSelectedFeedback(new Set());
      } else {
        setFeedbackResult({ ok: false, msg: data.error || "Failed." });
      }
    } catch { setFeedbackResult({ ok: false, msg: "Network error." }); }
    finally { setLeavingFeedback(false); }
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeSales = sales.filter(s => !isInactive(s.order_status));
  const totalNetProfit = activeSales.reduce((sum, s) => sum + netProfit(s), 0);
  const totalRevenue = activeSales.reduce((sum, s) => sum + Number(s.sale_price) * Number(s.quantity_sold), 0);
  const totalFees = activeSales.reduce((sum, s) => sum + Number(s.platform_fees ?? 0) + Number(s.postage_cost ?? 0), 0);
  const returnSales = sales.filter(s => s.return_reason || s.return_status || s.refund_amount);
  const openCases = sales.filter(s => s.has_open_case);
  const totalRefunded = returnSales.reduce((sum, s) => sum + Number(s.refund_amount ?? 0), 0);
  const afterExpenses = totalNetProfit - ebayExpenses;

  const filteredSales = sales.filter(s => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return !isInactive(s.order_status);
    return s.order_status === statusFilter;
  });

  if (status === "loading") {
    return <div className="flex items-center justify-center py-20"><Loader2 size={20} className="animate-spin text-slate-500" /></div>;
  }

  if (status === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <ShoppingCart size={24} />
        </div>
        <h3 className="text-xl font-semibold text-white">Connect your eBay account</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-400">Link your eBay account to automatically sync your sales and match them to your inventory.</p>
        <a href="/api/ebay/connect" className="mt-6 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition">
          Connect eBay Account
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Broken connection banner */}
      {status === "broken" && (
        <div className="flex items-start gap-4 rounded-[20px] border border-red-500/25 bg-red-500/10 px-5 py-4">
          <AlertTriangle size={20} className="mt-0.5 flex-shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">eBay sync stopped working</p>
            <p className="mt-1 text-xs text-red-300/70">Your eBay token has expired or been revoked. Your sales history is safe — just reconnect to resume syncing.</p>
          </div>
          <a href="/api/ebay/connect"
            className="flex-shrink-0 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/25 transition">
            Reconnect →
          </a>
        </div>
      )}

      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
            <ShoppingCart size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">eBay Sales</p>
            <p className="text-xs text-slate-500">{sales.length} records synced</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50">
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button onClick={handleDeleteAll} disabled={deletingAll}
            className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 transition disabled:opacity-50">
            <Trash2 size={12} />{deletingAll ? "Clearing..." : "Clear All"}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 transition disabled:opacity-50">
            <Unlink size={12} />{disconnecting ? "..." : "Disconnect"}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${syncResult.includes("success") || syncResult.includes("Synced") ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
          <AlertCircle size={14} />{syncResult}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 w-fit">
        {(["sales", "feedback"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveSubTab(tab)}
            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${activeSubTab === tab ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
            {tab === "sales" ? "Sales" : "Feedback"}
          </button>
        ))}
      </div>

      {/* Sales Tab */}
      {activeSubTab === "sales" && (<>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300"><PoundSterling size={14} /></div>
            <p className="text-xl font-semibold text-white">£{totalRevenue.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Total Revenue</p>
          </div>
          <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><TrendingUp size={14} /></div>
            <p className="text-xl font-semibold text-white">£{totalNetProfit.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Net Profit</p>
          </div>
          <div className="rounded-[20px] border border-violet-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300"><Receipt size={14} /></div>
            <p className="text-xl font-semibold text-white">£{afterExpenses.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">After Expenses</p>
          </div>
          <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300"><BarChart3 size={14} /></div>
            <p className="text-xl font-semibold text-white">£{totalFees.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">Fees & Postage</p>
          </div>
          <div className="rounded-[20px] border border-red-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10 text-red-300"><RotateCcw size={14} /></div>
            <p className="text-xl font-semibold text-white">£{totalRefunded.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Returns · {returnSales.length} total
              {openCases.length > 0 && <span className="ml-1 text-amber-400">{openCases.length} case open</span>}
            </p>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={13} className="text-slate-500" />
          {(["all", "active", "COMPLETED", "SHIPPED", "CANCELLED", "REFUNDED", "RETURNED"] as StatusFilter[]).map((f) => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${statusFilter === f ? "border-blue-500/30 bg-blue-500/15 text-blue-300" : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"}`}>
              {f === "all" ? "All" : f === "active" ? "Active only" : STATUS_CONFIG[f]?.label ?? f}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-600">{filteredSales.length} showing</span>
        </div>

        {/* Sales table */}
        <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
          <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Synced eBay Sales</p>
            <p className="text-xs text-slate-500">{filteredSales.length} records</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="border-b border-white/10 text-left text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">Qty</th>
                  <th className="px-4 py-3 font-medium">Sale Price</th>
                  <th className="px-4 py-3 font-medium">Net Profit</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Return</th>
                  <th className="px-4 py-3 font-medium">Sold Date</th>
                  <th className="px-4 py-3 font-medium">Inventory Match</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                      {sales.length === 0 ? 'No sales synced yet. Press "Sync Now" to pull your eBay orders.' : "No sales match this filter."}
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((sale) => {
                    const inactive = isInactive(sale.order_status);
                    const np = netProfit(sale);
                    return (
                      <tr key={sale.id}
                        className={`border-b border-white/5 transition ${inactive ? "opacity-50" : "hover:bg-white/[0.02]"}`}>
                        <td className={`px-4 py-3 font-medium max-w-[260px] truncate ${inactive ? "text-slate-500 line-through" : "text-white"}`}
                          title={sale.item_title}>
                          {sale.item_title}
                          {sale.has_open_case && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">
                              Case open
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                        <td className="px-4 py-3 text-slate-300">£{Number(sale.sale_price).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {inactive
                            ? <span className="text-slate-600">—</span>
                            : <span className={np >= 0 ? "text-emerald-300 font-medium" : "text-red-300 font-medium"}>£{np.toFixed(2)}</span>
                          }
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={sale.order_status} /></td>
                        <td className="px-4 py-3">
                          {sale.return_reason || sale.return_status ? (
                            <div className="space-y-1">
                              {sale.return_reason && <span className="block text-xs text-slate-400">{sale.return_reason}</span>}
                              {sale.return_status && (
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                                  sale.return_status === "escalated" ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                                  : sale.return_status === "closed" ? "border-slate-500/20 bg-slate-500/10 text-slate-400"
                                  : "border-orange-500/20 bg-orange-500/10 text-orange-300"}`}>
                                  {sale.return_status}
                                </span>
                              )}
                              {sale.refund_amount != null
                                ? <span className="block text-xs text-red-400">-£{Number(sale.refund_amount).toFixed(2)}</span>
                                : sale.return_status === "escalated"
                                ? <span className="block text-xs text-slate-600">Awaiting ruling</span>
                                : null
                              }
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{new Date(sale.sold_date).toLocaleDateString("en-GB")}</td>
                        <td className="px-4 py-3">
                          {sale.matched_inventory_id ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                              <Package size={10} />{sale.auto_matched ? "Auto-matched" : "Matched"}
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <select value={selectedMatch[sale.id] ?? ""}
                                onChange={(e) => setSelectedMatch((prev) => ({ ...prev, [sale.id]: e.target.value }))}
                                className="rounded-xl border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none max-w-[160px]">
                                <option value="">Select item...</option>
                                {inventoryItems.map((item) => (
                                  <option key={item.id} value={item.id}>{item.item_name} ({item.quantity_remaining} left)</option>
                                ))}
                              </select>
                              <button onClick={() => handleManualMatch(sale)}
                                disabled={!selectedMatch[sale.id] || matching === sale.id}
                                className="flex items-center gap-1 rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 transition">
                                <Link2 size={11} />{matching === sale.id ? "..." : "Match"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteSale(sale.id)} disabled={deleting === sale.id}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 transition disabled:opacity-40">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>)}

      {/* Feedback Tab */}
      {activeSubTab === "feedback" && (
        <div className="space-y-5">
          <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Leave Feedback for Buyers</h3>
                <p className="mt-1 text-xs text-slate-400">Fetch orders awaiting feedback and leave positive reviews in one click.</p>
              </div>
              <button onClick={fetchFeedbackOrders} disabled={loadingFeedback}
                className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50">
                {loadingFeedback ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {loadingFeedback ? "Loading..." : "Fetch Pending"}
              </button>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Feedback Message</label>
              <input value={feedbackMessage} onChange={e => setFeedbackMessage(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400/30" />
            </div>
          </div>
          {feedbackResult && (
            <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${feedbackResult.ok ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
              <AlertCircle size={14} />{feedbackResult.msg}
            </div>
          )}
          {loadingFeedback ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Fetching pending feedback orders...
            </div>
          ) : feedbackOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 rounded-[20px] border border-white/10 bg-[#081120]/50 text-center">
              <Star size={28} className="mb-3 text-slate-600" />
              <p className="text-sm font-semibold text-white">No pending feedback</p>
              <p className="mt-1 text-xs text-slate-500">Click "Fetch Pending" to check for orders awaiting feedback.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-sm text-white font-medium">{feedbackOrders.length} order{feedbackOrders.length !== 1 ? "s" : ""} awaiting feedback</p>
                  <button onClick={() => setSelectedFeedback(selectedFeedback.size === feedbackOrders.length ? new Set() : new Set(feedbackOrders.map(o => o.orderId)))}
                    className="text-xs text-blue-400 hover:text-blue-300 transition">
                    {selectedFeedback.size === feedbackOrders.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <button onClick={handleLeaveFeedback} disabled={leavingFeedback || selectedFeedback.size === 0}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50">
                  {leavingFeedback ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                  {leavingFeedback ? "Leaving..." : `Leave Feedback (${selectedFeedback.size})`}
                </button>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                    <tr>
                      <th className="px-4 py-3 w-8"></th>
                      <th className="px-4 py-3 font-medium">Item</th>
                      <th className="px-4 py-3 font-medium">Buyer</th>
                      <th className="px-4 py-3 font-medium">Sale Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackOrders.map(order => (
                      <tr key={order.orderId} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <button onClick={() => setSelectedFeedback(prev => {
                            const n = new Set(prev); n.has(order.orderId) ? n.delete(order.orderId) : n.add(order.orderId); return n;
                          })} className="text-slate-500 hover:text-white transition">
                            {selectedFeedback.has(order.orderId) ? <CheckCircle size={15} className="text-blue-400" /> : <div className="h-4 w-4 rounded border border-white/20" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-white max-w-[300px] truncate" title={order.itemTitle}>{order.itemTitle}</td>
                        <td className="px-4 py-3 text-slate-300">@{order.buyerUsername}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(order.saleDate).toLocaleDateString("en-GB")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
