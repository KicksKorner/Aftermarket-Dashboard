"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, RefreshCw, Unlink, CheckCircle, AlertCircle, Package } from "lucide-react";

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

type ConnectionStatus = "loading" | "connected" | "disconnected";

export default function EbayTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [sales, setSales] = useState<EbaySale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkConnection();

    // Handle redirect back from eBay OAuth
    const params = new URLSearchParams(window.location.search);
    if (params.get("ebay") === "connected") {
      setSyncResult("eBay account connected successfully.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("ebay") === "error") {
      setSyncResult("Failed to connect eBay. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function checkConnection() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("disconnected"); return; }

    const { data } = await supabase
      .from("ebay_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    setStatus(data ? "connected" : "disconnected");
    if (data) fetchSales();
  }

  async function fetchSales() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("ebay_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_date", { ascending: false })
      .limit(50);

    setSales((data || []) as EbaySale[]);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ebay/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`Synced ${data.synced} order(s). ${data.matched} matched to inventory.`);
        fetchSales();
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
        <a
          href="/api/ebay/connect"
          className="mt-6 flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          <ShoppingCart size={16} />
          Connect eBay Account
        </a>
        <p className="mt-4 text-xs text-slate-600">
          By connecting your eBay account, you agree to our{" "}
          <span className="text-blue-400 underline cursor-pointer">Terms of Service</span> and{" "}
          <span className="text-blue-400 underline cursor-pointer">Privacy Policy</span>,
          including the collection and processing of your eBay sales data.
        </p>

        {syncResult && (
          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-300">
            {syncResult}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Connected header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">eBay account connected</p>
            <p className="text-xs text-slate-400">Sales sync automatically when you press Sync. Matched items update your inventory.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            <Unlink size={14} />
            Disconnect
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <AlertCircle size={14} />
          {syncResult}
        </div>
      )}

      {/* Sales table */}
      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Synced eBay Sales</p>
          <p className="text-xs text-slate-500">{sales.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
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
                    <td className="px-4 py-3 font-medium text-white max-w-[280px] truncate">{sale.item_title}</td>
                    <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.sale_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {new Date(sale.sold_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      {sale.auto_matched ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                          <Package size={10} />
                          Auto-matched
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">Not matched</span>
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
