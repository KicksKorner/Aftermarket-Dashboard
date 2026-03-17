"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

type ParsedRow = {
  item_name: string;
  buy_price: number;
  quantity: number;
  return_window_days: 14 | 30;
  purchase_date: string | null;
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normalisePurchaseDate(value: string) {
  if (!value) return null;

  const trimmed = value.trim();

  // Supports YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  // Supports DD/MM/YYYY
  const ukMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const date = new Date(`${year}-${month}-${day}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  return null;
}

export default function BulkImportModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrors([]);
    setSummary("");

    try {
      setLoading(true);

      const text = await file.text();
      const rawLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (rawLines.length < 2) {
        setErrors(["CSV must include a header row and at least one data row."]);
        return;
      }

      const headers = parseCsvLine(rawLines[0]).map((h) => h.toLowerCase());

      const requiredHeaders = [
        "item_name",
        "buy_price",
        "quantity",
        "return_window_days",
        "purchase_date",
      ];

      const missingHeaders = requiredHeaders.filter(
        (header) => !headers.includes(header)
      );

      if (missingHeaders.length > 0) {
        setErrors([
          `Missing required header(s): ${missingHeaders.join(", ")}`,
        ]);
        return;
      }

      const headerIndex = Object.fromEntries(
        headers.map((header, index) => [header, index])
      ) as Record<string, number>;

      const rowErrors: string[] = [];
      const parsedRows: ParsedRow[] = [];

      for (let i = 1; i < rawLines.length; i += 1) {
        const rowNumber = i + 1;
        const values = parseCsvLine(rawLines[i]);

        const itemName = (values[headerIndex.item_name] || "").trim();
        const buyPriceRaw = (values[headerIndex.buy_price] || "").trim();
        const quantityRaw = (values[headerIndex.quantity] || "").trim();
        const returnWindowRaw = (
          values[headerIndex.return_window_days] || ""
        ).trim();
        const purchaseDateRaw = (
          values[headerIndex.purchase_date] || ""
        ).trim();

        if (!itemName) {
          rowErrors.push(`Row ${rowNumber}: item_name is required.`);
          continue;
        }

        const buyPrice = Number(buyPriceRaw);
        if (Number.isNaN(buyPrice) || buyPrice < 0) {
          rowErrors.push(`Row ${rowNumber}: buy_price must be a valid number.`);
          continue;
        }

        const quantity = Number(quantityRaw);
        if (!Number.isInteger(quantity) || quantity < 1) {
          rowErrors.push(
            `Row ${rowNumber}: quantity must be a whole number greater than 0.`
          );
          continue;
        }

        const returnWindowDays = Number(returnWindowRaw);
        if (returnWindowDays !== 14 && returnWindowDays !== 30) {
          rowErrors.push(
            `Row ${rowNumber}: return_window_days must be 14 or 30.`
          );
          continue;
        }

        const normalisedPurchaseDate = purchaseDateRaw
          ? normalisePurchaseDate(purchaseDateRaw)
          : null;

        if (purchaseDateRaw && !normalisedPurchaseDate) {
          rowErrors.push(
            `Row ${rowNumber}: purchase_date must be YYYY-MM-DD or DD/MM/YYYY.`
          );
          continue;
        }

        parsedRows.push({
          item_name: itemName,
          buy_price: buyPrice,
          quantity,
          return_window_days: returnWindowDays as 14 | 30,
          purchase_date: normalisedPurchaseDate,
        });
      }

      if (rowErrors.length > 0) {
        setErrors(rowErrors);
        return;
      }

      if (parsedRows.length === 0) {
        setErrors(["No valid rows found to import."]);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrors(["Could not get current user."]);
        return;
      }

      const now = new Date();

      const rowsToInsert = parsedRows.map((row) => {
        const deadline = new Date(now);
        deadline.setDate(deadline.getDate() + row.return_window_days);

        return {
          user_id: user.id,
          item_name: row.item_name,
          buy_price: row.buy_price,
          quantity: row.quantity,
          quantity_sold: 0,
          quantity_remaining: row.quantity,
          return_window_days: row.return_window_days,
          return_deadline: deadline.toISOString(),
          purchase_date: row.purchase_date,
          status: "in_stock" as const,
          sold_price: null,
          fees: 0,
          shipping: 0,
          sold_date: null,
        };
      });

      const { error } = await supabase
        .from("inventory_items")
        .insert(rowsToInsert);

      if (error) {
        console.error("Bulk insert error:", error);
        setErrors([error.message || "Failed to import CSV."]);
        return;
      }

      setSummary(`${rowsToInsert.length} item(s) imported successfully.`);
      onSuccess();
    } catch (error) {
      console.error("Bulk import error:", error);
      setErrors(["Something went wrong while importing the CSV."]);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-[#081120] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Bulk Import CSV</h2>
            <p className="mt-1 text-sm text-slate-400">
              Upload stock using the template format.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          Required columns:
          <div className="mt-2 font-mono text-xs text-slate-400">
            item_name,buy_price,quantity,return_window_days,purchase_date
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Accepted purchase_date formats: <span className="font-mono">YYYY-MM-DD</span> or <span className="font-mono">DD/MM/YYYY</span>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Upload CSV file
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileUpload}
            disabled={loading}
            className="block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-4 file:py-2 file:font-semibold file:text-black hover:file:opacity-90"
          />
        </div>

        {summary ? (
          <div className="mt-5 rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            {summary}
          </div>
        ) : null}

        {errors.length > 0 ? (
          <div className="mt-5 rounded-[18px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <div className="mb-2 font-semibold">Import errors</div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {errors.map((error, index) => (
                <div key={`${error}-${index}`}>{error}</div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-white transition hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}