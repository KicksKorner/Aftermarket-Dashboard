"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ShoppingCart, RefreshCw, Unlink, CheckCircle, AlertCircle,
  Package, Link2, Plus, Eye, EyeOff, Save, Loader2,
} from "lucide-react";

const supabase = createClient();

type AmazonSale = {
  id: string;
  amazon_order_id: string;
  item_title: string;
  asin: string | null;
  quantity_sold: number;
  sale_price: number;
  amazon_fees: number;
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

export default function AmazonTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [sales, setSales] = useState<AmazonSale[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Record<string, string>>({});

  // Connect form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  const fetchSales = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("amazon_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_date", { ascending: false })
      .limit(100);
    setSales((data || []) as AmazonSale[]);
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
      .from("amazon_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    setStatus(data ? "connected" : "disconnected");
    if (data) { fetchSales(); fetchInventory(); }
  }, [fetchSales, fetchInventory]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  async function handleConnect() {
    if (!clientId.trim() || !clientSecret.trim() || !refreshToken.trim()) {
      setConnectError("All three fields are required.");
      return;
    }
    setConnecting(true);
    setConnectError("");
    try {
      const res = await fetch("/api/amazon/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          refreshToken: refreshToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConnectError(data.error || "Failed to connect. Please check your credentials.");
        return;
      }
      setShowConnectForm(false);
      setClientId(""); setClientSecret(""); setRefreshToken("");
      checkConnection();
    } catch {
      setConnectError("Something went wrong. Please try again.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/amazon/sync", { method: "POST" });
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
    if (!window.confirm("Disconnect your Amazon account? Your synced sales history will be kept.")) return;
    setDisconnecting(true);
    await fetch("/api/amazon/disconnect", { method: "POST" });
    setStatus("disconnected");
    setDisconnecting(false);
    setSales([]);
  }

  async function handleManualMatch(sale: AmazonSale) {
    const inventoryId = selectedMatch[sale.id];
    if (!inventoryId) return;
    setMatching(sale.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMatching(null); return; }

    const inventoryItem = inventoryItems.find(i => i.id === inventoryId);
    if (!inventoryItem) { setMatching(null); return; }

    const qty = Number(sale.quantity_sold) || 1;
    const newRemaining = Math.max(0, Number(inventoryItem.quantity_remaining) - qty);
    const soldDate = new Date(sale.sold_date).toISOString().split("T")[0];

    await supabase.from("inventory_sales").insert({
      user_id: user.id,
      inventory_item_id: inventoryItem.id,
      item_name: inventoryItem.item_name,
      quantity_sold: qty,
      sold_price: Number(sale.sale_price),
      fees: Number(sale.amazon_fees) || 0,
      shipping: 0,
      sold_date: soldDate,
    });

    await supabase.from("inventory_items").update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? "sold" : "in_stock",
      sold_price: Number(sale.sale_price),
      sold_date: soldDate,
    }).eq("id", inventoryItem.id);

    await supabase.from("amazon_sales").update({
      matched_inventory_id: inventoryId,
      auto_matched: false,
    }).eq("id", sale.id);

    setSelectedMatch(prev => { const next = { ...prev }; delete next[sale.id]; return next; });
    setSyncResult(`Matched "${sale.item_title}" → "${inventoryItem.item_name}" and marked as sold.`);
    fetchSales();
    fetchInventory();
    setMatching(null);
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Checking Amazon connection...
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="space-y-5">
        {!showConnectForm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
              <ShoppingCart size={28} />
            </div>
            <h3 className="text-xl font-semibold text-white">No Amazon Account Connected</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Connect your Amazon Seller account to sync your orders and automatically update your inventory.
            </p>
            <button
              onClick={() => setShowConnectForm(true)}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              <Plus size={16} /> Connect Amazon Account
            </button>
            <p className="mt-4 text-xs text-slate-600">
              Need help? Check the Amazon SP-API Setup guide in the Guides section.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-[24px] border border-orange-500/15 bg-[#071021] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Connect Amazon Seller Account</h3>
                <p className="mt-1 text-xs text-slate-500">Enter your SP-API credentials from Seller Central</p>
              </div>
              <button onClick={() => { setShowConnectForm(false); setConnectError(""); }}
                className="text-slate-500 hover:text-white transition text-lg">✕</button>
            </div>

            {/* Steps reminder */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-1.5 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-2">How to get your credentials:</p>
              <p>1. Go to <span className="text-orange-400">sellercentral.amazon.co.uk</span> → Apps & Services → Develop Apps</p>
              <p>2. Click <strong className="text-white">Add new app client</strong> — save to get Client ID & Secret</p>
              <p>3. Authorise your app to get the <strong className="text-white">Refresh Token</strong></p>
              <p className="mt-2 text-slate-600">Full step-by-step in the Amazon SP-API Setup guide →</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Client ID</label>
                <input
                  value={clientId}
                  onChange={e => setClientId(e.target.value)}
                  placeholder="amzn1.application-oa2-client.xxxxxxxx"
                  className="w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-400/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Client Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-400/40 transition"
                  />
                  <button onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Refresh Token</label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    value={refreshToken}
                    onChange={e => setRefreshToken(e.target.value)}
                    placeholder="Atzr|xxxxxxxxxxxxxxxx"
                    className="w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 pr-10 text-sm text-white placeholder-slate-600 outline-none focus:border-orange-400/40 transition"
                  />
                  <button onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-slate-600">Your credentials are encrypted and only visible to you.</p>
              </div>
            </div>

            {connectError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {connectError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleConnect} disabled={connecting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-400 transition disabled:opacity-50">
                {connecting ? <><Loader2 size={14} className="animate-spin" /> Connecting...</> : <><Save size={14} /> Save & Connect</>}
              </button>
              <button onClick={() => { setShowConnectForm(false); setConnectError(""); }}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white hover:bg-white/5 transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const unmatchedCount = sales.filter(s => !s.matched_inventory_id).length;

  return (
    <div className="space-y-5">
      {/* Connected header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-orange-500/15 bg-orange-500/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-orange-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Amazon Seller account connected</p>
            <p className="text-xs text-slate-400">Sync pulls your last 90 days of orders. Already synced orders are never duplicated.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">
            <Unlink size={14} /> Disconnect
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="flex items-center gap-2 rounded-2xl border border-orange-500/15 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
          <AlertCircle size={14} /> {syncResult}
        </div>
      )}

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
          <p className="text-sm font-medium text-white">Synced Amazon Orders</p>
          <p className="text-xs text-slate-500">{sales.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-white/10 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">ASIN</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Sale Price</th>
                <th className="px-4 py-3 font-medium">Amazon Fees</th>
                <th className="px-4 py-3 font-medium">Sold Date</th>
                <th className="px-4 py-3 font-medium">Inventory Match</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <Package size={28} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-sm font-medium text-slate-400">No orders synced yet.</p>
                    <p className="mt-1 text-xs text-slate-600">Press "Sync Now" to pull your Amazon orders.</p>
                  </td>
                </tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white max-w-[240px] truncate" title={sale.item_title}>
                      {sale.item_title}
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{sale.asin || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">£{Number(sale.sale_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-red-400 text-xs">-£{Number(sale.amazon_fees).toFixed(2)}</td>
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
                            onChange={e => setSelectedMatch(prev => ({ ...prev, [sale.id]: e.target.value }))}
                            className="rounded-xl border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none max-w-[180px]"
                          >
                            <option value="">Select inventory item...</option>
                            {inventoryItems.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.item_name} ({item.quantity_remaining} left)
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleManualMatch(sale)}
                            disabled={!selectedMatch[sale.id] || matching === sale.id}
                            className="flex items-center gap-1 rounded-xl border border-orange-500/20 bg-orange-500/10 px-2.5 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
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
    </div>
  );
}
