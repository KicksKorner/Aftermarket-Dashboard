import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Check, Lock, Zap } from "lucide-react";

export default async function UpgradePage() {
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

  // Already premium or admin — redirect to dashboard
  if (role === "premium" || role === "admin") redirect("/dashboard");

  const premiumFeatures = [
    "Full Sole Scan access — scan any SKU instantly",
    "Trainer flip analysis and profit estimates",
    "Priority access to new tools as they launch",
    "All future Premium-locked features included",
  ];

  const memberFeatures = [
    "AIO Tracker — inventory, profit & ROI",
    "Expenses tracker with CSV export",
    "Gmail Sync for order imports",
    "Guides library and training walkthroughs",
    "Deal alerts via Discord",
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.12),transparent_40%)]" />

      <div className="relative mx-auto max-w-5xl px-6 py-16">
        <div className="mb-3 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
            <Zap size={14} />
            Upgrade your membership
          </div>
        </div>

        <h1 className="mb-4 text-center text-5xl font-semibold tracking-tight">
          Unlock Premium Access
        </h1>
        <p className="mx-auto mb-16 max-w-2xl text-center text-lg text-slate-400">
          Get full access to Sole Scan and every Premium feature we release — all in one place.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Member plan - current */}
          <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-8">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                Current plan
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Member</h2>
              <p className="mt-1 text-sm text-slate-400">
                Standard membership access
              </p>
            </div>

            <div className="space-y-3">
              {memberFeatures.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Check size={11} className="text-slate-400" />
                  </div>
                  <span className="text-sm text-slate-400">{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-slate-500">
              Your current plan
            </div>
          </div>

          {/* Premium plan */}
          <div className="relative rounded-[24px] border border-blue-500/30 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_60px_rgba(44,91,255,0.1)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                <Zap size={11} />
                Premium
              </span>
            </div>

            <div className="mb-6">
              <p className="text-xs uppercase tracking-[0.18em] text-blue-400">
                Upgrade to
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Premium</h2>
              <p className="mt-1 text-sm text-slate-400">
                Everything in Member, plus:
              </p>
            </div>

            <div className="space-y-3">
              {premiumFeatures.map((f) => (
                <div key={f} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/15">
                    <Check size={11} className="text-blue-300" />
                  </div>
                  <span className="text-sm text-slate-200">{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3">
              <div className="rounded-[20px] border border-blue-500/20 bg-blue-500/10 p-4 text-center">
                <p className="text-sm text-slate-400">
                  To upgrade, contact us via Discord or reach out to an admin.
                  Once upgraded your access will be enabled immediately.
                </p>
              </div>

              <Link
                href="/dashboard"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Locked features preview */}
        <div className="mt-12">
          <h3 className="mb-4 text-center text-lg font-semibold text-slate-300">
            What you're unlocking
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Sole Scan",
                desc: "Scan any trainer SKU and get instant flip analysis, profit estimates and market data.",
              },
              {
                title: "Future Premium Tools",
                desc: "Every new Premium feature we build is automatically included — no extra cost.",
              },
              {
                title: "Priority Access",
                desc: "Premium members get early access to new tools before they roll out to all members.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <Lock size={16} />
                </div>
                <h4 className="font-semibold">{item.title}</h4>
                <p className="mt-2 text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
