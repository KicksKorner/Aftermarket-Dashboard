import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  BookOpen, Video, Boxes, Receipt, Mail, Lock, ShoppingBag,
  Ticket, TrendingUp, Calculator,
} from "lucide-react";
import SourcingWidget from "@/components/SourcingWidget";
import SellerAnalytics from "@/components/SellerAnalytics";
import NotificationBell from "@/components/NotificationBell";
import EbayFeedbackBadge from "@/components/EbayFeedbackBadge";

const accessLevelClass: Record<string, string> = {
  admin: "border-red-400/30 bg-red-500/10 text-red-300",
  premium: "border-orange-400/30 bg-orange-500/10 text-orange-300",
  member: "border-white/10 bg-white/5 text-slate-300",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, discord_username")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "member";
  const isUnlocked = role === "premium" || role === "admin";
  const displayName = profile?.discord_username ?? user?.email?.split("@")[0] ?? "there";

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  // Only fetch what's still needed — recent sales and gmail badge
  const [{ data: recentSales }, { data: gmailPending }] = await Promise.all([
    supabase
      .from("inventory_sales")
      .select("id, item_name, sold_price, sold_date")
      .eq("user_id", user!.id)
      .gte("sold_date", monthStart)
      .order("sold_date", { ascending: false })
      .limit(5),

    supabase
      .from("gmail_imports")
      .select("id")
      .eq("user_id", user!.id)
      .eq("status", "pending"),
  ]);

  const gmailPendingCount = gmailPending?.length ?? 0;

  const featureCards = [
    {
      title: "Vinted Bot",
      subtitle: "Real-time Vinted monitor and alerts",
      href: "/vinted-bot/pricing",
      icon: ShoppingBag,
      iconClasses: "border-violet-500/20 bg-violet-500/10 text-violet-300",
      locked: !isUnlocked,
    },
    {
      title: "AIO Tracker",
      subtitle: "Track items, profit & ROI",
      href: "/dashboard/inventory",
      icon: Boxes,
      iconClasses: "border-orange-500/20 bg-orange-500/10 text-orange-300",
      locked: false,
    },
    {
      title: "Expenses",
      subtitle: "Track costs and export MTD CSVs",
      href: "/dashboard/expenses",
      icon: Receipt,
      iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      locked: false,
    },
    {
      title: "Gmail Sync",
      subtitle: "Auto-import order confirmation emails",
      href: "/dashboard/gmail-sync",
      icon: Mail,
      iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      locked: !isUnlocked,
      badge: gmailPendingCount > 0 ? `${gmailPendingCount} pending` : undefined,
    },
    {
      title: "Profit Calculator",
      subtitle: "Calculate ROI before you buy",
      href: "/dashboard/profit-calculator",
      icon: Calculator,
      iconClasses: "border-blue-500/20 bg-blue-500/10 text-blue-300",
      locked: false,
    },
    {
      title: "Guides Library",
      subtitle: "Training and walkthroughs",
      href: "/guides",
      icon: BookOpen,
      iconClasses: "border-violet-500/20 bg-violet-500/10 text-violet-300",
      locked: false,
    },
    {
      title: "Live Call Recordings",
      subtitle: "Future training library",
      href: "/guides",
      icon: Video,
      iconClasses: "border-blue-500/20 bg-blue-500/10 text-blue-300",
      locked: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, {displayName} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-400">Here&apos;s what&apos;s happening with your reselling today.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {role === "member" && (
            <Link href="/upgrade"
              className="inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20">
              Upgrade to Premium
            </Link>
          )}
          <div className={`rounded-full border px-4 py-2 text-sm font-medium capitalize ${accessLevelClass[role] ?? accessLevelClass.member}`}>
            {role}
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0a1228] px-4 py-2 text-sm">
            <span className="text-slate-500">Status:</span>
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
          <EbayFeedbackBadge />
          <NotificationBell />
        </div>
      </section>

      {/* Seller Analytics */}
      <SellerAnalytics />

      {/* Recent activity + sourcing */}
      <section className="grid gap-4 xl:grid-cols-2">
        {/* Recent sales */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              <h3 className="text-base font-semibold text-white">Recent Sales This Month</h3>
            </div>
            <Link href="/dashboard/inventory" className="text-xs text-slate-500 hover:text-white">View all →</Link>
          </div>
          {recentSales && recentSales.length > 0 ? (
            <div className="space-y-2">
              {recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2.5">
                  <p className="truncate text-sm text-white max-w-[200px]">{sale.item_name}</p>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500">{sale.sold_date}</span>
                    <span className="text-sm font-semibold text-emerald-400">£{Number(sale.sold_price).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <TrendingUp size={24} className="mb-2 text-slate-700" />
              <p className="text-sm text-slate-500">No sales yet this month.</p>
              <Link href="/dashboard/inventory" className="mt-2 text-xs text-blue-400 hover:text-blue-300">Add your first item →</Link>
            </div>
          )}
        </div>

        <SourcingWidget />
      </section>

      {/* Feature cards */}
      <section>
        <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
          <span className="text-blue-400">✦</span>
          <h2>Your Tools</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href}
                className={`group relative rounded-[24px] border bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 transition duration-300 ${
                  card.locked
                    ? "border-white/5 opacity-75 hover:border-white/10"
                    : "border-blue-500/15 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_20px_50px_rgba(30,64,175,0.14)]"
                }`}>
                {card.locked && (
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                    <Lock size={11} />Premium
                  </div>
                )}
                {"badge" in card && card.badge && (
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-300">
                    {card.badge}
                  </div>
                )}
                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border ${card.locked ? "border-white/10 bg-white/5 text-slate-500" : card.iconClasses}`}>
                  <Icon size={20} />
                </div>
                <h3 className={`text-xl font-semibold leading-tight ${card.locked ? "text-slate-400" : "text-white"}`}>
                  {card.title}
                </h3>
                <p className="mt-3 text-sm text-slate-400">{card.subtitle}</p>
                {card.locked && (
                  <p className="mt-3 text-xs font-medium text-amber-400/80">Tap to unlock with Premium →</p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
