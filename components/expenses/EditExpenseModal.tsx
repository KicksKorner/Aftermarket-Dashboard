"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExpenseItem } from "@/lib/expenses";

const supabase = createClient();

export default function EditExpenseModal({
  open,
  onClose,
  onSuccess,
  expense,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: ExpenseItem | null;
}) {
  const [expenseName, setExpenseName] = useState("");
  const [category, setCategory] = useState("Stock");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expense) return;

    setExpenseName(expense.expense_name);
    setCategory(expense.category);
    setAmount(String(expense.amount));
    setExpenseDate(expense.expense_date);
    setNotes(expense.notes ?? "");
  }, [expense]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!expense) return;

    if (!expenseName.trim() || !amount || !expenseDate) {
      alert("Please fill in expense name, amount and date.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("expenses")
        .update({
          expense_name: expenseName.trim(),
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          notes: notes.trim() || null,
        })
        .eq("id", expense.id);

      if (error) {
        console.error("Update error:", error);
        alert("Failed to update expense.");
        return;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Unexpected update error:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!open || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Expense</h2>
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