"use client";

import { useEffect, useState } from "react";
import {
  Boxes,
  CheckSquare,
  Wallet,
  PoundSterling,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InventoryItem, getInventoryStats } from "@/lib/inventory";

const supabase = createClient();

function formatCurrency(value: number) {
  return `£${Number(value || 0).toFixed(2)}`;
}

function formatPercent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

type StatKey =
  | "inStockCount"
  | "soldCount"
  | "capitalLocked"
  | "totalProfit"
  | "avgROI";

type StatCard = {
  key: StatKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconWrap: string;
  valueClass: string;
  money?: boolean;
  percent?: boolean;
};

const statCards: StatCard[] = [
  {
    key: "inStockCount",
    label: "IN STOCK",
    icon: Boxes,
    iconWrap: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    valueClass: "text-white",
    money: false,
    percent: false,
  },
  {
    key: "soldCount",
    label: "SOLD",
    icon: CheckSquare,
    iconWrap: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    valueClass: "text-white",
    money: false,
    percent: false,
  },
  {
    key: "capitalLocked",
    label: "CAPITAL LOCKED",
    icon: Wallet,
    iconWrap: "border-white/10 bg-white/5 text-slate-300",
    valueClass: "text-white",
    money: true,
    percent: false,
  },
  {
    key: "totalProfit",
    label: "TOTAL PROFIT",
    icon: PoundSterling,
    iconWrap: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    valueClass: "text-white",
    money: true,
    percent: false,
  },
  {
    key: "avgROI",
    label: "AVG ROI",
    icon: TrendingUp,
    iconWrap: "border-sky-500/20 bg-sky-500/10 text-sky-300",
    valueClass: "text-white",
    money: false,
    percent: true,
  },
];

type DashboardStats = {
  inStockCount: number;
  soldCount: number;
  capitalLocked: number;
  totalProfit: number;
  avgROI: number;
};

export default function DashboardInventoryOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    inStockCount: 0,
    soldCount: 0,
    capitalLocked: 0,
    totalProfit: 0,
    avgROI: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInventoryStats() {
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

        const { data, error } = await supabase
          .from("inventory_items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Failed to load inventory items:", error);
          return;
        }

        const items = (data ?? []) as InventoryItem[];
        const calculated = getInventoryStats(items);

        setStats({
          inStockCount: Number(calculated.inStockCount ?? 0),
          soldCount: Number(calculated.soldCount ?? 0),
          capitalLocked: Number(calculated.capitalLocked ?? 0),
          totalProfit: Number(calculated.totalProfit ?? 0),
          avgROI: Number(calculated.avgROI ?? 0),
        });
      } catch (error) {
        console.error("Unexpected inventory stats error:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadInventoryStats();
  }, []);

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      {statCards.map((card) => {
        const Icon = card.icon;
        const rawValue = stats[card.key];

        let displayValue: string | number = rawValue;

        if (card.money) {
          displayValue = formatCurrency(rawValue);
        } else if (card.percent) {
          displayValue = formatPercent(rawValue);
        }

        return (
          <div
            key={card.key}
            className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
          >
            <div
              className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border ${card.iconWrap}`}
            >
              <Icon size={20} />
            </div>

            <div
              className={`text-[42px] font-semibold leading-none ${card.valueClass}`}
            >
              {loading ? "..." : String(displayValue)}
            </div>

            <div className="mt-3 text-xs uppercase tracking-[0.32em] text-slate-500">
              {card.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}