"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { InventoryItem } from "@/lib/inventory";

const supabase = createClient();

export default function MarkSoldModal({
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
  const [quantityToSell, setQuantityToSell] = useState("1");
  const [soldPrice, setSoldPrice] = useState("");
  const [fees, setFees] = useState("0.00");
  const [shipping, setShipping] = useState("0.00");
  const [soldDate, setSoldDate] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) {
      setQuantityToSell("1");
      setSoldPrice("");
      setFees("0.00");
      setShipping("0.00");
      setSoldDate(new Date().toISOString().split("T")[0]);
    }
  }, [open, item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!item) return;

    const qty = Number(quantityToSell || 1);
    const pricePerUnit = Number(soldPrice || 0);
    const feesValue = Number(fees || 0);
    const shippingValue = Number(shipping || 0);

    if (!soldPrice || !soldDate) {
      alert("Please enter sold price and sold date.");
      return;
    }

    if (!Number.isInteger(qty) || qty < 1) {
      alert("Quantity sold must be at least 1.");
      return;
    }

    if (qty > Number(item.quantity_remaining)) {
      alert("Quantity sold cannot be greater than stock remaining.");
      return;
    }

    if (pricePerUnit < 0 || feesValue < 0 || shippingValue < 0) {
      alert("Values cannot be negative.");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error getting user:", userError);
        alert("Could not get current user.");
        return;
      }

      if (!user) {
        alert("No authenticated user found.");
        return;
      }

      const { error: saleInsertError } = await supabase
        .from("inventory_sales")
        .insert({
          user_id: user.id,
          inventory_item_id: item.id,
          item_name: item.item_name,
          quantity_sold: qty,
          sold_price: pricePerUnit,
          fees: feesValue,
          shipping: shippingValue,
          sold_date: soldDate,
        });

      if (saleInsertError) {
        console.error("Sale insert error:", saleInsertError);
        alert("Failed to log sale.");
        return;
      }

      const newQuantitySold = Number(item.quantity_sold || 0) + qty;
      const newQuantityRemaining = Number(item.quantity_remaining || 0) - qty;
      const soldOut = newQuantityRemaining === 0;

      const { error: inventoryUpdateError } = await supabase
        .from("inventory_items")
        .update({
          quantity_sold: newQuantitySold,
          quantity_remaining: newQuantityRemaining,
          status: soldOut ? "sold" : "in_stock",
          sold_price: pricePerUnit,
          fees: feesValue,
          shipping: shippingValue,
          sold_date: soldDate,
        })
        .eq("id", item.id);

      if (inventoryUpdateError) {
        console.error("Inventory update error:", inventoryUpdateError);
        alert("Failed to update inventory.");
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Unexpected mark sold error:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Mark as Sold</h2>
            <p className="mt-1 text-sm text-slate-400">{item.item_name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Stock remaining: {Number(item.quantity_remaining || 0)}
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
              Quantity Sold
            </label>
            <input
              type="number"
              min="1"
              max={Number(item.quantity_remaining || 0)}
              step="1"
              value={quantityToSell}
              onChange={(e) => setQuantityToSell(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Sold Price (per unit)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={soldPrice}
              onChange={(e) => setSoldPrice(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Fees
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={fees}
              onChange={(e) => setFees(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Shipping
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Sold Date
            </label>
            <input
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Sale"}
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