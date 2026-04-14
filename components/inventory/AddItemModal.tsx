"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Lock } from "lucide-react";

const supabase = createClient();

export default function AddItemModal({
  open,
  onClose,
  onSuccess,
  isPremium = false,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isPremium?: boolean;
}) {
  const [itemName, setItemName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [returnWindowDays, setReturnWindowDays] = useState("14");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!itemName.trim() || !buyPrice) {
      alert("Please fill in item name and buy price.");
      return;
    }

    const qty = Number(quantity || 1);
    if (qty < 1) {
      alert("Quantity must be at least 1.");
      return;
    }

    try {
      setLoading(true);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { alert("Could not get current user."); return; }

      const now = new Date();
      const windowDays = isPremium ? Number(returnWindowDays) : 14;
      const deadline = new Date(now);
      deadline.setDate(deadline.getDate() + windowDays);

      const { error } = await supabase.from("inventory_items").insert({
        user_id: user.id,
        item_name: itemName.trim(),
        buy_price: Number(buyPrice),
        purchase_date: purchaseDate || null,
        status: "in_stock",
        quantity: qty,
        quantity_sold: 0,
        quantity_remaining: qty,
        sold_price: null,
        fees: 0,
        shipping: 0,
        sold_date: null,
        return_window_days: windowDays,
        return_deadline: deadline.toISOString(),
      });

      if (error) { alert("Failed to add item."); return; }

      setItemName("");
      setBuyPrice("");
      setQuantity("1");
      setPurchaseDate("");
      setReturnWindowDays("14");
      onSuccess();
      onClose();
    } catch {
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Add Inventory Item</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Item Name</label>
            <input
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Buy Price</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Quantity</label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          {/* Return Window — Premium only */}
          {isPremium ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Return Window</label>
              <select
                value={returnWindowDays}
                onChange={(e) => setReturnWindowDays(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none"
              >
                <option value="14" className="bg-white text-black">14 Days</option>
                <option value="30" className="bg-white text-black">30 Days</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
                <Lock size={13} />
                Return Window
                <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                  Premium only
                </span>
              </label>
              <div className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-slate-600">
                <span>14 Days (default)</span>
                <Lock size={13} className="text-slate-700" />
              </div>
              <p className="mt-1.5 text-xs text-slate-600">
                <a href="/upgrade" className="text-amber-400/70 hover:text-amber-300">Upgrade to Premium</a> to set custom return windows.
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Item"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-white/10 py-3 text-white transition hover:bg-white/5">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
