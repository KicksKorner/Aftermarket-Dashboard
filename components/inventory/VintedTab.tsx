"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tag, Plus, Trash2 } from "lucide-react";

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
};

export default function VintedTab() {
  const [sales, setSales] = useState<VintedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [fees, setFees] = useState("0");
  const [soldDate, setSoldDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => { fetchSales(); }, []);

  async function fetchSales() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("vinted_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_date", { ascending: false });

    setSales((data || []) as VintedSale[]);
    setLoading(false);
  }

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !price || !soldDate) return;

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Try to match inventory
    const { data: inventoryItems } = await supabase
      .from("inventory_items")
      .select("id, item_name, quantity_remaining")
      .eq("user_id", user.id);

    let matchedId: string | null = null;
    const titleLower = title.toLowerCase();

    if (inventoryItems) {
      const match = inventoryItems.find((item) => {
        const name = (item.item_name || "").toLowerCase();
        return titleLower.includes(name) || name.includes(titleLower);
      });

      if (match && Number(match.quantity_remaining) > 0) {
        matchedId = match.id;
        const newRemaining = Math.max(0, Number(match.quantity_remaining) - Number(qty));

        await supabase.from("inventory_sales").insert({
          user_id: user.id,
          inventory_item_id: match.id,
          item_name: match.item_name,
          quantity_sold: Number(qty),
          sold_price: Number(price),
          fees: Number(fees),
          shipping: 0,
          sold_date: soldDate,
        });

        await supabase.from("inventory_items").update({
          quantity_remaining: newRemaining,
          status: newRemaining === 0 ? "sold" : "in_stock",
          sold_price: Number(price),
          sold_date: soldDate,
        }).eq("id", match.id);
      }
    }

    await supabase.from("vinted_sales").insert({
      user_id: user.id,
      item_title: title.trim(),
      quantity_sold: Number(qty),
      sale_price: Number(price),
      fees: Number(fees),
      sold_date: soldDate,
      notes: notes.trim() || null,
      matched_inventory_id: matchedId,
    });

    setTitle(""); setQty("1"); setPrice(""); setFees("0");
    setSoldDate(new Date().toISOString().split("T")[0]); setNotes("");
    setShowForm(false);
    setSaving(false);
    fetchSales();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this Vinted sale?")) return;
    await supabase.from("vinted_sales").delete().eq("id", id);
    fetchSales();
  }

  const totalProfit = sales.reduce((sum, s) => sum + Number(s.sale_price) - Number(s.fees), 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total sales", value: String(sales.length) },
          { label: "Total revenue", value: `£${sales.reduce((s, x) => s + Number(x.sale_price), 0).toFixed(2)}` },
          { label: "Net profit", value: `£${totalProfit.toFixed(2)}` },
        ].map((s) => (
          <div key={s.label} className="rounded-[20px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Add sale form */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">Manually log Vinted sales. Matching inventory items are automatically updated.</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
        >
          <Plus size={14} />
          Add Sale
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddSale} className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">New Vinted Sale</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Item Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Item name (must match inventory for auto-match)"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Sale Price (£)</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity</label>
              <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Vinted Fees (£)</label>
              <input type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Sold Date</label>
              <input type="date" value={soldDate} onChange={(e) => setSoldDate(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Sale Price</th>
                <th className="px-4 py-3 font-medium">Fees</th>
                <th className="px-4 py-3 font-medium">Sold Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading...</td></tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Tag size={28} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-sm font-medium text-slate-400">No Vinted sales yet.</p>
                    <p className="mt-1 text-xs text-slate-600">Click "Add Sale" to manually enter a sale.</p>
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{sale.item_title}</td>
                    <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                    <td className="px-4 py-3 text-emerald-300">£{Number(sale.sale_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.fees).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">{sale.sold_date}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(sale.id)}
                        className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20">
                        <Trash2 size={12} />
                      </button>
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
