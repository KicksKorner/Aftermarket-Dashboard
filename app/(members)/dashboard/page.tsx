"use client";

import TopTrackedProductsOverview from "@/components/TopTrackedProductsOverview";
import DashboardPerformance from "@/components/DashboardPerformance";
import Link from "next/link";
import {
  BookOpen,
  Link as LinkIcon,
  Shield,
  Video,
  Boxes,
  Receipt,
  Mail,
  Footprints,
  Send,
} from "lucide-react";

const featureCards = [
  {
    title: "Deal Poster",
    subtitle: "Post clean deal alerts to Discord",
    href: "/dashboard/deal-post",
    icon: Send,
    iconClasses: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  {
    title: "Sole Scan",
    subtitle: "Scan SKUs and analyse trainer flips",
    href: "/dashboard/sole-scan",
    icon: Footprints,
    iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  },
  {
    title: "Inventory Tracker",
    subtitle: "Track items, profit & ROI",
    href: "/dashboard/inventory",
    icon: Boxes,
    iconClasses: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  },
  {
    title: "Expenses",
    subtitle: "Track costs and export CSVs",
    href: "/dashboard/expenses",
    icon: Receipt,
    iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  },
  {
    title: "Gmail Sync",
    subtitle: "Pending order imports to inventory",
    href: "/dashboard/gmail-sync",
    icon: Mail,
    iconClasses: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  {
    title: "Amazon Invites",
    subtitle: "Invite Only Products",
    href: "/links",
    icon: LinkIcon,
    iconClasses:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  },
  {
    title: "Guides Library",
    subtitle: "Training and walkthroughs",
    href: "/guides",
    icon: BookOpen,
    iconClasses: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  },
  {
    title: "Live Call Recordings",
    subtitle: "Future training library",
    href: "/guides",
    icon: Video,
    iconClasses: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  {
    title: "Admin Panel",
    subtitle: "Manage content and tools",
    href: "/admin",
    icon: Shield,
    iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Aftermarket Arbitrage Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300">
            Premium Active
          </span>

          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
            Premium access enabled
          </div>

          <div className="rounded-full border border-white/10 bg-[#0a1228] px-4 py-2 text-sm">
            <span className="text-slate-500">Status: </span>
            <span className="font-semibold text-white">Live</span>
          </div>
        </div>
      </section>

      <section>
        <TopTrackedProductsOverview />
      </section>

      <section>
        <DashboardPerformance />
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
          <span className="text-blue-400">✦</span>
          <h2>Premium Features</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {featureCards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_20px_50px_rgba(30,64,175,0.14)]"
              >
                <div
                  className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border ${card.iconClasses}`}
                >
                  <Icon size={20} />
                </div>

                <h3 className="text-xl font-semibold leading-tight">
                  {card.title}
                </h3>
                <p className="mt-3 text-sm text-slate-400">{card.subtitle}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}