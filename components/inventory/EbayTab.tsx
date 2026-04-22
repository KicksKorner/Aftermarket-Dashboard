"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, RefreshCw, Unlink, CheckCircle, AlertCircle, Package, Link2, Trash2, Star, MessageSquare, Loader2, TrendingUp, PoundSterling, BarChart3 } from "lucide-react";

const supabase = createClient();

type EbaySale = {
  id: string;
  ebay_order_id: string;
  item_title: string;
  quantity_sold: number;
  sale_price: number;
  sold_date: string;
  auto_matched: boolean;
  matched_inventory_id: string | null;
};

type InventoryItem = {
  id: string;
  item_name: string;
  quantity_remaining: number;
  buy_price: number;
};

type ConnectionStatus = "loading" | "connected" | "disconnected";

type FeedbackOrder = {
  orderId: string;
  itemId: string;
  transactionId: string;
  buyerUsername: string;
  itemTitle: string;
  saleDate: string;
};

export default function EbayTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [sales, setSales] = useState<EbaySale[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
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
  const [feedbackResult, setFeedbackResult] = useState<{ok: boolean; msg: string} | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Set<string>>(new Set());

  const fetchSales = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("ebay_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_date", { ascending: false })
      .limit(100);
    setSales((data || []) as EbaySale[]);
  }, []);

  const fetchInventory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("inventory_items")
      .select("id, item_name, quantity_remaining, buy_price")
      .eq("user_id", user.id)
      .gt("quantity_remaining", 0)
      .order("item_name", { ascending: true });
    setInventoryItems((data || []) as InventoryItem[]);
  }, []);

  const checkConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("disconnected"); return; }

    const { data } = await supabase
      .from("ebay_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    setStatus(data ? "connected" : "disconnected");
    if (data) {
      fetchSales();
      fetchInventory();
    }
  }, [fetchSales, fetchInventory]);

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
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ebay/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${data.synced} order(s). ${data.matched} matched to inventory.`);
        fetchSales();
        fetchInventory();
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
    if (!window.confirm("Disconnect your eBay account? Your synced sales history will be kept.")) return;
    setDisconnecting(true);
    await fetch("/api/ebay/disconnect", { method: "POST" });
    setStatus("disconnected");
    setDisconnecting(false);
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

    // Create inventory sale record
    await supabase.from("inventory_sales").insert({
      user_id: user.id,
      inventory_item_id: inventoryItem.id,
      item_name: inventoryItem.item_name,
      quantity_sold: qty,
      sold_price: Number(sale.sale_price),
      fees: 0,
      shipping: 0,
      sold_date: soldDate,
    });

    // Update inventory item
    await supabase.from("inventory_items").update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? "sold" : "in_stock",
      sold_price: Number(sale.sale_price),
      sold_date: soldDate,
    }).eq("id", inventoryItem.id);

    // Update ebay_sale with the matched inventory id
    await supabase.from("ebay_sales").update({
      matched_inventory_id: inventoryId,
      auto_matched: false,
    }).eq("id", sale.id);

    // Clear selection and refresh
    setSelectedMatch((prev) => {
      const next = { ...prev };
      delete next[sale.id];
      return next;
    });

    setSyncResult(`Matched "${sale.item_title}" → "${inventoryItem.item_name}" and marked as sold.`);
    fetchSales();
    fetchInventory();
    setMatching(null);
  }

  async function handleDeleteSale(saleId: string) {
    setDeleting(saleId);
    await supabase.from("ebay_sales").delete().eq("id", saleId);
    setDeleting(null);
    fetchSales();
  }

  async function handleDeleteAllUnmatched() {
    if (!window.confirm("Delete all unmatched sales? This cannot be undone.")) return;
    setDeletingAll(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeletingAll(false); return; }
    await supabase.from("ebay_sales").delete().eq("user_id", user.id).is("matched_inventory_id", null);
    setDeletingAll(false);
    setSyncResult("All unmatched sales deleted.");
    fetchSales();
  }

  async function fetchFeedbackOrders() {
    setLoadingFeedback(true);
    setFeedbackResult(null);
    try {
      const res = await fetch("/api/ebay/feedback/pending");
      const data = await res.json();
      if (res.ok) {
        setFeedbackOrders(data.orders || []);
        if ((data.orders || []).length > 0) {
          setSelectedFeedback(new Set(data.orders.map((o: FeedbackOrder) => o.orderId)));
        }
      } else {
        setFeedbackResult({ ok: false, msg: data.error || "Failed to load pending feedback." });
      }
    } catch {
      setFeedbackResult({ ok: false, msg: "Connection error." });
    }
    setLoadingFeedback(false);
  }

  async function handleLeaveFeedback() {
    if (selectedFeedback.size === 0) return;
    setLeavingFeedback(true);
    setFeedbackResult(null);
    const ordersToProcess = feedbackOrders.filter(o => selectedFeedback.has(o.orderId));
    try {
      const res = await fetch("/api/ebay/feedback/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: ordersToProcess, message: feedbackMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedbackResult({ ok: true, msg: `✅ Left feedback for ${data.successful} buyer${data.successful !== 1 ? "s" : ""}${data.failed > 0 ? `. ${data.failed} failed.` : "."}` });
        setFeedbackOrders(prev => prev.filter(o => !selectedFeedback.has(o.orderId)));
        setSelectedFeedback(new Set());
      } else {
        setFeedbackResult({ ok: false, msg: data.error || "Failed to leave feedback." });
      }
    } catch {
      setFeedbackResult({ ok: false, msg: "Connection error." });
    }
    setLeavingFeedback(false);
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        Checking eBay connection...
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <ShoppingCart size={28} />
        </div>
        <h3 className="text-xl font-semibold text-white">No eBay Account Connected</h3>
        <p className="mt-2 max-w-sm text-sm text-slate-400">
          Click "Connect eBay" to link your account and start syncing sales. Matched sales will automatically update your inventory.
        </p>
        <a href="/api/ebay/connect"
          className="mt-6 flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
          <ShoppingCart size={16} />
          Connect eBay Account
        </a>
        {syncResult && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {syncResult}
          </div>
        )}
      </div>
    );
  }

  const unmatchedCount = sales.filter((s) => !s.matched_inventory_id).length;

  return (
    <div className="space-y-5">
      {/* Connected header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">eBay account connected</p>
            <p className="text-xs text-slate-400">Sync pulls your last 90 days of orders. Already synced orders are never duplicated.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">
            <Unlink size={14} />Disconnect
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${syncResult.includes("error") || syncResult.includes("failed") ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/15 bg-emerald-500/10 text-emerald-300"}`}>
          <AlertCircle size={14} />{syncResult}
        </div>
      )}

      {/* eBay stat cards */}
      {(() => {
        const totalRev = sales.reduce((s, x) => s + Number(x.sale_price) * Number(x.quantity_sold), 0);
        const totalOrders = sales.length;
        const avgSale = totalOrders > 0 ? totalRev / totalOrders : 0;
        return (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "eBay Revenue", value: `£${totalRev.toFixed(2)}`, icon: PoundSterling, color: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
              { label: "eBay Orders", value: String(totalOrders), icon: ShoppingCart, color: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
              { label: "Avg Sale Price", value: `£${avgSale.toFixed(2)}`, icon: TrendingUp, color: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-[20px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-4">
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${s.color}`}><Icon size={15} /></div>
                  <p className="text-xl font-semibold text-white">{s.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Sub-tab nav */}
      <div className="flex gap-2 border-b border-white/10 pb-3">
        <button onClick={() => setActiveSubTab("sales")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${activeSubTab === "sales" ? "border border-blue-500/30 bg-blue-500/15 text-blue-300" : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
          <BarChart3 size={13} /> Sales Data
        </button>
        <button onClick={() => { setActiveSubTab("feedback"); if (feedbackOrders.length === 0) fetchFeedbackOrders(); }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${activeSubTab === "feedback" ? "border border-blue-500/30 bg-blue-500/15 text-blue-300" : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
          <Star size={13} /> Leave Feedback
        </button>
      </div>

      {activeSubTab === "sales" && (<>

      {/* Unmatched callout */}
      {unmatchedCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Link2 size={14} className="flex-shrink-0" />
          <span>
            <span className="font-semibold">{unmatchedCount} sale{unmatchedCount > 1 ? "s" : ""} not matched to inventory.</span>{" "}
            Use the dropdown on each row to manually link them — this will mark the matching inventory item as sold.
          </span>
        </div>
      )}

      {/* Sales table */}
      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Synced eBay Sales</p>
          <p className="text-xs text-slate-500">{sales.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/10 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Sale Price</th>
                <th className="px-4 py-3 font-medium">Sold Date</th>
                <th className="px-4 py-3 font-medium">Inventory Match</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    No sales synced yet. Press "Sync Now" to pull your eBay orders.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white max-w-[280px] truncate" title={sale.item_title}>
                      {sale.item_title}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.sale_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(sale.sold_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      {sale.matched_inventory_id ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          <Package size={10} />
                          {sale.auto_matched ? "Auto-matched" : "Matched"}
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedMatch[sale.id] ?? ""}
                            onChange={(e) => setSelectedMatch((prev) => ({ ...prev, [sale.id]: e.target.value }))}
                            className="rounded-xl border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none max-w-[180px]"
                          >
                            <option value="">Select inventory item...</option>
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.item_name} ({item.quantity_remaining} left)
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleManualMatch(sale)}
                            disabled={!selectedMatch[sale.id] || matching === sale.id}
                            className="flex items-center gap-1 rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            <Link2 size={11} />
                            {matching === sale.id ? "..." : "Match"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>)}

      {/* ── Feedback Tab ── */}
      {activeSubTab === "feedback" && (
        <div className="space-y-5">
          <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Leave Feedback for Buyers</h3>
                <p className="mt-1 text-xs text-slate-400">Fetch orders awaiting feedback and leave positive reviews for all buyers in one click.</p>
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
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400/30 placeholder:text-slate-600" />
              <p className="mt-1 text-xs text-slate-600">This message will be left for all selected buyers. Keep it positive and generic.</p>
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
                            const n = new Set(prev);
                            n.has(order.orderId) ? n.delete(order.orderId) : n.add(order.orderId);
                            return n;
                          })} className="text-slate-500 hover:text-white transition">
                            {selectedFeedback.has(order.orderId)
                              ? <CheckCircle size={15} className="text-blue-400" />
                              : <div className="h-4 w-4 rounded border border-white/20" />}
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
