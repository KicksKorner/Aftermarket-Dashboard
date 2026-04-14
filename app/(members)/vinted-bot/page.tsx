import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Check, Lock, ShoppingBag, Zap, TrendingUp, Bell, Bot } from "lucide-react";

export default async function VintedBotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "member";

  const flips = [
    { item: "Nike Air Max 95", bought: "£10", sold: "£85", profit: "+£75" },
    { item: "Garmin Fénix 6S Pro", bought: "£47", sold: "£135", profit: "+£88" },
    { item: "Nike Air Zoom Alphafly", bought: "£7.50", sold: "£65", profit: "+£57.50" },
    { item: "Timberland Premium Boots", bought: "£10", sold: "£70", profit: "+£60" },
  ];

  const testimonials = [
    "Locked in £250 profit in one week. Setup took no time — pings started flying in instantly.",
    "The autobuy is super overpowered. Winning things I'd never get before. Literally a money printer.",
    "Don't waste hours searching manually. I get notified the second an item is uploaded. Game changer.",
    "Way more effective than other monitors. As a lifetime member — huge profits to be made.",
  ];

  const features = [
    {
      icon: Bell,
      title: "Real-time alerts",
      desc: "Get pinged the second an underpriced item goes live — before anyone else sees it.",
    },
    {
      icon: TrendingUp,
      title: "Below market flagging",
      desc: "The bot automatically identifies items listed well below their market value.",
    },
    {
      icon: Bot,
      title: "Autobuy capability",
      desc: "Selected searches can trigger an automatic purchase — no manual action needed.",
    },
    {
      icon: Zap,
      title: "Minutes to set up",
      desc: "Full setup support from the team. Alerts start flying in almost immediately.",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-5xl px-6 py-16">

        {/* Hero */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm text-violet-300">
            <ShoppingBag size={14} />
            Aftermarket Arbitrage × Vinted Bot
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            The Vinted Monitor is a{" "}
            <span className="text-violet-400">money printer</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Our bot scans Vinted in real time, flags items listed way below market
            value, and alerts you the second they go live. By the time you find it
            manually — it's already gone.
          </p>

          {/* Lock badge */}
          <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-300">
            <Lock size={15} />
            This is a paid add-on — purchase access below to get started
          </div>
        </div>

        {/* Feature grid */}
        <div className="mb-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Recent flips */}
        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold">
            Spotted by the monitor this week
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {flips.map((flip) => (
              <div
                key={flip.item}
                className="rounded-[20px] border border-white/8 bg-[#071021] p-4"
              >
                <p className="font-medium text-white">{flip.item}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {flip.bought} → {flip.sold}
                  </span>
                  <span className="font-semibold text-emerald-400">
                    {flip.profit}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">
            These deals go fast — the bot catches them first
          </p>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold">
            What beta members are saying
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((t, i) => (
              <div
                key={i}
                className="rounded-[20px] border border-white/8 bg-[#071021] p-5"
              >
                <div className="mb-3 flex gap-0.5">
                  {[...Array(5)].map((_, s) => (
                    <span key={s} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm text-slate-300">"{t}"</p>
                <p className="mt-3 text-xs text-slate-600">— AMA Member</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-16 grid grid-cols-3 gap-4 rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          {[
            { value: "100%", label: "Beta member satisfaction" },
            { value: "£60–£88", label: "Average profit per flip" },
            { value: "2 flips", label: "Covers the full year cost" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="mb-8">
          <h2 className="mb-2 text-center text-3xl font-semibold">
            Get access
          </h2>
          <p className="mb-10 text-center text-slate-400">
            30 beta members tested this. Every single one loved it.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            {/* 6 month */}
            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-8">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                6 month access
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">£69</span>
                <span className="text-slate-500">/ 6 months</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">£11.50/month</p>

              <div className="my-6 space-y-3">
                {[
                  "Real-time Vinted monitor alerts",
                  "Items flagged below market value",
                  "Autobuy on selected searches",
                  "Full setup support from the team",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                      <Check size={11} className="text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-400">{f}</span>
                  </div>
                ))}
              </div>

              <a
                href="#"
                className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Purchase 6 month access — £69
              </a>
              <p className="mt-2 text-center text-xs text-slate-600">
                Payment link coming soon
              </p>
            </div>

            {/* 12 month - recommended */}
            <div className="relative rounded-[24px] border border-violet-500/30 bg-[linear-gradient(180deg,rgba(9,5,30,0.96),rgba(5,3,20,0.92))] p-8 shadow-[0_0_60px_rgba(139,92,246,0.1)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-600 px-4 py-1 text-xs font-semibold text-white">
                  ⭐ Best value
                </span>
              </div>

              <p className="text-xs uppercase tracking-[0.18em] text-violet-400">
                12 month access
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">£99</span>
                <span className="text-slate-500">/ year</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                £8.25/month — save £39 vs 6-month
              </p>

              <div className="my-6 space-y-3">
                {[
                  "Everything in 6 month plan",
                  "Lowest monthly cost",
                  "Pay once, sorted for the year",
                  "Instant pings — seconds after listing",
                ].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15">
                      <Check size={11} className="text-violet-300" />
                    </div>
                    <span className="text-sm text-slate-300">{f}</span>
                  </div>
                ))}
              </div>

              <a
                href="#"
                className="flex w-full items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500"
              >
                Purchase 12 month access — £99
              </a>
              <p className="mt-2 text-center text-xs text-slate-600">
                Payment link coming soon
              </p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 text-center">
          <p className="text-sm text-slate-400">
            Got questions before purchasing? Open a ticket in Discord and the
            team will sort you out.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
