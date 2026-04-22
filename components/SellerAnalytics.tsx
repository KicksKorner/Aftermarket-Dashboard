"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, Package, ShoppingCart,
  RefreshCw, BarChart3, Layers, Zap, CheckCircle2, AlertCircle,
} from "lucide-react";

const supabase = createClient();
type Platform = "all" | "ebay" | "amazon";

type SaleRow = {
  id: string;
  item_title: string;
  asin: string | null;
  order_id: string;
  quantity: number;
  sale_price: number;
  fees: number;
  cog: number;
  profit: number;
  roi: number;
  sold_date: string;
  platform: "ebay" | "amazon";
};

type DayBucket = { date: string; revenue: number; profit: number };

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function RingChart({ value, label, color, prefix = "£" }: {
  value: string; label: string; color: string; prefix?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative flex h-28 w-28 items-center justify-center rounded-full border-4 ${color}`}
        style={{ boxShadow: `0 0 20px ${color.includes("emerald") ? "rgba(52,211,153,0.15)" : color.includes("blue") ? "rgba(96,165,250,0.15)" : color.includes("orange") ? "rgba(251,146,60,0.15)" : "rgba(167,139,250,0.15)"}` }}>
        <div className="text-center">
          <p className="text-xs text-slate-500 leading-tight">{prefix === "£" ? "£" : ""}</p>
          <p className="text-lg font-bold text-white leading-tight">{value}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 text-center">{label}</p>
    </div>
  );
}

export default function SellerAnalytics() {
  const [platform, setPlatform] = useState<Platform>("all");
  const [period, setPeriod] = useState<30 | 60 | 90>(30);
  const [allSales, setAllSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    const results: string[] = [];
    const errors: string[] = [];

    // Sync eBay
    try {
      const res = await fetch("/api/ebay/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) results.push(`eBay: ${data.synced} order${data.synced !== 1 ? "s" : ""}`);
      else errors.push(`eBay: ${data.error || "failed"}`);
    } catch { errors.push("eBay: connection error"); }

    // Sync Amazon
    try {
      const res = await fetch("/api/amazon/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) results.push(`Amazon: ${data.synced} order${data.synced !== 1 ? "s" : ""}`);
      else if (data.error !== "No Amazon account connected") errors.push(`Amazon: ${data.error || "failed"}`);
    } catch { errors.push("Amazon: connection error"); }

    setSyncing(false);
    if (results.length > 0) {
      setSyncResult({ ok: true, msg: results.join(" · ") });
      await fetchAll();
    } else if (errors.length > 0) {
      setSyncResult({ ok: false, msg: errors.join(" · ") });
    }
    setTimeout(() => setSyncResult(null), 5000);
  }

  async function fetchAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch eBay sales with inventory match for COG
    const [{ data: ebaySales }, { data: amazonSales }, { data: inventoryItems }] = await Promise.all([
      supabase.from("ebay_sales").select("*").eq("user_id", user.id).gte("sold_date", since).order("sold_date", { ascending: false }),
      supabase.from("amazon_sales").select("*").eq("user_id", user.id).gte("sold_date", since).order("sold_date", { ascending: false }),
      supabase.from("inventory_items").select("id, buy_price").eq("user_id", user.id),
    ]);

    const cogMap = new Map((inventoryItems || []).map(i => [i.id, Number(i.buy_price)]));

    const rows: SaleRow[] = [];

    for (const s of (ebaySales || [])) {
      const cog = s.matched_inventory_id ? (cogMap.get(s.matched_inventory_id) ?? 0) : 0;
      const revenue = Number(s.sale_price) * Number(s.quantity_sold);
      const fees = Number(s.sale_price) * 0.1255 + 0.30; // estimated if not stored
      const profit = revenue - (cog * Number(s.quantity_sold)) - fees;
      rows.push({
        id: s.id,
        item_title: s.item_title,
        asin: null,
        order_id: s.ebay_order_id,
        quantity: Number(s.quantity_sold),
        sale_price: Number(s.sale_price),
        fees,
        cog,
        profit,
        roi: cog > 0 ? (profit / (cog * Number(s.quantity_sold))) * 100 : 0,
        sold_date: s.sold_date,
        platform: "ebay",
      });
    }

    for (const s of (amazonSales || [])) {
      const cog = s.matched_inventory_id ? (cogMap.get(s.matched_inventory_id) ?? 0) : 0;
      const revenue = Number(s.sale_price) * Number(s.quantity_sold);
      const fees = Number(s.amazon_fees) || 0;
      const profit = revenue - (cog * Number(s.quantity_sold)) - fees;
      rows.push({
        id: s.id,
        item_title: s.item_title,
        asin: s.asin,
        order_id: s.amazon_order_id,
        quantity: Number(s.quantity_sold),
        sale_price: Number(s.sale_price),
        fees,
        cog,
        profit,
        roi: cog > 0 ? (profit / (cog * Number(s.quantity_sold))) * 100 : 0,
        sold_date: s.sold_date,
        platform: "amazon",
      });
    }

    setAllSales(rows);
    setLastUpdated(new Date().toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const cutoff = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();
    return allSales.filter(s => {
      const dateOk = s.sold_date >= cutoff;
      const platformOk = platform === "all" || s.platform === platform;
      return dateOk && platformOk;
    });
  }, [allSales, platform, period]);

  const stats = useMemo(() => {
    const revenue = filtered.reduce((s, r) => s + r.sale_price * r.quantity, 0);
    const profit = filtered.reduce((s, r) => s + r.profit, 0);
    const units = filtered.reduce((s, r) => s + r.quantity, 0);
    const orders = filtered.length;
    const roi = filtered.filter(r => r.cog > 0).length > 0
      ? filtered.filter(r => r.cog > 0).reduce((s, r) => s + r.roi, 0) / filtered.filter(r => r.cog > 0).length
      : 0;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { revenue, profit, units, orders, roi, margin };
  }, [filtered]);

  // Chart data — group by day
  const chartData = useMemo<DayBucket[]>(() => {
    const map = new Map<string, DayBucket>();
    for (const s of filtered) {
      const date = s.sold_date.split("T")[0];
      if (!map.has(date)) map.set(date, { date, revenue: 0, profit: 0 });
      const b = map.get(date)!;
      b.revenue += s.sale_price * s.quantity;
      b.profit += s.profit;
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  // Best sellers
  const bestSellers = useMemo(() => {
    const map = new Map<string, { title: string; units: number; revenue: number; profit: number; platform: string }>();
    for (const s of filtered) {
      const key = s.item_title;
      if (!map.has(key)) map.set(key, { title: key, units: 0, revenue: 0, profit: 0, platform: s.platform });
      const b = map.get(key)!;
      b.units += s.quantity;
      b.revenue += s.sale_price * s.quantity;
      b.profit += s.profit;
    }
    return Array.from(map.values()).sort((a, b) => b.profit - a.profit).slice(0, 5);
  }, [filtered]);

  // Recent orders (last 10)
  const recentOrders = filtered.slice(0, 10);

  if (loading) {
    return (
      <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <RefreshCw size={14} className="animate-spin" /> Loading seller analytics...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Analytics header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <BarChart3 size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Seller Analytics</h2>
            {lastUpdated && <p className="text-xs text-slate-500">Last update: {lastUpdated}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Platform toggle */}
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
            {([["all", "All", Layers], ["ebay", "eBay", ShoppingCart], ["amazon", "Amazon", Package]] as const).map(([p, label, Icon]) => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition
                  ${platform === p ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}>
                <Icon size={11} />{label}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
            {([30, 60, 90] as const).map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition
                  ${period === d ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/20 transition disabled:opacity-50">
            {syncing ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
          <button onClick={fetchAll} disabled={syncing} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition disabled:opacity-50">
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* Sync result */}
      {syncResult && (
        <div className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm ${
          syncResult.ok
            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            : "border-red-500/20 bg-red-500/10 text-red-300"
        }`}>
          {syncResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {syncResult.ok ? "Synced — " : "Sync issue — "}{syncResult.msg}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-10 text-center">
          <BarChart3 size={32} className="mx-auto mb-3 text-slate-700" />
          <p className="text-base font-semibold text-white">No sales data for this period</p>
          <p className="mt-1 text-sm text-slate-500">
            {platform !== "all" ? `No ${platform} sales in the last ${period} days. ` : ""}
            Sync your eBay or Amazon account in the{" "}
            <Link href="/dashboard/inventory" className="text-blue-400 hover:text-blue-300">AIO Tracker</Link> to see data here.
          </p>
        </div>
      ) : (
        <>
          {/* P&L Ring cards */}
          <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
            <div className="flex flex-wrap items-center justify-around gap-6 mb-6">
              <RingChart value={fmt(stats.profit)} label="Profit" color={stats.profit >= 0 ? "border-emerald-400" : "border-red-400"} />
              <RingChart value={fmt(stats.revenue)} label="Sales" color="border-blue-400" />
              <RingChart value={String(stats.units)} label="Units Sold" color="border-orange-400" prefix="" />
              <RingChart value={`${pct(stats.roi)}%`} label="R.O.I" color="border-violet-400" prefix="" />
            </div>

            {/* Sub stats */}
            <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-5">
              {[
                { label: "Stock Lines", value: String(new Set(filtered.map(s => s.item_title)).size) },
                { label: "Orders", value: String(stats.orders) },
                { label: "Profit Margin %", value: `${pct(stats.margin)}%` },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-lg font-semibold text-white">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Sales History Chart + Last Orders */}
          <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
            {/* Chart */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Sales History</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-blue-500/60" />Revenue</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-emerald-500/80" />Profit</span>
                </div>
              </div>
              {chartData.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-slate-600">No chart data</div>
              ) : (
                <div className="flex h-44 items-end gap-0.5 overflow-hidden">
                  {chartData.map((d, i) => {
                    const revH = Math.max((d.revenue / maxRevenue) * 160, 2);
                    const profH = d.profit > 0 ? Math.max((d.profit / maxRevenue) * 160, 2) : 0;
                    return (
                      <div key={i} className="group relative flex flex-1 flex-col items-center justify-end gap-0.5"
                        title={`${d.date}\nRevenue: £${fmt(d.revenue)}\nProfit: £${fmt(d.profit)}`}>
                        <div className="w-full rounded-t-sm bg-emerald-500/70 transition-all group-hover:bg-emerald-400"
                          style={{ height: `${profH}px` }} />
                        <div className="w-full rounded-t-sm bg-blue-500/40 transition-all group-hover:bg-blue-400/60"
                          style={{ height: `${Math.max(revH - profH, 2)}px` }} />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-2 flex justify-between text-xs text-slate-600">
                <span>{chartData[0]?.date ? new Date(chartData[0].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>
                <span>{chartData[chartData.length - 1]?.date ? new Date(chartData[chartData.length - 1].date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : ""}</span>
              </div>
            </div>

            {/* Last Orders */}
            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Last Orders</h3>
                <Link href="/dashboard/inventory" className="text-xs text-slate-500 hover:text-white">View all →</Link>
              </div>
              <div className="space-y-2 overflow-auto max-h-56">
                {recentOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-medium text-white">{order.item_title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className={`text-[10px] rounded-full px-1.5 py-0.5 border font-medium ${
                            order.platform === "ebay"
                              ? "border-blue-500/20 bg-blue-500/10 text-blue-400"
                              : "border-orange-500/20 bg-orange-500/10 text-orange-400"
                          }`}>{order.platform === "ebay" ? "eBay" : "Amazon"}</span>
                          {order.asin && <span className="text-[10px] text-slate-600 font-mono">{order.asin}</span>}
                          <span className="text-[10px] text-slate-600">{new Date(order.sold_date).toLocaleDateString("en-GB")}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xs font-semibold ${order.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {order.profit >= 0 ? "+" : ""}£{fmt(order.profit)}
                        </p>
                        <p className="text-[10px] text-slate-500">£{fmt(order.sale_price)} sold</p>
                      </div>
                    </div>
                    <div className="mt-1.5 flex gap-3 text-[10px] text-slate-600">
                      <span>COG: £{fmt(order.cog)}</span>
                      <span>Fees: £{fmt(order.fees)}</span>
                      <span>ROI: {order.roi !== 0 ? `${pct(order.roi)}%` : "—"}</span>
                      <span>Qty: {order.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Best Sellers */}
          {bestSellers.length > 0 && (
            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-5">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp size={15} className="text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Best Sellers</h3>
                <span className="text-xs text-slate-500">— last {period} days by profit</span>
              </div>
              <div className="space-y-2">
                {bestSellers.map((item, i) => {
                  const maxProfit = bestSellers[0].profit;
                  const barWidth = maxProfit > 0 ? Math.max((item.profit / maxProfit) * 100, 5) : 5;
                  return (
                    <div key={item.title} className="flex items-center gap-3">
                      <span className="w-4 text-xs text-slate-600 flex-shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="truncate text-xs font-medium text-white max-w-[60%]">{item.title}</p>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-slate-500">{item.units} units</span>
                            <span className={`text-xs font-semibold ${item.profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              +£{fmt(item.profit)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5">
                          <div className="h-1.5 rounded-full bg-emerald-500/60"
                            style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
