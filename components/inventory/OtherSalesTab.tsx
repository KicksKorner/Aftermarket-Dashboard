"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Trash2, Loader2, TrendingUp, PoundSterling,
  ShoppingBag, BarChart3, Pencil, X, Check,
} from "lucide-react";

const supabase = createClient();

type OtherSale = {
  id: string;
  item_name: string;
  platform: string;
  quantity_sold: number;
  cost_of_goods: number;
  sold_price: number;
  fees: number;
  sold_date: string;
  notes: string | null;
};

const PLATFORM_OPTIONS = [
  "Car Boot",
  "Facebook Marketplace",
  "Cash / Local",
  "Depop",
  "Instagram",
  "TikTok Shop",
  "Etsy",
  "Gumtree",
  "Other",
];

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition";
const selectCls = "w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-2.5 text-sm text-white outline-none focus:border-blue-400/40 transition";

function profit(sale: OtherSale): number {
  return (
    Number(sale.sold_price) * Number(sale.quantity_sold) -
    Number(sale.cost_of_goods) * Number(sale.quantity_sold) -
    Number(sale.fees)
  );
}

function roi(sale: OtherSale): number | null {
  const cost = Number(sale.cost_of_goods) * Number(sale.quantity_sold);
  if (cost <= 0) return null;
  return (profit(sale) / cost) * 100;
}

