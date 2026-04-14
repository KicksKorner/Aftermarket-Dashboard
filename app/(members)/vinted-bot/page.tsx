import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, Lock, ShoppingBag, Zap, TrendingUp, Bell, Bot, ExternalLink } from "lucide-react";

export default async function VintedBotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "member";
  const isUnlocked = role === "premium" || role === "admin";

  // ── PREMIUM / ADMIN VIEW ──────────────────────────────────────────────────
  if (isUnlocked) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.12),transparent_40%)]" />

        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          {/* Success badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-5 py-2 text-sm font-medium text-emerald-300">
            <Check size={15} />
            You have Vinted Bot access
          </div>

          <h1 className="mb-4 text-4xl font-semibold tracking-tight">
            You're all set — head to Discord
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-slate-400">
            Your Vinted Bot access is active. The bot runs directly inside your Discord server — head over there to start getting alerts and making profit.
          </p>

          {/* Discord CTA */}
          <div className="mb-8 overflow-hidden rounded-[24px] border border-violet-500/20 bg-[linear-gradient(180deg,rgba(9,5,30,0.96),rgba(5,3,20,0.92))] p-8">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                <svg width="32" height="32" viewBox="0 0 127.14 96.36" fill="currentColor">
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
              </div>
            </div>
            <h2 className="mb-2 text-2xl font-semibold">Open Discord</h2>
            <p className="mb-6 text-sm text-slate-400">
              The Vinted Bot is waiting for you in the Aftermarket Arbitrage Discord server. Use the bot commands to set up your searches and start receiving alerts instantly.
            </p>
            <a
              href="https://discord.gg/your-invite-link"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#5865F2] px-8 py-3.5 text-base font-semibold text-white transition hover:bg-[#4752C4]"
            >
              <ExternalLink size={16} />
              Go to Discord Server
            </a>
          </div>

          {/* Quick tips */}
          <div className="grid gap-4 text-left sm:grid-cols-3">
            {[
              { icon: Bell, title: "Real-time alerts", desc: "Pings arrive seconds after an item is listed on Vinted." },
              { icon: Bot, title: "One-click buying", desc: "Purchase instantly from your phone or desktop — no delays." },
              { icon: TrendingUp, title: "Track your wins", desc: "Log sales in the AIO Tracker to watch your profit grow." },
            ].map((tip) => {
              const Icon = tip.icon;
              return (
                <div key={tip.title} className="rounded-[20px] border border-violet-500/15 bg-[#071021] p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                    <Icon size={16} />
                  </div>
                  <h3 className="mb-1 text-sm font-semibold text-white">{tip.title}</h3>
                  <p className="text-xs text-slate-400">{tip.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Not signed up yet link */}
          <div className="mt-8 rounded-2xl border border-white/8 bg-white/5 px-6 py-4 text-sm text-slate-400">
            Haven't signed up for the Vinted Bot yet?{" "}
            <Link href="/vinted-bot/pricing" className="font-medium text-violet-400 underline hover:text-violet-300">
              See why you should →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── MEMBER VIEW (upgrade/pricing page) ───────────────────────────────────
  const flips = [
    { item: "Nike Air Max 95", bought: "£10", sold: "£85", profit: "+£75" },
    { item: "Garmin Fénix 6S Pro", bought: "£47", sold: "£135", profit: "+£88" },
    { item: "Nike Air Zoom Alphafly", bought: "£7.50", sold: "£65", profit: "+£57.50" },
    { item: "Timberland Premium Boots", bought: "£10", sold: "£70", profit: "+£60" },
  ];

  const testimonials = [
    "Locked in £250 profit in one week. Setup took no time — pings started flying in instantly.",
    "One click and it's bought. By the time I'd have found it manually it would've been gone.",
    "Don't waste hours searching manually. I get notified the second an item is uploaded. Game changer.",
    "Way more effective than other monitors. As a lifetime member — huge profits to be made.",
  ];

  const features = [
    { icon: Bell, title: "Real-time alerts", desc: "Get pinged the second an underpriced item goes live — before anyone else sees it." },
    { icon: TrendingUp, title: "Below market flagging", desc: "The bot automatically identifies items listed well below their market value." },
    { icon: Bot, title: "One-click buying", desc: "Every item can be purchased instantly with a single tap — on mobile or desktop. No delays, no missing out." },
    { icon: Zap, title: "Minutes to set up", desc: "Full setup support from the team. Alerts start flying in almost immediately." },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-5xl px-6 py-16">
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
            Our bot scans Vinted in real time, flags items listed way below market value, and alerts you the second they go live. By the time you find it manually — it's already gone.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-5 py-3 text-sm font-medium text-amber-300">
            <Lock size={15} />
            This is a paid add-on — purchase access below to get started
          </div>
        </div>

        <div className="mb-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold">Spotted by the monitor this week</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {flips.map((flip) => (
              <div key={flip.item} className="rounded-[20px] border border-white/8 bg-[#071021] p-4">
                <p className="font-medium text-white">{flip.item}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{flip.bought} → {flip.sold}</span>
                  <span className="font-semibold text-emerald-400">{flip.profit}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-slate-600">These deals go fast — the bot catches them first</p>
        </div>

        <div className="mb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold">What members are saying</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {testimonials.map((t, i) => (
              <div key={i} className="rounded-[20px] border border-white/8 bg-[#071021] p-5">
                <div className="mb-3 flex gap-0.5">{[...Array(5)].map((_, s) => <span key={s} className="text-sm text-amber-400">★</span>)}</div>
                <p className="text-sm text-slate-300">"{t}"</p>
                <p className="mt-3 text-xs text-slate-600">— AMA Member</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16 grid grid-cols-3 gap-4 rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          {[
            { value: "10+", label: "Members already using this" },
            { value: "£20–£30", label: "Average profit per flip" },
            { value: "3 flips", label: "Covers the full year cost" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-xs text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="mb-2 text-center text-3xl font-semibold">Get access</h2>
          <p className="mb-10 text-center text-slate-400">Simple pricing, no hidden fees.</p>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-7">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">6 month access</p>
              <div className="mt-3 flex items-baseline gap-2"><span className="text-4xl font-semibold">£79</span><span className="text-slate-500">/ 6 months</span></div>
              <p className="mt-1 text-sm text-slate-500">£13.17/month</p>
              <div className="my-6 space-y-3">
                {["Real-time Vinted monitor alerts","Items flagged below market value","One-click buying on any device","Full setup support from the team"].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5"><Check size={11} className="text-slate-400" /></div>
                    <span className="text-sm text-slate-400">{f}</span>
                  </div>
                ))}
              </div>
              <a href="#" className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">Purchase 6 months — £79</a>
              <p className="mt-2 text-center text-xs text-slate-600">Payment link coming soon</p>
            </div>

            <div className="relative rounded-[24px] border border-violet-500/30 bg-[linear-gradient(180deg,rgba(9,5,30,0.96),rgba(5,3,20,0.92))] p-7 shadow-[0_0_60px_rgba(139,92,246,0.1)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-600 px-4 py-1 text-xs font-semibold text-white">⭐ Best value</span>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-violet-400">12 month access</p>
              <div className="mt-3 flex items-baseline gap-2"><span className="text-4xl font-semibold">£109</span><span className="text-slate-500">/ year</span></div>
              <p className="mt-1 text-sm text-slate-500">£9.08/month — save £49 vs 6-month twice</p>
              <div className="my-6 space-y-3">
                {["Everything in 6 month plan","Lowest monthly cost","Pay once, sorted for the year","Instant pings — seconds after listing"].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/15"><Check size={11} className="text-violet-300" /></div>
                    <span className="text-sm text-slate-300">{f}</span>
                  </div>
                ))}
              </div>
              <a href="#" className="flex w-full items-center justify-center rounded-2xl bg-violet-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-violet-500">Purchase 12 months — £109</a>
              <p className="mt-2 text-center text-xs text-slate-600">Payment link coming soon</p>
            </div>

            <div className="relative rounded-[24px] border border-amber-500/25 bg-[linear-gradient(180deg,rgba(20,14,5,0.96),rgba(12,8,3,0.92))] p-7 shadow-[0_0_60px_rgba(245,158,11,0.07)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-4 py-1 text-xs font-semibold text-amber-300">💜 Lifetime exclusive</span>
              </div>
              <p className="text-xs uppercase tracking-[0.18em] text-amber-500">Lifetime members only</p>
              <div className="mt-3 flex items-baseline gap-2"><span className="text-4xl font-semibold">£69</span><span className="text-slate-500">/ year</span></div>
              <div className="mt-1 flex items-center gap-2"><span className="text-sm text-slate-500">Locked in for life</span><span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400 line-through">£109</span></div>
              <div className="my-6 space-y-3">
                {["Everything in 12 month plan","40% off — exclusively for you","Rate locked permanently","Priority support from the team"].map((f) => (
                  <div key={f} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10"><Check size={11} className="text-amber-400" /></div>
                    <span className="text-sm text-slate-300">{f}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-amber-500/15 bg-amber-500/8 p-3 text-center text-xs text-amber-300/80">
                This rate is never going public. You'll receive your private access link separately.
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 text-center">
          <p className="text-sm text-slate-400">Got questions before purchasing? Open a ticket in Discord and the team will sort you out.</p>
          <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10">Back to Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
