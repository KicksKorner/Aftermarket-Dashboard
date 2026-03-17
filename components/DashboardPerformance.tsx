"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MonthlyProfitChart from "@/components/MonthlyProfitChart";
import {
  calculateSaleProfit,
  getMonthlyProfitDataFromSales,
  InventorySale,
} from "@/lib/inventory";

const supabase = createClient();

type SaleWithBuyPrice = InventorySale & {
  buy_price_per_unit: number;
};

type BestFlip = {
  item_name: string;
  quantity_sold: number;
  total_sales: number;
  total_profit: number;
};

function formatCurrency(value: number) {
  return `£${Number(value || 0).toFixed(2)}`;
}

export default function DashboardPerformance() {
  const [sales, setSales] = useState<SaleWithBuyPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPerformanceData() {
      try {
        setLoading(true);

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          console.error("Could not get current user:", userError);
          return;
        }

        const { data: salesData, error: salesError } = await supabase
          .from("inventory_sales")
          .select("*")
          .eq("user_id", user.id)
          .order("sold_date", { ascending: true });

        if (salesError) {
          console.error("Failed to load sales:", salesError);
          return;
        }

        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory_items")
          .select("id, buy_price")
          .eq("user_id", user.id);

        if (inventoryError) {
          console.error("Failed to load inventory items:", inventoryError);
          return;
        }

        const buyPriceMap = new Map<string, number>();
        (inventoryData ?? []).forEach((item) => {
          buyPriceMap.set(item.id, Number(item.buy_price || 0));
        });

        const salesWithBuyPrice: SaleWithBuyPrice[] = (salesData ?? []).map(
          (sale) => ({
            ...sale,
            buy_price_per_unit: buyPriceMap.get(sale.inventory_item_id) ?? 0,
          })
        );

        setSales(salesWithBuyPrice);
      } catch (error) {
        console.error("Unexpected performance load error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPerformanceData();
  }, []);

  const monthlyChartData = useMemo(() => {
    return getMonthlyProfitDataFromSales(sales);
  }, [sales]);

  const currentMonthStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filtered = sales.filter((sale) => {
      const soldDate = new Date(sale.sold_date);
      if (Number.isNaN(soldDate.getTime())) return false;

      return (
        soldDate.getFullYear() === currentYear &&
        soldDate.getMonth() === currentMonth
      );
    });

    const totalSales = filtered.reduce(
      (sum, sale) => sum + Number(sale.sold_price) * Number(sale.quantity_sold),
      0
    );

    const totalProfit = filtered.reduce(
      (sum, sale) => sum + calculateSaleProfit(sale),
      0
    );

    return {
      totalSales,
      totalProfit,
      count: filtered.length,
    };
  }, [sales]);

  const bestFlipThisMonth = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const filtered = sales.filter((sale) => {
      const soldDate = new Date(sale.sold_date);
      if (Number.isNaN(soldDate.getTime())) return false;

      return (
        soldDate.getFullYear() === currentYear &&
        soldDate.getMonth() === currentMonth
      );
    });

    const grouped = new Map<string, BestFlip>();

    filtered.forEach((sale) => {
      const key = sale.item_name;
      const revenue =
        Number(sale.sold_price || 0) * Number(sale.quantity_sold || 0);
      const profit = calculateSaleProfit(sale);

      if (!grouped.has(key)) {
        grouped.set(key, {
          item_name: sale.item_name,
          quantity_sold: Number(sale.quantity_sold || 0),
          total_sales: revenue,
          total_profit: profit,
        });
      } else {
        const existing = grouped.get(key)!;
        existing.quantity_sold += Number(sale.quantity_sold || 0);
        existing.total_sales += revenue;
        existing.total_profit += profit;
      }
    });

    return (
      Array.from(grouped.values()).sort(
        (a, b) => b.total_profit - a.total_profit
      )[0] ?? null
    );
  }, [sales]);

  return (
    <section className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-500">
              This Month Sales
            </div>
            <div className="mt-3 text-3xl font-semibold">
              {loading ? "..." : formatCurrency(currentMonthStats.totalSales)}
            </div>
          </div>

          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-500">
              This Month Profit
            </div>
            <div className="mt-3 text-3xl font-semibold text-emerald-400">
              {loading ? "..." : formatCurrency(currentMonthStats.totalProfit)}
            </div>
          </div>
        </div>

        <MonthlyProfitChart data={monthlyChartData} />
      </div>

      <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <h2 className="text-xl font-semibold">Best Flip This Month</h2>
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
            Loading performance...
          </div>
        ) : !bestFlipThisMonth ? (
          <div className="rounded-[18px] border border-white/10 bg-white/5 p-5 text-sm text-slate-400">
            No sold items this month yet.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[18px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-slate-400">Item</div>
              <div className="mt-2 text-2xl font-semibold leading-tight">
                {bestFlipThisMonth.item_name}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Quantity Sold
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {bestFlipThisMonth.quantity_sold}
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Total Sales
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {formatCurrency(bestFlipThisMonth.total_sales)}
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">
                Total Profit
              </div>
              <div className="mt-2 text-3xl font-semibold text-emerald-300">
                {formatCurrency(bestFlipThisMonth.total_profit)}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}