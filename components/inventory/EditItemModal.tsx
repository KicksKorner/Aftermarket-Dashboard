"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InventoryItem } from "@/lib/inventory";

const supabase = createClient();

export default function EditItemModal({
  open,
  onClose,
  onSuccess,
  item,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item: InventoryItem | null;
}) {
  const [itemName, setItemName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setItemName(item.item_name || "");
      setBuyPrice(String(item.buy_price ?? ""));
      setQuantity(String(item.quantity ?? 1));
      setPurchaseDate(item.purchase_date || "");
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!item) return;

    if (!itemName.trim() || !buyPrice) {
      alert("Please fill in item name and buy price.");
      return;
    }

    const newQuantity = Number(quantity || 1);
    const alreadySold = Number(item.quantity_sold || 0);

    if (!Number.isInteger(newQuantity) || newQuantity < 1) {
      alert("Quantity must be at least 1.");
      return;
    }

    if (newQuantity < alreadySold) {
      alert(
        `Quantity cannot be less than quantity already sold (${alreadySold}).`
      );
      return;
    }

    const newQuantityRemaining = newQuantity - alreadySold;
    const newStatus = newQuantityRemaining === 0 ? "sold" : "in_stock";

    try {
      setLoading(true);

      const { error } = await supabase
        .from("inventory_items")
        .update({
          item_name: itemName.trim(),
          buy_price: Number(buyPrice),
          quantity: newQuantity,
          quantity_remaining: newQuantityRemaining,
          purchase_date: purchaseDate || null,
          status: newStatus,
        })
        .eq("id", item.id);

      if (error) {
        console.error("Edit item error:", error);
        alert("Failed to update item.");
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Unexpected edit error:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-lg rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Edit Item</h2>
            <p className="mt-1 text-sm text-slate-400">
              Update inventory details
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Item Name
            </label>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Buy Price (per unit)
            </label>
            <input
              type="number"
              step="0.01"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Quantity
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
            <p className="mt-2 text-xs text-slate-500">
              Already sold: {Number(item.quantity_sold || 0)} • Remaining:{" "}
              {Number(item.quantity_remaining || 0)}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Purchase Date
            </label>
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
              {loading ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-3 text-white transition hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}