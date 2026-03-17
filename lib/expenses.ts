export type ExpenseItem = {
  id: string;
  user_id: string;
  expense_name: string;
  category: string;
  amount: number;
  expense_date: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export function getExpenseStats(expenses: ExpenseItem[]) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let monthlyTotal = 0;
  let yearlyTotal = 0;

  const categoryMap = new Map<string, number>();

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    const date = new Date(expense.expense_date);

    if (Number.isNaN(date.getTime())) return;

    if (date.getFullYear() === currentYear) {
      yearlyTotal += amount;

      if (date.getMonth() === currentMonth) {
        monthlyTotal += amount;
      }
    }

    categoryMap.set(
      expense.category,
      (categoryMap.get(expense.category) || 0) + amount
    );
  });

  const topCategory =
    Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  return {
    monthlyTotal,
    yearlyTotal,
    expenseCount: expenses.length,
    topCategory,
  };
}

export function filterExpensesByMonth(
  expenses: ExpenseItem[],
  year: number,
  month: number
) {
  return expenses.filter((expense) => {
    const date = new Date(expense.expense_date);
    if (Number.isNaN(date.getTime())) return false;

    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });
}

export function filterExpensesByYear(expenses: ExpenseItem[], year: number) {
  return expenses.filter((expense) => {
    const date = new Date(expense.expense_date);
    if (Number.isNaN(date.getTime())) return false;

    return date.getFullYear() === year;
  });
}

function escapeCsvValue(value: string | number | null | undefined) {
  if (value == null) return "";
  const stringValue = String(value);

  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function downloadExpensesCsv(
  expenses: ExpenseItem[],
  fileName: string
) {
  const headers = ["Date", "Expense Name", "Category", "Amount", "Notes"];

  const rows = expenses.map((expense) => [
    expense.expense_date,
    expense.expense_name,
    expense.category,
    Number(expense.amount).toFixed(2),
    expense.notes ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function getAvailableExpenseYears(expenses: ExpenseItem[]) {
  const years = Array.from(
    new Set(
      expenses
        .map((expense) => {
          const date = new Date(expense.expense_date);
          if (Number.isNaN(date.getTime())) return null;
          return date.getFullYear();
        })
        .filter((year): year is number => year !== null)
    )
  ).sort((a, b) => b - a);

  const currentYear = new Date().getFullYear();

  if (!years.includes(currentYear)) {
    years.unshift(currentYear);
  }

  return years;
}