type FormState = {
  item_name: string;
  platform: string;
  quantity_sold: string;
  cost_of_goods: string;
  sold_price: string;
  fees: string;
  sold_date: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  item_name: "",
  platform: "Car Boot",
  quantity_sold: "1",
  cost_of_goods: "",
  sold_price: "",
  fees: "0",
  sold_date: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function OtherSalesTab() {
  const [sales, setSales] = useState<OtherSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("other_sales")
      .select("*")
      .eq("user_id", user.id)
      .order("sold_date", { ascending: false });
    setSales((data || []) as OtherSale[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  function setField(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function setEditField(key: keyof FormState, value: string) {
    setEditForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleAddSale(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_name.trim() || !form.sold_price || !form.sold_date) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { error } = await supabase.from("other_sales").insert({
      user_id: user.id,
      item_name: form.item_name.trim(),
      platform: form.platform,
      quantity_sold: Number(form.quantity_sold) || 1,
      cost_of_goods: Number(form.cost_of_goods) || 0,
      sold_price: Number(form.sold_price),
      fees: Number(form.fees) || 0,
      sold_date: form.sold_date,
      notes: form.notes.trim() || null,
    });
    if (!error) {
      setForm(emptyForm());
      setShowForm(false);
      fetchSales();
    }
    setSaving(false);
  }

  async function handleSaveEdit(id: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("other_sales").update({
      item_name: editForm.item_name.trim(),
      platform: editForm.platform,
      quantity_sold: Number(editForm.quantity_sold) || 1,
      cost_of_goods: Number(editForm.cost_of_goods) || 0,
      sold_price: Number(editForm.sold_price),
      fees: Number(editForm.fees) || 0,
      sold_date: editForm.sold_date,
      notes: editForm.notes.trim() || null,
    }).eq("id", id).eq("user_id", user.id);
    setEditingId(null);
    fetchSales();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this sale?")) return;
    setDeleting(id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDeleting(null); return; }
    await supabase.from("other_sales").delete().eq("id", id).eq("user_id", user.id);
    fetchSales();
    setDeleting(null);
  }

  function startEdit(sale: OtherSale) {
    setEditingId(sale.id);
    setEditForm({
      item_name: sale.item_name,
      platform: sale.platform,
      quantity_sold: String(sale.quantity_sold),
      cost_of_goods: String(sale.cost_of_goods),
      sold_price: String(sale.sold_price),
      fees: String(sale.fees),
      sold_date: sale.sold_date,
      notes: sale.notes ?? "",
    });
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((s, x) => s + Number(x.sold_price) * Number(x.quantity_sold), 0);
  const totalProfit = sales.reduce((s, x) => s + profit(x), 0);
  const totalCOGS = sales.reduce((s, x) => s + Number(x.cost_of_goods) * Number(x.quantity_sold), 0);
  const avgROI = sales.length > 0
    ? sales.reduce((s, x) => {
        const r = roi(x);
        return r !== null ? s + r : s;
      }, 0) / sales.filter(x => Number(x.cost_of_goods) > 0).length || 0
    : 0;

  // Group by platform for breakdown
  const platformBreakdown = sales.reduce<Record<string, { revenue: number; profit: number; count: number }>>((acc, s) => {
    if (!acc[s.platform]) acc[s.platform] = { revenue: 0, profit: 0, count: 0 };
    acc[s.platform].revenue += Number(s.sold_price) * Number(s.quantity_sold);
    acc[s.platform].profit += profit(s);
    acc[s.platform].count += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
            <ShoppingBag size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Other Sales</p>
            <p className="text-xs text-slate-500">Car boots, Facebook Marketplace, cash sales & more</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setForm(emptyForm()); }}
          className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition">
          <Plus size={14} /> Add Sale
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300"><PoundSterling size={14} /></div>
          <p className="text-xl font-semibold text-white">£{totalRevenue.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-slate-500">Total Revenue</p>
        </div>
        <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><TrendingUp size={14} /></div>
          <p className={`text-xl font-semibold ${totalProfit >= 0 ? "text-white" : "text-red-400"}`}>£{totalProfit.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-slate-500">Total Profit</p>
        </div>
        <div className="rounded-[20px] border border-amber-500/15 bg-[#081120] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-300"><BarChart3 size={14} /></div>
          <p className="text-xl font-semibold text-white">£{totalCOGS.toFixed(2)}</p>
          <p className="mt-0.5 text-xs text-slate-500">Cost of Goods</p>
        </div>
        <div className="rounded-[20px] border border-cyan-500/15 bg-[#081120] p-4">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300"><TrendingUp size={14} /></div>
          <p className="text-xl font-semibold text-white">{isNaN(avgROI) || !isFinite(avgROI) ? "—" : `${avgROI.toFixed(1)}%`}</p>
          <p className="mt-0.5 text-xs text-slate-500">Avg ROI</p>
        </div>
      </div>

      {/* Platform breakdown */}
      {Object.keys(platformBreakdown).length > 1 && (
        <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">By Platform</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(platformBreakdown).map(([platform, data]) => (
              <div key={platform} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <p className="text-xs font-semibold text-white">{platform}</p>
                <p className="mt-1 text-xs text-slate-400">{data.count} sale{data.count !== 1 ? "s" : ""} · £{data.revenue.toFixed(2)} revenue · <span className={data.profit >= 0 ? "text-emerald-400" : "text-red-400"}>£{data.profit.toFixed(2)} profit</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-[20px] border border-orange-500/15 bg-[#081120] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Add Sale</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition"><X size={16} /></button>
          </div>
          <form onSubmit={handleAddSale}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Item Name *</label>
                <input value={form.item_name} onChange={e => setField("item_name", e.target.value)}
                  placeholder="e.g. Nike Air Max 95, Pokemon Cards Bundle..." className={inputCls} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Platform *</label>
                <select value={form.platform} onChange={e => setField("platform", e.target.value)} className={selectCls}>
                  {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Sold Date *</label>
                <input type="date" value={form.sold_date} onChange={e => setField("sold_date", e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Quantity Sold</label>
                <input type="number" min="1" value={form.quantity_sold} onChange={e => setField("quantity_sold", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Cost of Goods (£) — per unit</label>
                <input type="number" step="0.01" value={form.cost_of_goods} onChange={e => setField("cost_of_goods", e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Sold Price (£) — per unit *</label>
                <input type="number" step="0.01" value={form.sold_price} onChange={e => setField("sold_price", e.target.value)}
                  placeholder="0.00" className={inputCls} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Fees (£) — total</label>
                <input type="number" step="0.01" value={form.fees} onChange={e => setField("fees", e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              {/* Live profit preview */}
              {form.sold_price && (
                <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-xs text-slate-400">Profit preview</p>
                  <p className={`mt-1 text-lg font-semibold ${
                    (Number(form.sold_price) * (Number(form.quantity_sold) || 1)) - (Number(form.cost_of_goods) * (Number(form.quantity_sold) || 1)) - Number(form.fees) >= 0
                      ? "text-emerald-400" : "text-red-400"
                  }`}>
                    £{(
                      (Number(form.sold_price) * (Number(form.quantity_sold) || 1)) -
                      (Number(form.cost_of_goods) * (Number(form.quantity_sold) || 1)) -
                      Number(form.fees)
                    ).toFixed(2)}
                    {Number(form.cost_of_goods) > 0 && (
                      <span className="ml-2 text-sm text-slate-400">
                        ({(((Number(form.sold_price) - Number(form.cost_of_goods)) / Number(form.cost_of_goods)) * 100).toFixed(1)}% ROI)
                      </span>
                    )}
                  </p>
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
                <input value={form.notes} onChange={e => setField("notes", e.target.value)}
                  placeholder="Optional notes" className={inputCls} />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button type="submit" disabled={saving}
                className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-90 transition">
                {saving ? "Saving..." : "Save Sale"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/5 transition">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sales table */}
      <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
        <div className="border-b border-white/10 bg-white/5 px-5 py-3 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Sales Records</p>
          <p className="text-xs text-slate-500">{sales.length} records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-white/10 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Platform</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Cost / unit</th>
                <th className="px-4 py-3 font-medium">Sold / unit</th>
                <th className="px-4 py-3 font-medium">Fees</th>
                <th className="px-4 py-3 font-medium">Profit</th>
                <th className="px-4 py-3 font-medium">ROI</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading...
                </td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center">
                  <ShoppingBag size={28} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">No other sales yet.</p>
                  <p className="mt-1 text-xs text-slate-600">Click "Add Sale" to log a car boot, Facebook Marketplace, or cash sale.</p>
                </td></tr>
              ) : sales.map(sale => {
                const p = profit(sale);
                const r = roi(sale);
                const isEditing = editingId === sale.id;

                if (isEditing) {
                  return (
                    <tr key={sale.id} className="border-b border-white/5 bg-blue-500/[0.03]">
                      <td className="px-3 py-2">
                        <input value={editForm.item_name} onChange={e => setEditField("item_name", e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={editForm.platform} onChange={e => setEditField("platform", e.target.value)}
                          className="rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none">
                          {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={editForm.quantity_sold} onChange={e => setEditField("quantity_sold", e.target.value)}
                          className="w-16 rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" value={editForm.cost_of_goods} onChange={e => setEditField("cost_of_goods", e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" value={editForm.sold_price} onChange={e => setEditField("sold_price", e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" step="0.01" value={editForm.fees} onChange={e => setEditField("fees", e.target.value)}
                          className="w-20 rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-xs text-slate-500">auto-calculated</td>
                      <td className="px-3 py-2">
                        <input type="date" value={editForm.sold_date} onChange={e => setEditField("sold_date", e.target.value)}
                          className="rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editForm.notes} onChange={e => setEditField("notes", e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-[#0d1829] px-2 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5">
                          <button onClick={() => handleSaveEdit(sale.id)}
                            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-1.5 text-emerald-300 hover:bg-emerald-500/20 transition">
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:bg-white/10 transition">
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={sale.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white max-w-[200px] truncate" title={sale.item_name}>{sale.item_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300">
                        {sale.platform}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{sale.quantity_sold}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.cost_of_goods).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.sold_price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-300">£{Number(sale.fees).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${p >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        £{p.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r !== null
                        ? <span className={r >= 0 ? "text-emerald-300" : "text-red-300"}>{r.toFixed(1)}%</span>
                        : <span className="text-slate-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-300">{new Date(sale.sold_date).toLocaleDateString("en-GB")}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate text-xs">{sale.notes ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(sale)}
                          className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-1.5 text-blue-300 hover:bg-blue-500/20 transition">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => handleDelete(sale.id)} disabled={deleting === sale.id}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 transition disabled:opacity-40">
                          {deleting === sale.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
