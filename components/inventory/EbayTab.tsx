"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, RefreshCw, Unlink, CheckCircle, AlertCircle, Package, Link2, Plus, Trash2 } from "lucide-react";

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

type EbayListing = {
  ebayItemId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  alreadyInInventory: boolean;
};

export default function EbayTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [sales, setSales] = useState<EbaySale[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Record<string, string>>({});
  const [showListingsPanel, setShowListingsPanel] = useState(false);
  const [listings, setListings] = useState<EbayListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [listingsMsg, setListingsMsg] = useState<string | null>(null);

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
    await supabase.from("ebay_sales")
      .delete()
      .eq("user_id", user.id)
      .is("matched_inventory_id", null);
    setDeletingAll(false);
    fetchSales();
    setSyncResult("All unmatched sales deleted.");
  }

  async function fetchListings() {
    setLoadingListings(true);
    setListingsMsg(null);
    setListings([]);
    setShowListingsPanel(true); // Always open the panel so errors are visible
    try {
      const res = await fetch("/api/ebay/sync-listings");
      const data = await res.json();
      if (res.ok) {
        setListings(data.listings || []);
        if ((data.listings || []).length === 0) {
          setListingsMsg("No active listings found on your eBay account.");
        }
      } else {
        setListingsMsg(data.error || "Failed to fetch listings.");
      }
    } catch (err: any) {
      setListingsMsg(`Error: ${err?.message || "Failed to fetch listings. Please try again."}`);
    } finally {
      setLoadingListings(false);
    }
  }

  async function addListingToInventory(listing: EbayListing) {
    setAddingItem(listing.ebayItemId);
    try {
      const res = await fetch("/api/ebay/sync-listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ebayItemId: listing.ebayItemId,
          title: listing.title,
          price: listing.price,
          quantity: listing.quantity,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Mark as added in the list
        setListings(prev => prev.map(l =>
          l.ebayItemId === listing.ebayItemId ? { ...l, alreadyInInventory: true } : l
        ));
        setListingsMsg(`✅ "${listing.title}" added to inventory. Remember to set the buy price via Edit.`);
        fetchInventory();
      } else {
        setListingsMsg(data.error || "Failed to add item.");
      }
    } catch {
      setListingsMsg("Something went wrong.");
    } finally {
      setAddingItem(null);
    }
  }

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
        {/* Listings import panel */}
      {showListingsPanel && (
        <div className="rounded-[20px] border border-emerald-500/15 bg-[#071021] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">Your Active eBay Listings</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {listings.filter(l => !l.alreadyInInventory).length} new •{" "}
                {listings.filter(l => l.alreadyInInventory).length} already in inventory
              </p>
            </div>
            <button onClick={() => { setShowListingsPanel(false); setListingsMsg(null); }}
              className="text-slate-500 hover:text-white transition text-lg leading-none">✕</button>
          </div>

          {listingsMsg && (
            <div className={`mx-5 mt-4 rounded-xl border px-4 py-2.5 text-sm ${
              listingsMsg.startsWith("✅")
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}>
              {listingsMsg}
            </div>
          )}

          <div className="divide-y divide-white/5">
            {loadingListings ? (
              <div className="flex items-center justify-center gap-3 px-5 py-10 text-sm text-slate-400">
                <RefreshCw size={16} className="animate-spin" />
                Fetching your active eBay listings...
              </div>
            ) : listings.length === 0 && !listingsMsg ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No active listings found on your eBay account.</p>
            ) : listings.length === 0 ? null : (
              listings.map(listing => (
                <div key={listing.ebayItemId} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] ${listing.alreadyInInventory ? "opacity-50" : ""}`}>
                  {/* Thumbnail */}
                  {listing.imageUrl ? (
                    <img src={listing.imageUrl} alt={listing.title}
                      className="h-14 w-14 flex-shrink-0 rounded-xl object-contain border border-white/10 bg-black/20 p-1" />
                  ) : (
                    <div className="h-14 w-14 flex-shrink-0 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                      <Package size={20} className="text-slate-600" />
                    </div>
                  )}
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{listing.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="text-emerald-400 font-semibold">£{Number(listing.price).toFixed(2)}</span>
                      <span>Qty: {listing.quantity}</span>
                      <span className="font-mono text-slate-600">#{listing.ebayItemId}</span>
                    </div>
                  </div>
                  {/* Action */}
                  {listing.alreadyInInventory ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 flex-shrink-0">
                      <CheckCircle size={11} /> In Inventory
                    </span>
                  ) : (
                    <button
                      onClick={() => addListingToInventory(listing)}
                      disabled={addingItem === listing.ebayItemId}
                      className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition flex-shrink-0">
                      {addingItem === listing.ebayItemId ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <Plus size={11} />
                      )}
                      {addingItem === listing.ebayItemId ? "Adding..." : "Add to Inventory"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

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
            {syncing ? "Syncing..." : "Sync Sales"}
          </button>
          <button onClick={fetchListings} disabled={loadingListings}
            className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50">
            <Package size={14} className={loadingListings ? "animate-spin" : ""} />
            {loadingListings ? "Loading..." : "Import Listings"}
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:opacity-50">
            <Unlink size={14} />Disconnect
          </button>
        </div>
      </div>

      {/* Listings import panel */}
      {showListingsPanel && (
        <div className="rounded-[20px] border border-emerald-500/15 bg-[#071021] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-white">Your Active eBay Listings</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {listings.filter(l => !l.alreadyInInventory).length} new •{" "}
                {listings.filter(l => l.alreadyInInventory).length} already in inventory
              </p>
            </div>
            <button onClick={() => { setShowListingsPanel(false); setListingsMsg(null); }}
              className="text-slate-500 hover:text-white transition text-lg leading-none">✕</button>
          </div>

          {listingsMsg && (
            <div className={`mx-5 mt-4 rounded-xl border px-4 py-2.5 text-sm ${
              listingsMsg.startsWith("✅")
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}>
              {listingsMsg}
            </div>
          )}

          <div className="divide-y divide-white/5">
            {loadingListings ? (
              <div className="flex items-center justify-center gap-3 px-5 py-10 text-sm text-slate-400">
                <RefreshCw size={16} className="animate-spin" />
                Fetching your active eBay listings...
              </div>
            ) : listings.length === 0 && !listingsMsg ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No active listings found on your eBay account.</p>
            ) : listings.length === 0 ? null : (
              listings.map(listing => (
                <div key={listing.ebayItemId} className={`flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02] ${listing.alreadyInInventory ? "opacity-50" : ""}`}>
                  {/* Thumbnail */}
                  {listing.imageUrl ? (
                    <img src={listing.imageUrl} alt={listing.title}
                      className="h-14 w-14 flex-shrink-0 rounded-xl object-contain border border-white/10 bg-black/20 p-1" />
                  ) : (
                    <div className="h-14 w-14 flex-shrink-0 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                      <Package size={20} className="text-slate-600" />
                    </div>
                  )}
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{listing.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span className="text-emerald-400 font-semibold">£{Number(listing.price).toFixed(2)}</span>
                      <span>Qty: {listing.quantity}</span>
                      <span className="font-mono text-slate-600">#{listing.ebayItemId}</span>
                    </div>
                  </div>
                  {/* Action */}
                  {listing.alreadyInInventory ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 flex-shrink-0">
                      <CheckCircle size={11} /> In Inventory
                    </span>
                  ) : (
                    <button
                      onClick={() => addListingToInventory(listing)}
                      disabled={addingItem === listing.ebayItemId}
                      className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 transition flex-shrink-0">
                      {addingItem === listing.ebayItemId ? (
                        <RefreshCw size={11} className="animate-spin" />
                      ) : (
                        <Plus size={11} />
                      )}
                      {addingItem === listing.ebayItemId ? "Adding..." : "Add to Inventory"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {syncResult && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          <AlertCircle size={14} />
          {syncResult}
        </div>
      )}

      {/* Unmatched callout */}
      {unmatchedCount > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <div className="flex items-center gap-3">
            <Link2 size={14} className="flex-shrink-0" />
            <span>
              <span className="font-semibold">{unmatchedCount} sale{unmatchedCount > 1 ? "s" : ""} not matched to inventory.</span>{" "}
              Match or delete personal sales you don&apos;t want tracked.
            </span>
          </div>
          <button
            onClick={handleDeleteAllUnmatched}
            disabled={deletingAll}
            className="flex items-center gap-1.5 flex-shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
          >
            <Trash2 size={11} />
            {deletingAll ? "Deleting..." : "Delete all unmatched"}
          </button>
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
                          <button
                            onClick={() => handleDeleteSale(sale.id)}
                            disabled={deleting === sale.id}
                            title="Delete this sale"
                            className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition"
                          >
                            {deleting === sale.id ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
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
