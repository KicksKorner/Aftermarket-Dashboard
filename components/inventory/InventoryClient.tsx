"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Package, CheckSquare, Coins, PoundSterling, TrendingUp, Lock,
  LayoutDashboard, ShoppingCart, Tag, Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AddItemModal from "@/components/inventory/AddItemModal";
import MarkSoldModal from "@/components/inventory/MarkSoldModal";
import EditItemModal from "@/components/inventory/EditItemModal";
import MonthlyProfitChart from "@/components/inventory/MonthlyProfitChart";
import ExportCsvModal from "@/components/inventory/ExportCsvModal";
import BulkImportModal from "@/components/inventory/BulkImportModal";
import EbayTab from "@/components/inventory/EbayTab";
import VintedTab from "@/components/inventory/VintedTab";
import ReceiptHubTab from "@/components/inventory/ReceiptHubTab";
import {
  InventoryItem, InventorySale, calculateProfit, calculateROI,
  getInventoryStats, getMonthlyProfitDataFromSales, getYearToDateStatsFromSales,
  getSalesSummary, getReturnCountdown,
} from "@/lib/inventory";

const supabase = createClient();
type FilterType = "all" | "in_stock" | "sold";
type SaleWithBuyPrice = InventorySale & { buy_price_per_unit: number };
type TabType = "overview" | "ebay" | "vinted" | "receipts";

