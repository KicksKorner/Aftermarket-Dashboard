"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Plus, X, ExternalLink, CheckCircle2, Eye, ShoppingBag, Loader2 } from "lucide-react";

const supabase = createClient();

type Status = "watching" | "bought" | "skipped";

type SourcingItem = {
  id: string;
  item_name: string;
  asin: string | null;
  source_url: string | null;
  buy_price: number | null;
  sell_price: number | null;
  expected_profit: number | null;
  notes: string | null;
  status: Status;
  created_at: string;
};

const STATUS_CONFIG: Record<Status, { label: string; classes: string }> = {
  watching: { label: "Watching", classes: "border-blue-500/20 bg-blue-500/10 text-blue-400" },
  bought:   { label: "Bought",   classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  skipped:  { label: "Skipped",  classes: "border-slate-500/20 bg-slate-500/10 text-slate-500" },
};

export default function SourcingWidget() {
  const [items, setItems] = useState<SourcingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [asin, setAsin] = useState("");
  const [url, setUrl] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("sourcing_list")
      .select("*")
      .eq("user_id", user.id)
      .neq("status", "skipped")
      .order("created_at", { ascending: false })
      .limit(8);
    setItems((data || []) as SourcingItem[]);
    setLoading(false);
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const buy = parseFloat(buyPrice) || null;
    const sell = parseFloat(sellPrice) || null;
    const profit = buy && sell ? sell - buy : null;

    await supabase.from("sourcing_list").insert({
      user_id: user.id,
      item_name: name.trim(),
      asin: asin.trim() || null,
      source_url: url.trim() || null,
      buy_price: buy,
      sell_price: sell,
      expected_profit: profit,
      notes: notes.trim() || null,
      status: "watching",
    });

    setName(""); setAsin(""); setUrl(""); setBuyPrice(""); setSellPrice(""); setNotes("");
    setShowForm(false);
    setSaving(false);
    fetchItems();
  }

  async function updateStatus(id: string, status: Status) {
    await supabase.from("sourcing_list").update({ status }).eq("id", id);
    fetchItems();
  }

  async function deleteItem(id: string) {
    await supabase.from("sourcing_list").delete().eq("id", id);
    fetchItems();
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/30 transition";

  return (
    <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-blue-400" />
          <h3 className="text-base font-semibold text-white">Sourcing Watchlist</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{items.filter(i => i.status === "watching").length} watching</span>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 rounded-xl border border-blue-500/20 bg-blue-500/10 px-2.5 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 rounded-[18px] border border-white/10 bg-[#030814] p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Item name / product title *" className={inputCls} />
            </div>
            <input value={asin} onChange={e => setAsin(e.target.value)}
              placeholder="ASIN (optional)" className={inputCls} />
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="Source URL (optional)" className={inputCls} />
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-500 text-sm">£</span>
              <input type="number" step="0.01" value={buyPrice} onChange={e => setBuyPrice(e.target.value)}
                placeholder="Buy price" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <span className="text-slate-500 text-sm">£</span>
              <input type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                placeholder="Expected sell price" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
            </div>
            <div className="sm:col-span-2">
              <input value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optional)" className={inputCls} />
            </div>
          </div>
          {buyPrice && sellPrice && (
            <p className={`text-xs font-medium ${parseFloat(sellPrice) - parseFloat(buyPrice) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              Expected profit: £{(parseFloat(sellPrice) - parseFloat(buyPrice)).toFixed(2)}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {saving ? "Adding..." : "Add to Watchlist"}
            </button>
            <button onClick={() => setShowForm(false)}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 hover:text-white transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
          <Loader2 size={14} className="animate-spin mr-2" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ShoppingBag size={24} className="mb-2 text-slate-700" />
          <p className="text-sm text-slate-500">No items in your watchlist yet.</p>
          <p className="text-xs text-slate-600 mt-1">Click Add to start tracking products you're considering.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition
                ${item.status === "bought" ? "border-emerald-500/15 bg-emerald-500/5 opacity-75" : "border-white/5 bg-white/5"}`}>
              {/* Status dot */}
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${
                item.status === "watching" ? "bg-blue-400" :
                item.status === "bought" ? "bg-emerald-400" : "bg-slate-600"
              }`} />

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">{item.item_name}</p>
                  {item.asin && <span className="text-xs text-slate-600 font-mono flex-shrink-0">{item.asin}</span>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {item.buy_price && <span className="text-xs text-slate-500">Buy: £{item.buy_price.toFixed(2)}</span>}
                  {item.sell_price && <span className="text-xs text-slate-500">Sell: £{item.sell_price.toFixed(2)}</span>}
                  {item.expected_profit !== null && (
                    <span className={`text-xs font-medium ${item.expected_profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      +£{item.expected_profit.toFixed(2)}
                    </span>
                  )}
                  {item.notes && <span className="text-xs text-slate-600 truncate max-w-[120px]">{item.notes}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.source_url && (
                  <a href={item.source_url} target="_blank" rel="noreferrer"
                    className="rounded-lg p-1.5 text-slate-600 hover:text-blue-400 transition">
                    <ExternalLink size={12} />
                  </a>
                )}
                {item.status === "watching" && (
                  <button onClick={() => updateStatus(item.id, "bought")} title="Mark as bought"
                    className="rounded-lg p-1.5 text-slate-600 hover:text-emerald-400 transition">
                    <CheckCircle2 size={12} />
                  </button>
                )}
                {item.status === "bought" && (
                  <button onClick={() => updateStatus(item.id, "watching")} title="Move back to watching"
                    className="rounded-lg p-1.5 text-slate-600 hover:text-blue-400 transition">
                    <Eye size={12} />
                  </button>
                )}
                <button onClick={() => deleteItem(item.id)} title="Remove"
                  className="rounded-lg p-1.5 text-slate-600 hover:text-red-400 transition">
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
