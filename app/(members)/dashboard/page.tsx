import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  Link as LinkIcon,
  Shield,
  BarChart3,
  Video,
  Boxes,
} from "lucide-react";

const featureCards = [
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
    title: "Admin Panel",
    subtitle: "Manage content and tools",
    href: "/admin",
    icon: Shield,
    iconClasses: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  },
  {
    title: "Pokemon Market Tracker",
    subtitle: "Current Market Values",
href: "/pokemon-market-tracker",
    icon: BarChart3,
    iconClasses: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  },
  {
    title: "Live Call Recordings",
    subtitle: "Future training library",
    href: "/guides",
    icon: Video,
    iconClasses: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  },
  {
    title: "SKU's",
    subtitle: "Retailer Product Links",
    href: "/dashboard",
    icon: LinkIcon,
    iconClasses: "border-pink-500/20 bg-pink-500/10 text-pink-300",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-10">
      <section className="grid gap-6 rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[1fr_220px]">
        <div className="flex items-center gap-5">
          <Image
            src="/logo.png"
            alt="Aftermarket Arbitrage"
            width={70}
            height={70}
            className="rounded-xl"
          />

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Welcome back - AMA Member 👋
            </h1>
            <div className="mt-3 flex items-center gap-3 text-sm text-slate-400">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1.5 font-medium text-emerald-300">
                Premium Active
              </span>
              <span> Premium access enabled </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-start lg:justify-end">
          <div className="w-full rounded-[22px] border border-white/8 bg-[#0a1228] px-6 py-5 text-center">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Status
            </div>
            <div className="mt-3 text-2xl font-semibold">Live</div>
          </div>
        </div>
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