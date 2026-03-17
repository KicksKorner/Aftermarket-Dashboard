"use client";

import { useMemo, useState } from "react";
import { calculateSaleProfit, InventorySale } from "@/lib/inventory";

type ExportType = "monthly" | "yearly";

type SaleForExport = InventorySale & {
  buy_price_per_unit: number;
};

const MONTHS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

function escapeCsvValue(value: string | number | null) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export default function ExportCsvModal({
  open,
  onClose,
  sales,
}: {
  open: boolean;
  onClose: () => void;
  sales: SaleForExport[];
}) {
  const currentYear = new Date().getFullYear();

  const [exportType, setExportType] = useState<ExportType>("monthly");
  const [month, setMonth] = useState(String(new Date().getMonth()));
  const [year, setYear] = useState(String(currentYear));

  const availableYears = useMemo(() => {
    const years = new Set<number>();

    sales.forEach((sale) => {
      if (!sale.sold_date) return;
      const d = new Date(sale.sold_date);
      if (!Number.isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });

    years.add(currentYear);

    return Array.from(years).sort((a, b) => b - a);
  }, [sales, currentYear]);

  function handleDownload() {
    const filteredSales = sales.filter((sale) => {
      if (!sale.sold_date) return false;

      const soldDate = new Date(sale.sold_date);
      if (Number.isNaN(soldDate.getTime())) return false;

      const soldYear = soldDate.getFullYear();
      const soldMonth = soldDate.getMonth();

      if (exportType === "yearly") {
        return soldYear === Number(year);
      }

      return soldYear === Number(year) && soldMonth === Number(month);
    });

    if (filteredSales.length === 0) {
      alert("No sales found for that period.");
      return;
    }

    const headers = [
      "Item Name",
      "Quantity Sold",
      "Buy Price Per Unit",
      "Sold Price Per Unit",
      "Gross Revenue",
      "Fees",
      "Shipping",
      "Profit",
      "Sold Date",
    ];

    const rows = filteredSales.map((sale) => {
      const grossRevenue = Number(sale.quantity_sold) * Number(sale.sold_price);
      const profit = calculateSaleProfit(sale);

      return [
        escapeCsvValue(sale.item_name),
        escapeCsvValue(sale.quantity_sold),
        escapeCsvValue(Number(sale.buy_price_per_unit).toFixed(2)),
        escapeCsvValue(Number(sale.sold_price).toFixed(2)),
        escapeCsvValue(grossRevenue.toFixed(2)),
        escapeCsvValue(Number(sale.fees).toFixed(2)),
        escapeCsvValue(Number(sale.shipping).toFixed(2)),
        escapeCsvValue(profit.toFixed(2)),
        escapeCsvValue(sale.sold_date),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    const filename =
      exportType === "yearly"
        ? `sales-year-${year}.csv`
        : `sales-${MONTHS[Number(month)].label.toLowerCase()}-${year}.csv`;

    downloadCsv(filename, csvContent);
    onClose();
  }

  if (!open) return null;

  const selectClassName =
    "w-full rounded-xl border border-white/10 bg-[#182235] px-4 py-3 text-white outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Export CSV</h2>
            <p className="mt-1 text-sm text-slate-400">
              Export sales by month or year
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Export Type
            </label>
            <select
              value={exportType}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className={selectClassName}
            >
              <option value="monthly" className="bg-white text-black">
                Monthly Export
              </option>
              <option value="yearly" className="bg-white text-black">
                Yearly Export
              </option>
            </select>
          </div>

          {exportType === "monthly" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={selectClassName}
              >
                {MONTHS.map((m) => (
                  <option
                    key={m.value}
                    value={m.value}
                    className="bg-white text-black"
                  >
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={selectClassName}
            >
              {availableYears.map((y) => (
                <option
                  key={y}
                  value={String(y)}
                  className="bg-white text-black"
                >
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-black transition hover:opacity-90"
            >
              Download CSV
            </button>

            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-3 text-white transition hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}