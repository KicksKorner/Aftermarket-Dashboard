"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Tag, Plus, Trash2, RefreshCw, Unlink, CheckCircle,
  AlertCircle, Eye, EyeOff, Save, Loader2, Link2, Package,
} from "lucide-react";

const supabase = createClient();

type VintedSale = {
  id: string;
  item_title: string;
  quantity_sold: number;
  sale_price: number;
  fees: number;
  sold_date: string;
  notes: string | null;
  auto_matched: boolean;
  matched_inventory_id: string | null;
  vinted_order_id: string | null;
};

type InventoryItem = {
  id: string;
  item_name: string;
  quantity_remaining: number;
};

type ConnectionStatus = "loading" | "connected" | "disconnected";

export default function VintedTab() {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [connectedUsername, setConnectedUsername] = useState<string>("");
  const [sales, setSales] = useState<VintedSale[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [matching, setMatching] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Connect form
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  // Manual add form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const fetchSales = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("vinted_sales").select("*").eq("user_id", user.id)
      .order("sold_date", { ascending: false });
    setSales((data || []) as VintedSale[]);
    setLoading(false);
  }, []);

  const fetchInventory = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("inventory_items").select("id, item_name, quantity_remaining")
      .eq("user_id", user.id).gt("quantity_remaining", 0)
      .order("item_name", { ascending: true });
    setInventoryItems((data || []) as InventoryItem[]);
  }, []);

  const checkConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("disconnected"); return; }
    const { data } = await supabase
      .from("vinted_connections").select("vinted_user_id")
      .eq("user_id", user.id).single();
    setStatus(data ? "connected" : "disconnected");
    if (data) { fetchSales(); fetchInventory(); }
    else setLoading(false);
  }, [fetchSales, fetchInventory]);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  async function handleConnect() {
    if (!accessToken.trim()) { setConnectError("Token is required."); return; }
    setConnecting(true); setConnectError("");
    try {
      const res = await fetch("/api/vinted/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: accessToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setConnectError(data.error || "Failed to connect."); return; }
      setConnectedUsername(data.username || "");
      setShowConnectForm(false);
      setAccessToken("");
      checkConnection();
    } catch { setConnectError("Something went wrong. Please try again."); }
    finally { setConnecting(false); }
  }

  async function handleSync() {
    setSyncing(true); setSyncResult(null);
    try {
      const res = await fetch("/api/vinted/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`✅ ${data.message}`);
        fetchSales(); fetchInventory();
      } else {
        setSyncResult(`❌ ${data.error || "Sync failed."}`);
      }
    } catch { setSyncResult("❌ Sync failed. Please try again."); }
    finally { setSyncing(false); }
  }

  async function handleDisconnect() {
    if (!window.confirm("Disconnect your Vinted account? Your synced sales history will be kept.")) return;
    setDisconnecting(true);
    await fetch("/api/vinted/disconnect", { method: "POST" });
    setStatus("disconnected");
    setDisconnecting(false);
  }

  async function handleManualMatch(sale: VintedSale) {
    const inventoryId = selectedMatch[sale.id];
    if (!inventoryId) return;
    setMatching(sale.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setMatching(null); return; }
    const invItem = inventoryItems.find(i => i.id === inventoryId);
    if (!invItem) { setMatching(null); return; }

    const newRemaining = Math.max(0, Number(invItem.quantity_remaining) - 1);
    const soldDateStr = new Date(sale.sold_date).toISOString().split("T")[0];

    await supabase.from("inventory_sales").insert({
      user_id: user.id, inventory_item_id: invItem.id, item_name: invItem.item_name,
      quantity_sold: 1, sold_price: Number(sale.sale_price),
      fees: Number(sale.fees), shipping: 0, sold_date: soldDateStr,
    });
    await supabase.from("inventory_items").update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? "sold" : "in_stock",
      sold_price: Number(sale.sale_price), sold_date: soldDateStr,
    }).eq("id", invItem.id);
    await supabase.from("vinted_sales").update({
      matched_inventory_id: inventoryId, auto_matched: false,
    }).eq("id", sale.id);

    setSelectedMatch(prev => { const n = {...prev}; delete n[sale.id]; return n; });
    setSyncResult(`✅ Matched "${sale.item_title}" → "${invItem.item_name}"`);
    fetchSales(); fetchInventory();
    setMatching(null);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase.from("vinted_sales").delete().eq("id", id);
    setDeleting(null);
    fetchSales();
  }

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !price || !soldDate) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    let matchedId: string | null = null;
    const titleLower = title.toLowerCase();
    const match = inventoryItems.find(item => {
      const name = (item.item_name || "").toLowerCase();
      return titleLower.includes(name) || name.includes(titleLower);
    });

    if (match && Number(match.quantity_remaining) > 0) {
      matchedId = match.id;
      const newRemaining = Math.max(0, Number(match.quantity_remaining) - Number(qty));
      await supabase.from("inventory_sales").insert({
        user_id: user.id, inventory_item_id: match.id, item_name: match.item_name,
        quantity_sold: Number(qty), sold_price: Number(price),
        fees: Number(fees), shipping: 0, sold_date: soldDate,
      });
      await supabase.from("inventory_items").update({
        quantity_remaining: newRemaining,
        status: newRemaining === 0 ? "sold" : "in_stock",
        sold_price: Number(price), sold_date: soldDate,
      }).eq("id", match.id);
    }

    await supabase.from("vinted_sales").insert({
      user_id: user.id, item_title: title.trim(),
      quantity_sold: Number(qty), sale_price: Number(price),
      fees: Number(fees), sold_date: soldDate,
      notes: notes.trim() || null, matched_inventory_id: matchedId,
    });

    setTitle(""); setQty("1"); setPrice(""); setFees("0");
    setSoldDate(new Date().toISOString().split("T")[0]); setNotes("");
    setShowForm(false); setSaving(false);
    fetchSales();
  }

  const totalProfit = sales.reduce((sum, s) => sum + Number(s.sale_price) - Number(s.fees), 0);
  const unmatchedCount = sales.filter(s => !s.matched_inventory_id).length;

  const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-violet-400/40 transition";

  // ── Disconnected state ─────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Checking Vinted connection...
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="space-y-5">
        {!showConnectForm ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
              <Tag size={28} />
            </div>
            <h3 className="text-xl font-semibold text-white">No Vinted Account Connected</h3>
            <p className="mt-2 max-w-sm text-sm text-slate-400">
              Connect your Vinted account using your browser token to automatically sync sold items.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowConnectForm(true)}
                className="flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition">
                <Tag size={16} /> Connect Vinted Account
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-600">
              See the AutoBuy Setup guide for how to find your browser token.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-[24px] border border-violet-500/15 bg-[#071021] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Connect Vinted Account</h3>
                <p className="mt-1 text-xs text-slate-500">Paste your Vinted browser access token</p>
              </div>
              <button onClick={() => { setShowConnectForm(false); setConnectError(""); }}
                className="text-slate-500 hover:text-white transition text-lg">✕</button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-1.5 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-2">How to get your token:</p>
              <p>1. Open <span className="text-violet-400">vinted.co.uk</span> in your browser and sign in</p>
              <p>2. Right-click → <strong className="text-white">Inspect</strong> → go to the <strong className="text-white">Application</strong> tab</p>
              <p>3. Expand <strong className="text-white">Cookies</strong> → click the Vinted domain</p>
              <p>4. Find <strong className="text-white">access_token</strong> and copy the value</p>
              <p className="mt-2 text-slate-600">Full guide in AutoBuy Setup → Getting your Vinted token</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Access Token</label>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={e => setAccessToken(e.target.value)}
                  placeholder="Paste your Vinted access token here"
                  className={`${inputCls} pr-10`}
                />
                <button onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">Your token is stored securely and only visible to you.</p>
            </div>

            {connectError && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {connectError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleConnect} disabled={connecting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50">
                {connecting ? <><Loader2 size={14} className="animate-spin" /> Connecting...</> : <><Save size={14} /> Save & Connect</>}
              </button>
              <button onClick={() => { setShowConnectForm(false); setConnectError(""); }}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm text-white hover:bg-white/5 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Still show manual sales table when disconnected */}
        {sales.length > 0 && <ManualSalesSection sales={sales} loading={loading} onDelete={handleDelete} deleting={deleting} />}
      </div>
    );
  }

  // ── Connected state ────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Sales", value: String(sales.length) },
          { label: "Total Revenue", value: `£${sales.reduce((s, x) => s + Number(x.sale_price), 0).toFixed(2)}` },
          { label: "Net Profit", value: `£${totalProfit.toFixed(2)}` },
        ].map(s => (
          <div key={s.label} className="rounded-[20px] border border-violet-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Connected header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-violet-500/15 bg-violet-500/[0.06] px-5 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle size={18} className="text-violet-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-white">Vinted account connected{connectedUsername ? ` — @${connectedUsername}` : ""}</p>
            <p className="text-xs text-slate-400">Sync pulls your sold items. Already synced orders are never duplicated.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition">
            <Plus size={14} /> Add Manual
          </button>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/20 transition disabled:opacity-50">
            <Unlink size={14} /> Disconnect
          </button>
        </div>
      </div>

      {syncResult && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm ${
          syncResult.startsWith("✅")
            ? "border-emerald-500/15 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/20 bg-red-500/10 text-red-300"
        }`}>
          <AlertCircle size={14} /> {syncResult}
        </div>
      )}

      {/* Unmatched callout */}
      {unmatchedCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          <Link2 size={14} className="flex-shrink-0" />
          <span>
            <span className="font-semibold">{unmatchedCount} sale{unmatchedCount > 1 ? "s" : ""} not matched to inventory.</span>{" "}
            Use the dropdown on each row to manually link them.
          </span>
        </div>
      )}

      {/* Manual add form */}
      {showForm && (
        <form onSubmit={handleAddSale} className="rounded-[20px] border border-violet-500/15 bg-[#081120] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Add Manual Sale</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Item Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Item name" className={inputCls} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Sale Price (£)</label>
              <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="0.00" className={inputCls} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Vinted Fees (£)</label>
              <input type="number" step="0.01" value={fees} onChange={e => setFees(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity</label>
              <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Sold Date</label>
              <input type="date" value={soldDate} onChange={e => setSoldDate(e.target.value)} className={inputCls} required />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">
              {saving ? "Saving..." : "Save Sale"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Sales table */}
      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Vinted Sales</p>
          <p className="text-xs text-slate-500">{sales.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/10 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Sale Price</th>
                <th className="px-4 py-3 font-medium">Fees</th>
                <th className="px-4 py-3 font-medium">Sold Date</th>
                <th className="px-4 py-3 font-medium">Inventory Match</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading...
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Tag size={28} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">No Vinted sales yet.</p>
                  <p className="mt-1 text-xs text-slate-600">Press "Sync Now" or add manually.</p>
                </td></tr>
              ) : sales.map(sale => (
                <tr key={sale.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-medium text-white max-w-[220px] truncate" title={sale.item_title}>
                    {sale.item_title}
                  </td>
                  <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">£{Number(sale.sale_price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-300">£{Number(sale.fees).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(sale.sold_date).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    {sale.matched_inventory_id ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                        <Package size={10} /> {sale.auto_matched ? "Auto-matched" : "Matched"}
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedMatch[sale.id] ?? ""}
                          onChange={e => setSelectedMatch(prev => ({ ...prev, [sale.id]: e.target.value }))}
                          className="rounded-xl border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none max-w-[160px]"
                        >
                          <option value="">Select item...</option>
                          {inventoryItems.map(item => (
                            <option key={item.id} value={item.id}>
                              {item.item_name} ({item.quantity_remaining} left)
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleManualMatch(sale)}
                          disabled={!selectedMatch[sale.id] || matching === sale.id}
                          className="flex items-center gap-1 rounded-xl border border-violet-500/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:opacity-40 transition"
                        >
                          <Link2 size={11} />
                          {matching === sale.id ? "..." : "Match"}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(sale.id)} disabled={deleting === sale.id}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition disabled:opacity-40">
                      {deleting === sale.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Simple sales table for disconnected state ──────────────────────────────
function ManualSalesSection({ sales, loading, onDelete, deleting }: {
  sales: VintedSale[]; loading: boolean;
  onDelete: (id: string) => void; deleting: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
      <div className="border-b border-white/10 bg-white/5 px-5 py-3">
        <p className="text-sm font-medium text-white">Manually Logged Sales</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="border-b border-white/10 text-left text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Sale Price</th>
              <th className="px-4 py-3 font-medium">Fees</th>
              <th className="px-4 py-3 font-medium">Sold Date</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading...</td></tr>
            ) : sales.map(s => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white font-medium">{s.item_title}</td>
                <td className="px-4 py-3 text-emerald-400">£{Number(s.sale_price).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-300">£{Number(s.fees).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-300">{s.sold_date}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onDelete(s.id)} disabled={deleting === s.id}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition">
                    {deleting === s.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