export default function InventoryClient({ isPremium }: { isPremium: boolean }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<InventorySale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [, setNowTick] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [ir, sr] = await Promise.all([
        supabase.from("inventory_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("inventory_sales").select("*").eq("user_id", user.id).order("sold_date", { ascending: true }),
      ]);
      if (!ir.error) setItems((ir.data || []) as InventoryItem[]);
      if (!sr.error) setSales((sr.data || []) as InventorySale[]);
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, []);

  const salesWithBuyPrice = useMemo<SaleWithBuyPrice[]>(() => {
    const m = new Map(items.map((i) => [i.id, i]));
    return sales.map((s) => {
      const item = m.get(s.inventory_item_id);
      if (!item) return null;
      return { ...s, buy_price_per_unit: Number(item.buy_price) };
    }).filter((s): s is SaleWithBuyPrice => s !== null);
  }, [items, sales]);

  const stats = useMemo(() => {
    const inv = getInventoryStats(items);
    const sum = getSalesSummary(salesWithBuyPrice);
    return {
      inStockCount: inv.inStockCount, soldCount: inv.soldCount,
      capitalLocked: inv.capitalLocked, totalProfit: sum.totalProfit,
      avgROI: salesWithBuyPrice.length > 0
        ? salesWithBuyPrice.reduce((acc, s) => {
            const cost = Number(s.buy_price_per_unit) * Number(s.quantity_sold);
            const rev = Number(s.sold_price) * Number(s.quantity_sold);
            const profit = rev - cost - Number(s.fees) - Number(s.shipping);
            return cost <= 0 ? acc : acc + (profit / cost) * 100;
          }, 0) / salesWithBuyPrice.length
        : 0,
    };
  }, [items, salesWithBuyPrice]);

  const monthlyProfitData = useMemo(() => getMonthlyProfitDataFromSales(salesWithBuyPrice), [salesWithBuyPrice]);
  const yearToDateStats = useMemo(() => getYearToDateStatsFromSales(salesWithBuyPrice), [salesWithBuyPrice]);
  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return items;
    if (activeFilter === "in_stock") return items.filter((i) => Number(i.quantity_remaining) > 0);
    return items.filter((i) => Number(i.quantity_remaining) === 0);
  }, [items, activeFilter]);

  const statCards = [
    { title: "In Stock", value: String(stats.inStockCount), icon: Package, iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
    { title: "Sold", value: String(stats.soldCount), icon: CheckSquare, iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
    { title: "Capital Locked", value: `£${stats.capitalLocked.toFixed(2)}`, icon: Coins, iconClasses: "border-slate-500/20 bg-slate-500/10 text-slate-300" },
    { title: "Total Profit", value: `£${stats.totalProfit.toFixed(2)}`, icon: PoundSterling, iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
    { title: "Avg ROI", value: `${stats.avgROI.toFixed(1)}%`, icon: TrendingUp, iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300" },
  ];

  function handleOpenSoldModal(item: InventoryItem) { setSelectedItem(item); setShowSoldModal(true); }
  function handleCloseSoldModal() { setSelectedItem(null); setShowSoldModal(false); }
  function handleOpenEditModal(item: InventoryItem) { setSelectedItem(item); setShowEditModal(true); }
  function handleCloseEditModal() { setSelectedItem(null); setShowEditModal(false); }

  async function handleDeleteItem(item: InventoryItem) {
    if (!window.confirm(`Delete "${item.item_name}"?`)) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", item.id);
    if (!error) fetchData();
  }

  function handleDownloadTemplate() {
    if (!isPremium) return;
    const csv = ["item_name,buy_price,quantity,return_window_days,purchase_date", "Pokemon 151 ETB,32.99,25,14,2026-03-15"].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.setAttribute("download", "inventory-import-template.csv");
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function filterBtn(filter: FilterType) {
    return `rounded-xl px-4 py-2 text-sm transition ${activeFilter === filter
      ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`;
  }

  function LockedBtn({ label }: { label: string }) {
    return (
      <button disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2 text-sm text-slate-600 opacity-60">
        <Lock size={12} />{label}
      </button>
    );
  }

  const tabs = [
    { id: "overview" as TabType, label: "Overview", icon: LayoutDashboard, premiumOnly: false },
    { id: "ebay" as TabType, label: "eBay", icon: ShoppingCart, premiumOnly: true },
    { id: "vinted" as TabType, label: "Vinted", icon: Tag, premiumOnly: true },
    { id: "receipts" as TabType, label: "Receipt Hub", icon: Receipt, premiumOnly: true },
  ];

  return (
    <>
      <div className="space-y-8">
        <section>
          <div className="mb-5 flex items-center gap-2">
            <span className="text-blue-400">📦</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">AIO Tracker</h1>
              <p className="mt-1 text-sm text-slate-400">Track inventory, sales, profit and ROI in one place.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.title} className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
                  <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border ${stat.iconClasses}`}><Icon size={20} /></div>
                  <div className="text-3xl font-semibold">{loading ? "..." : stat.value}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{stat.title}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
          {/* Tab nav */}
          <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-4">
            {tabs.map(({ id, label, icon: Icon, premiumOnly }) => {
              const isActive = activeTab === id;
              const isLocked = premiumOnly && !isPremium;
              return (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    isActive ? "border border-blue-500/30 bg-blue-500/15 text-blue-300"
                    : isLocked ? "border border-white/5 bg-white/[0.02] text-slate-600"
                    : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}>
                  <Icon size={14} />{label}{isLocked && <Lock size={11} className="text-slate-700" />}
                </button>
              );
            })}
          </div>

          {/* Overview tab */}
          {activeTab === "overview" && (
            <>
              <div className="mb-6 grid gap-4 xl:grid-cols-3">
                <div className="xl:col-span-2"><MonthlyProfitChart data={monthlyProfitData} /></div>
                <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
                  <div className="mb-4 flex items-center gap-2"><span className="text-lg">📅</span><h2 className="text-xl font-semibold">{yearToDateStats.year} Year to Date</h2></div>
                  <div className="space-y-4">
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">YTD Sales</div>
                      <div className="mt-3 text-3xl font-semibold">£{yearToDateStats.ytdSales.toFixed(2)}</div>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">YTD Profit</div>
                      <div className={`mt-3 text-3xl font-semibold ${yearToDateStats.ytdProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>£{yearToDateStats.ytdProfit.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 className="text-xl font-semibold">Inventory Items</h2><p className="mt-1 text-sm text-slate-400">View and manage your tracked items.</p></div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setActiveFilter("all")} className={filterBtn("all")}>All</button>
                  <button onClick={() => setActiveFilter("in_stock")} className={filterBtn("in_stock")}>In Stock</button>
                  <button onClick={() => setActiveFilter("sold")} className={filterBtn("sold")}>Sold</button>
                  {isPremium ? (
                    <>
                      <button onClick={handleDownloadTemplate} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">Download Template</button>
                      <button onClick={() => setShowBulkImportModal(true)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">Bulk Import</button>
                      <button onClick={() => setShowExportModal(true)} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10">Export CSV</button>
                    </>
                  ) : (
                    <><LockedBtn label="Download Template" /><LockedBtn label="Bulk Import" /><LockedBtn label="Export CSV" /></>
                  )}
                  <button onClick={() => setShowAddModal(true)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:opacity-90">Add Item</button>
                </div>
              </div>

              {!isPremium && (
                <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                  <Lock size={14} className="flex-shrink-0" />
                  <span><span className="font-semibold">Download Template</span>, <span className="font-semibold">Bulk Import</span>, <span className="font-semibold">Export CSV</span>, and the <span className="font-semibold">Return Window</span> tracker are Premium features. <a href="/upgrade" className="underline hover:text-amber-200">Upgrade to unlock →</a></span>
                </div>
              )}

              <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#081120]/80">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1500px] text-sm">
                    <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
                      <tr>
                        <th className="px-4 py-4 font-medium">Item</th>
                        <th className="px-4 py-4 font-medium">Buy</th>
                        <th className="px-4 py-4 font-medium">Qty</th>
                        <th className="px-4 py-4 font-medium">Sold Qty</th>
                        <th className="px-4 py-4 font-medium">Left</th>
                        <th className="px-4 py-4 font-medium"><span className={`flex items-center gap-1.5 ${!isPremium ? "opacity-40" : ""}`}>{!isPremium && <Lock size={11} />}Return Window</span></th>
                        <th className="px-4 py-4 font-medium"><span className={`flex items-center gap-1.5 ${!isPremium ? "opacity-40" : ""}`}>{!isPremium && <Lock size={11} />}Return Countdown</span></th>
                        <th className="px-4 py-4 font-medium">Last Sold</th>
                        <th className="px-4 py-4 font-medium">Fees</th>
                        <th className="px-4 py-4 font-medium">Shipping</th>
                        <th className="px-4 py-4 font-medium">Profit</th>
                        <th className="px-4 py-4 font-medium">ROI</th>
                        <th className="px-4 py-4 font-medium">Status</th>
                        <th className="px-4 py-4 font-medium">Purchase Date</th>
                        <th className="px-4 py-4 font-medium">Last Sold Date</th>
                        <th className="px-4 py-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={16} className="px-4 py-10 text-center text-slate-400">Loading inventory...</td></tr>
                      ) : filteredItems.length === 0 ? (
                        <tr><td colSpan={16} className="px-4 py-10 text-center text-slate-400">
                          {activeFilter === "all" ? "No inventory items yet." : activeFilter === "in_stock" ? "No in stock items." : "No sold items."}
                        </td></tr>
                      ) : filteredItems.map((item) => {
                        const profit = calculateProfit(item);
                        const roi = calculateROI(item);
                        const isSoldOut = Number(item.quantity_remaining) === 0;
                        const countdown = getReturnCountdown(item.return_deadline);
                        return (
                          <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                            <td className="px-4 py-4 font-medium text-white">{item.item_name}</td>
                            <td className="px-4 py-4 text-slate-300">£{Number(item.buy_price).toFixed(2)}</td>
                            <td className="px-4 py-4 text-slate-300">{Number(item.quantity ?? 1)}</td>
                            <td className="px-4 py-4 text-slate-300">{Number(item.quantity_sold ?? 0)}</td>
                            <td className="px-4 py-4 text-slate-300">{Number(item.quantity_remaining ?? 0)}</td>
                            <td className="px-4 py-4">
                              {isPremium ? <span className="text-slate-300">{item.return_window_days ? `${item.return_window_days} Days` : "-"}</span> : (
                                <span className="relative inline-block select-none">
                                  <span className="pointer-events-none blur-[5px] text-slate-300">14 Days</span>
                                  <span className="absolute inset-0 flex items-center justify-center"><Lock size={11} className="text-slate-500" /></span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              {isPremium ? (countdown ? <span className={countdown.expired ? "text-red-300" : "text-amber-300"}>{countdown.label}</span> : <span className="text-slate-500">-</span>) : (
                                <span className="relative inline-block select-none">
                                  <span className={`pointer-events-none blur-[5px] ${countdown?.expired ? "text-red-300" : "text-amber-300"}`}>{countdown?.label ?? "0d 0h left"}</span>
                                  <span className="absolute inset-0 flex items-center justify-center"><Lock size={11} className="text-slate-500" /></span>
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4 text-slate-300">{item.sold_price !== null ? `£${Number(item.sold_price).toFixed(2)}` : "-"}</td>
                            <td className="px-4 py-4 text-slate-300">£{Number(item.fees).toFixed(2)}</td>
                            <td className="px-4 py-4 text-slate-300">£{Number(item.shipping).toFixed(2)}</td>
                            <td className="px-4 py-4">{profit !== null ? <span className={profit >= 0 ? "text-emerald-300" : "text-red-300"}>£{profit.toFixed(2)}</span> : <span className="text-slate-500">-</span>}</td>
                            <td className="px-4 py-4">{roi !== null ? <span className={roi >= 0 ? "text-emerald-300" : "text-red-300"}>{roi.toFixed(1)}%</span> : <span className="text-slate-500">-</span>}</td>
                            <td className="px-4 py-4">
                              <span className={`rounded-full px-3 py-1 text-xs font-medium ${isSoldOut ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border border-slate-500/20 bg-slate-500/10 text-slate-300"}`}>
                                {isSoldOut ? "Sold" : "In Stock"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-slate-300">{item.purchase_date ?? "-"}</td>
                            <td className="px-4 py-4 text-slate-300">{item.sold_date ?? "-"}</td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button onClick={() => handleOpenEditModal(item)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Edit</button>
                                {Number(item.quantity_remaining) > 0 && <button onClick={() => handleOpenSoldModal(item)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Mark Sold</button>}
                                <button onClick={() => handleDeleteItem(item)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20">Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Premium-locked tab overlay */}
          {(activeTab === "ebay" || activeTab === "vinted" || activeTab === "receipts") && !isPremium && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-semibold text-white">Premium Feature</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                {activeTab === "ebay" && "Connect your eBay account to sync sales automatically and match them to your inventory."}
                {activeTab === "vinted" && "Log and track your Vinted sales, automatically updating your inventory when items sell."}
                {activeTab === "receipts" && "Upload and store receipts, invoices and expense documents in one place."}
              </p>
              <a href="/upgrade" className="mt-6 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500">Upgrade to Premium →</a>
            </div>
          )}

          {activeTab === "ebay" && isPremium && <EbayTab />}
          {activeTab === "vinted" && isPremium && <VintedTab />}
          {activeTab === "receipts" && isPremium && <ReceiptHubTab />}
        </section>
      </div>

      <AddItemModal open={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} isPremium={isPremium} />
      <MarkSoldModal open={showSoldModal} onClose={handleCloseSoldModal} onSuccess={fetchData} item={selectedItem} />
      <EditItemModal open={showEditModal} onClose={handleCloseEditModal} onSuccess={fetchData} item={selectedItem} />
      <ExportCsvModal open={showExportModal} onClose={() => setShowExportModal(false)} sales={salesWithBuyPrice} />
      <BulkImportModal open={showBulkImportModal} onClose={() => setShowBulkImportModal(false)} onSuccess={fetchData} />
    </>
  );
}
