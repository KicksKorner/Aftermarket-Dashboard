"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export default function AddExpenseModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [expenseName, setExpenseName] = useState("");
  const [category, setCategory] = useState("Stock");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!expenseName.trim() || !amount || !expenseDate) {
      alert("Please fill in expense name, amount and date.");
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

      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        expense_name: expenseName.trim(),
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        notes: notes.trim() || null,
      });

      if (error) {
        console.error("Insert error:", error);
        alert("Failed to add expense.");
        return;
      }

      setExpenseName("");
      setCategory("Stock");
      setAmount("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setNotes("");

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Unexpected insert error:", error);
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
          <h2 className="text-xl font-semibold">Add Expense</h2>
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
              Expense Name
            </label>
            <input
              value={expenseName}
              onChange={(e) => setExpenseName(e.target.value)}
              placeholder="Expense name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none"
            >
              <option value="Stock">Stock</option>
              <option value="Shipping">Shipping</option>
              <option value="Packaging">Packaging</option>
              <option value="Ads">Ads</option>
              <option value="Software">Software</option>
              <option value="Fees">Fees</option>
              <option value="Travel">Travel</option>
              <option value="Misc">Misc</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Expense Date
            </label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Expense"}
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