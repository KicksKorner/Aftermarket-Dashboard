import { createClient } from "@/lib/supabase/server";
import DashboardPerformance from "@/components/DashboardPerformance";
import Link from "next/link";
import { BookOpen, Video, Boxes, Receipt, Mail, Footprints, Lock, ShoppingBag } from "lucide-react";

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
    .select("role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "member";
  const isUnlocked = role === "premium" || role === "admin";

  const featureCards = [
    {
      title: "Sole Scan",
      subtitle: "Scan SKUs and analyse trainer flips",
      href: isUnlocked ? "/dashboard/sole-scan" : "/upgrade",
      icon: Footprints,
      iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      locked: !isUnlocked,
    },
    {
      title: "Vinted Bot",
      subtitle: "Real-time Vinted monitor and alerts",
      href: "/vinted-bot",
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
      subtitle: "Track costs and export CSVs",
      href: "/dashboard/expenses",
      icon: Receipt,
      iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
      locked: false,
    },
    {
      title: "Gmail Sync",
      subtitle: "Pending order imports to inventory",
      href: "/dashboard/gmail-sync",
      icon: Mail,
      iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
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
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Aftermarket Arbitrage Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Upgrade button — only for member role */}
          {role === "member" && (
            <Link
              href="/upgrade"
              className="inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
            >
              Upgrade to Premium
            </Link>
          )}

          {/* Access level badge */}
          <div className={`rounded-full border px-4 py-2 text-sm font-medium capitalize ${accessLevelClass[role] ?? accessLevelClass.member}`}>
            Access level: {role}
          </div>

          {/* Status: Live — green dot */}
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0a1228] px-4 py-2 text-sm">
            <span className="text-slate-500">Status:</span>
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
        </div>
      </section>

      <section>
        <DashboardPerformance />
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
          <span className="text-blue-400">✦</span>
          <h2>Premium Features</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className={`group relative rounded-[24px] border bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 transition duration-300 ${
                  card.locked
                    ? "border-white/5 opacity-75 hover:border-white/10"
                    : "border-blue-500/15 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_20px_50px_rgba(30,64,175,0.14)]"
                }`}
              >
                {card.locked && (
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                    <Lock size={11} />
                    Premium
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
                  <p className="mt-3 text-xs font-medium text-amber-400/80">
                    Tap to unlock with Premium →
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
