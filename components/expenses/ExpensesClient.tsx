"use client";

import { useEffect, useMemo, useState } from "react";
import { Receipt, CalendarDays, PoundSterling, Tags, Lock, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AddExpenseModal from "@/components/expenses/AddExpenseModal";
import EditExpenseModal from "@/components/expenses/EditExpenseModal";
import {
  ExpenseItem,
  getExpenseStats,
  filterExpensesByMonth,
  filterExpensesByYear,
  getAvailableExpenseYears,
} from "@/lib/expenses";

const supabase = createClient();

const monthOptions = [
  { value: 1, label: "January" }, { value: 2, label: "February" },
  { value: 3, label: "March" }, { value: 4, label: "April" },
  { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" },
  { value: 9, label: "September" }, { value: 10, label: "October" },
  { value: 11, label: "November" }, { value: 12, label: "December" },
];

const PLATFORM_BADGE: Record<string, { label: string; classes: string }> = {
  ebay:   { label: "eBay",   classes: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
  vinted: { label: "Vinted", classes: "border-teal-500/20 bg-teal-500/10 text-teal-300" },
  all:    { label: "All",    classes: "border-slate-500/20 bg-slate-500/10 text-slate-400" },
};

function PlatformBadge({ platform }: { platform?: string }) {
  const p = platform ?? "all";
  const cfg = PLATFORM_BADGE[p] ?? PLATFORM_BADGE.all;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

function downloadMtdCsv(expenseItems: ExpenseItem[], fileName: string) {
  const headers = [
    "Transaction Date", "Description", "Category", "Platform",
    "Net Amount (£)", "VAT Rate (%)", "VAT Amount (£)", "Gross Amount (£)", "Notes",
  ];
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const rows = expenseItems.map((e) => {
    const gross = Number(e.amount);
    const vatRate = 20;
    const net = +(gross / 1.2).toFixed(2);
    const vat = +(gross - net).toFixed(2);
    return [
      escape(e.expense_date), escape(e.expense_name), escape(e.category),
      escape((e as any).platform ?? "all"),
      escape(net.toFixed(2)), escape(vatRate), escape(vat.toFixed(2)),
      escape(gross.toFixed(2)), escape(e.notes ?? ""),
    ].join(",");
  });
  const totalGross = expenseItems.reduce((s, e) => s + Number(e.amount), 0);
  const totalNet = +(totalGross / 1.2).toFixed(2);
  const totalVat = +(totalGross - totalNet).toFixed(2);
  const summaryRows = [
    "",
    `"MTD SUMMARY — Making Tax Digital (HMRC) Compliant Export"`,
    `"Generated","${new Date().toISOString()}"`,
    `"Total Expenses","${expenseItems.length}"`,
    `"Total Net (excl. VAT)","£${totalNet.toFixed(2)}"`,
    `"Total VAT (20%)","£${totalVat.toFixed(2)}"`,
    `"Total Gross (incl. VAT)","£${totalGross.toFixed(2)}"`,
    `"","Retain this record for a minimum of 6 years (HMRC MTD requirement)"`,
    `"","VAT assumed at 20% standard rate — adjust manually for exempt/zero-rated items"`,
  ];
  const csv = [headers.join(","), ...rows, ...summaryRows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type PlatformFilter = "all" | "ebay" | "vinted";

export default function ExpensesClient({ isPremium }: { isPremium: boolean }) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });
      if (!error) setExpenses((data || []) as ExpenseItem[]);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  const stats = useMemo(() => getExpenseStats(expenses), [expenses]);
  const availableYears = useMemo(() => getAvailableExpenseYears(expenses), [expenses]);

  // Platform-filtered expenses for display
  const filteredExpenses = useMemo(() => {
    if (platformFilter === "all") return expenses;
    return expenses.filter(e => (e as any).platform === platformFilter);
  }, [expenses, platformFilter]);

  // After-expenses stat for each platform (platform expenses + shared)
  const ebayExpensesTotal = useMemo(() =>
    expenses.filter(e => (e as any).platform === "ebay" || (e as any).platform === "all" || !(e as any).platform)
      .reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const vintedExpensesTotal = useMemo(() =>
    expenses.filter(e => (e as any).platform === "vinted" || (e as any).platform === "all" || !(e as any).platform)
      .reduce((s, e) => s + Number(e.amount), 0), [expenses]);

  const statCards = [
    { title: "This Month", value: `£${stats.monthlyTotal.toFixed(2)}`, icon: CalendarDays, iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
    { title: "This Year", value: `£${stats.yearlyTotal.toFixed(2)}`, icon: PoundSterling, iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
    { title: "Expenses", value: String(stats.expenseCount), icon: Receipt, iconClasses: "border-slate-500/20 bg-slate-500/10 text-slate-300" },
    { title: "Top Category", value: stats.topCategory, icon: Tags, iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300" },
  ];

  function handleOpenEditModal(expense: ExpenseItem) { setSelectedExpense(expense); setShowEditModal(true); }
  function handleCloseEditModal() { setSelectedExpense(null); setShowEditModal(false); }

  async function handleDeleteExpense(expense: ExpenseItem) {
    if (!window.confirm(`Delete "${expense.expense_name}" from expenses?`)) return;
    try {
      const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
      if (error) { alert("Failed to delete expense."); return; }
      fetchData();
    } catch { alert("Something went wrong."); }
  }

  function handleExportThisMonth() {
    if (!isPremium) return;
    const d = new Date();
    const filtered = filterExpensesByMonth(expenses, d.getFullYear(), d.getMonth() + 1);
    if (!filtered.length) { alert("No expenses found for this month."); return; }
    downloadMtdCsv(filtered, `mtd-expenses-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}.csv`);
  }

  function handleExportThisYear() {
    if (!isPremium) return;
    const year = new Date().getFullYear();
    const filtered = filterExpensesByYear(expenses, year);
    if (!filtered.length) { alert("No expenses found for this year."); return; }
    downloadMtdCsv(filtered, `mtd-expenses-${year}.csv`);
  }

  function handleExportSelectedMonth() {
    if (!isPremium) return;
    const filtered = filterExpensesByMonth(expenses, selectedYear, selectedMonth);
    if (!filtered.length) { alert("No expenses found for the selected month."); return; }
    downloadMtdCsv(filtered, `mtd-expenses-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`);
  }

  function handleExportSelectedYear() {
    if (!isPremium) return;
    const filtered = filterExpensesByYear(expenses, selectedYear);
    if (!filtered.length) { alert("No expenses found for the selected year."); return; }
    downloadMtdCsv(filtered, `mtd-expenses-${selectedYear}.csv`);
  }

  function LockedExportButton({ label }: { label: string }) {
    return (
      <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-600 opacity-60">
        <Lock size={12} />{label}
      </button>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {/* Header stats */}
        <section>
          <div className="mb-5 flex items-center gap-2">
            <span className="text-blue-400">💸</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
              <p className="mt-1 text-sm text-slate-400">Track business expenses and export them by month or year.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border ${stat.iconClasses}`}>
                    <Icon size={20} />
                  </div>
                  <div className="text-3xl font-semibold tracking-tight">{loading ? "..." : stat.value}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{stat.title}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* After Expenses cards */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">eBay</span>
              <span className="text-sm font-semibold text-white">After Expenses</span>
            </div>
            <p className="text-2xl font-semibold text-white">£{ebayExpensesTotal.toFixed(2)}</p>
            <p className="mt-1 text-xs text-slate-500">eBay-tagged + shared (All Platforms) expenses</p>
          </div>
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-300">Vinted</span>
              <span className="text-sm font-semibold text-white">After Expenses</span>
            </div>
            <p className="text-2xl font-semibold text-white">£{vintedExpensesTotal.toFixed(2)}</p>
            <p className="mt-1 text-xs text-slate-500">Vinted-tagged + shared (All Platforms) expenses</p>
          </div>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recent Expenses</h2>
                <p className="mt-1 text-sm text-slate-400">View, edit, manage and export your expense entries.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {isPremium ? (
                  <>
                    <button onClick={handleExportThisMonth}
                      className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
                      <FileSpreadsheet size={14} />MTD Export — This Month
                    </button>
                    <button onClick={handleExportThisYear}
                      className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
                      <FileSpreadsheet size={14} />MTD Export — This Year
                    </button>
                  </>
                ) : (
                  <>
                    <LockedExportButton label="MTD Export — This Month" />
                    <LockedExportButton label="MTD Export — This Year" />
                  </>
                )}
                <button onClick={() => setShowAddModal(true)}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90">
                  Add Expense
                </button>
              </div>
            </div>

            {/* MTD badge */}
            {isPremium ? (
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300">
                <FileSpreadsheet size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-semibold">Making Tax Digital (MTD) compliant exports</span>
                  <span className="text-emerald-300/70"> — exports include Date, Description, Category, Platform, Net Amount, VAT Rate, VAT Amount, and Gross Amount. Records must be retained for 6 years per HMRC requirements.</span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                <Lock size={15} className="mt-0.5 flex-shrink-0" />
                <span>
                  <span className="font-semibold">MTD-compliant CSV export is a Premium feature.</span>{" "}
                  You can still add and view expenses.{" "}
                  <a href="/upgrade" className="underline hover:text-amber-200">Upgrade to Premium to unlock exports →</a>
                </span>
              </div>
            )}

            {/* Platform filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">Filter by platform:</span>
              {(["all", "ebay", "vinted"] as PlatformFilter[]).map((p) => (
                <button key={p} onClick={() => setPlatformFilter(p)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition capitalize ${
                    platformFilter === p
                      ? p === "ebay" ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                        : p === "vinted" ? "border-teal-500/30 bg-teal-500/15 text-teal-300"
                        : "border-slate-500/30 bg-slate-500/15 text-slate-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}>
                  {p === "all" ? "All Platforms" : p === "ebay" ? "eBay only" : "Vinted only"}
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-600">{filteredExpenses.length} showing</span>
            </div>

            {/* Custom export */}
            <div className={`rounded-[20px] border p-4 ${isPremium ? "border-white/10 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-60"}`}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {!isPremium && <Lock size={12} className="text-slate-600" />}Custom Export
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">Export any older month or year in one click.</p>
                </div>
                {isPremium && (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">MTD Compliant</span>
                )}
              </div>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Month</label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} disabled={!isPremium}
                    className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-40">
                    {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-2 block text-sm font-medium text-slate-300">Year</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} disabled={!isPremium}
                    className="w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-40">
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {isPremium ? (
                  <>
                    <button onClick={handleExportSelectedMonth}
                      className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
                      <FileSpreadsheet size={14} />Export Selected Month
                    </button>
                    <button onClick={handleExportSelectedYear}
                      className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20">
                      <FileSpreadsheet size={14} />Export Selected Year
                    </button>
                  </>
                ) : (
                  <>
                    <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-slate-600 opacity-50">
                      <Lock size={12} />Export Selected Month
                    </button>
                    <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-sm text-slate-600 opacity-50">
                      <Lock size={12} />Export Selected Year
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                  <tr>
                    <th className="px-4 py-4 font-medium">Name</th>
                    <th className="px-4 py-4 font-medium">Platform</th>
                    <th className="px-4 py-4 font-medium">Category</th>
                    <th className="px-4 py-4 font-medium">Amount</th>
                    <th className="px-4 py-4 font-medium">Date</th>
                    <th className="px-4 py-4 font-medium">Notes</th>
                    <th className="px-4 py-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading expenses...</td></tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No expenses found.</td></tr>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="px-4 py-4 font-medium text-white">{expense.expense_name}</td>
                        <td className="px-4 py-4"><PlatformBadge platform={(expense as any).platform} /></td>
                        <td className="px-4 py-4 text-slate-300">{expense.category}</td>
                        <td className="px-4 py-4 text-slate-300">£{Number(expense.amount).toFixed(2)}</td>
                        <td className="px-4 py-4 text-slate-300">{expense.expense_date}</td>
                        <td className="px-4 py-4 text-slate-300">{expense.notes ?? "-"}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleOpenEditModal(expense)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium transition hover:bg-white/10">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteExpense(expense)}
                              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/20">
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

      <AddExpenseModal open={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} />
      <EditExpenseModal open={showEditModal} onClose={handleCloseEditModal} onSuccess={fetchData} expense={selectedExpense} />
    </>
  );
}
