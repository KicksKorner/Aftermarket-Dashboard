"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt, CalendarDays, PoundSterling, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AddExpenseModal from "@/components/expenses/AddExpenseModal";
import EditExpenseModal from "@/components/expenses/EditExpenseModal";
import {
  ExpenseItem,
  getExpenseStats,
  filterExpensesByMonth,
  filterExpensesByYear,
  downloadExpensesCsv,
  getAvailableExpenseYears,
} from "@/lib/expenses";

const supabase = createClient();

const monthOptions = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(
    null
  );

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  async function fetchData() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error("Error getting user:", userError);
        return;
      }

      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });

      if (error) {
        console.error("Error fetching expenses:", error);
        return;
      }

      setExpenses((data || []) as ExpenseItem[]);
    } catch (error) {
      console.error("Unexpected fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = useMemo(() => getExpenseStats(expenses), [expenses]);
  const availableYears = useMemo(
    () => getAvailableExpenseYears(expenses),
    [expenses]
  );

  const statCards = [
    {
      title: "This Month",
      value: `£${stats.monthlyTotal.toFixed(2)}`,
      icon: CalendarDays,
      iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    },
    {
      title: "This Year",
      value: `£${stats.yearlyTotal.toFixed(2)}`,
      icon: PoundSterling,
      iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },
    {
      title: "Expenses",
      value: String(stats.expenseCount),
      icon: Receipt,
      iconClasses: "border-slate-500/20 bg-slate-500/10 text-slate-300",
    },
    {
      title: "Top Category",
      value: stats.topCategory,
      icon: Tags,
      iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    },
  ];

  function handleOpenEditModal(expense: ExpenseItem) {
    setSelectedExpense(expense);
    setShowEditModal(true);
  }

  function handleCloseEditModal() {
    setSelectedExpense(null);
    setShowEditModal(false);
  }

  async function handleDeleteExpense(expense: ExpenseItem) {
    const confirmed = window.confirm(
      `Delete "${expense.expense_name}" from expenses?`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("expenses")
        .delete()
        .eq("id", expense.id);

      if (error) {
        console.error("Delete error:", error);
        alert("Failed to delete expense.");
        return;
      }

      fetchData();
    } catch (error) {
      console.error("Unexpected delete error:", error);
      alert("Something went wrong.");
    }
  }

  function handleExportThisMonth() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    const monthlyExpenses = filterExpensesByMonth(expenses, year, month);

    if (monthlyExpenses.length === 0) {
      alert("No expenses found for this month.");
      return;
    }

    const fileName = `expenses-${year}-${String(month).padStart(2, "0")}.csv`;
    downloadExpensesCsv(monthlyExpenses, fileName);
  }

  function handleExportThisYear() {
    const year = new Date().getFullYear();
    const yearlyExpenses = filterExpensesByYear(expenses, year);

    if (yearlyExpenses.length === 0) {
      alert("No expenses found for this year.");
      return;
    }

    const fileName = `expenses-${year}.csv`;
    downloadExpensesCsv(yearlyExpenses, fileName);
  }

  function handleExportSelectedMonth() {
    const monthlyExpenses = filterExpensesByMonth(
      expenses,
      selectedYear,
      selectedMonth
    );

    if (monthlyExpenses.length === 0) {
      alert("No expenses found for the selected month.");
      return;
    }

    const fileName = `expenses-${selectedYear}-${String(selectedMonth).padStart(
      2,
      "0"
    )}.csv`;

    downloadExpensesCsv(monthlyExpenses, fileName);
  }

  function handleExportSelectedYear() {
    const yearlyExpenses = filterExpensesByYear(expenses, selectedYear);

    if (yearlyExpenses.length === 0) {
      alert("No expenses found for the selected year.");
      return;
    }

    const fileName = `expenses-${selectedYear}.csv`;
    downloadExpensesCsv(yearlyExpenses, fileName);
  }

  return (
    <>
      <div className="space-y-8">
        <section>
          <div className="mb-5 flex items-center gap-2">
            <span className="text-blue-400">💸</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Expenses
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Track business expenses and export them by month or year.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  key={stat.title}
                  className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
                >
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border ${stat.iconClasses}`}
                  >
                    <Icon size={20} />
                  </div>

                  <div className="text-3xl font-semibold tracking-tight">
                    {loading ? "..." : stat.value}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {stat.title}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recent Expenses</h2>
                <p className="mt-1 text-sm text-slate-400">
                  View, edit, manage and export your expense entries.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleExportThisMonth}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Export This Month
                </button>

                <button
                  onClick={handleExportThisYear}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Export This Year
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Add Expense
                </button>
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Custom Export
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Export any older month or year in one click.
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Month
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none"
                  >
                    {monthOptions.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-300">
                    Year
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportSelectedMonth}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Export Selected Month
                </button>

                <button
                  onClick={handleExportSelectedYear}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Export Selected Year
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-4 font-medium">Name</th>
                    <th className="px-4 py-4 font-medium">Category</th>
                    <th className="px-4 py-4 font-medium">Amount</th>
                    <th className="px-4 py-4 font-medium">Date</th>
                    <th className="px-4 py-4 font-medium">Notes</th>
                    <th className="px-4 py-4 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        Loading expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-slate-400"
                      >
                        No expenses yet.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b border-white/5 transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-4 font-medium text-white">
                          {expense.expense_name}
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {expense.category}
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          £{Number(expense.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {expense.expense_date}
                        </td>
                        <td className="px-4 py-4 text-slate-300">
                          {expense.notes ?? "-"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleOpenEditModal(expense)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDeleteExpense(expense)}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <AddExpenseModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
      />

      <EditExpenseModal
        open={showEditModal}
        onClose={handleCloseEditModal}
        onSuccess={fetchData}
        expense={selectedExpense}
      />
    </>
  );
}