"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Lock, BookOpen, Wrench } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignup() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setMessage("Account created. You can now log in.");
    setLoading(false);
  }

  async function handleDiscordLogin() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "identify email",
      },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  const featureCards = [
    {
      icon: Lock,
      title: "Private Access",
      desc: "Secure member login.",
      iconClass: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    },
    {
      icon: BookOpen,
      title: "Guides",
      desc: "Training in one place.",
      iconClass: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    },
    {
      icon: Wrench,
      title: "Tools",
      desc: "Built to expand later.",
      iconClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_520px]">

          {/* Left panel */}
          <section className="hidden lg:flex lg:flex-col lg:justify-center">
            <div className="max-w-xl">
              <div className="relative mb-8 flex w-fit items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl" />
                <Image
                  src="/logo.png"
                  alt="Aftermarket Arbitrage"
                  width={180}
                  height={180}
                  className="relative"
                  priority
                />
              </div>

              <div className="mb-5 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
                Aftermarket Arbitrage
              </div>

              <h1 className="text-5xl font-semibold tracking-tight">
                Member Access
              </h1>

              <p className="mt-6 text-lg text-slate-400">
                Sign in to access your dashboard, guides, private links, and future
                premium tools in one clean platform.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {featureCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.title}
                      className="rounded-[22px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
                    >
                      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border ${card.iconClass}`}>
                        <Icon size={18} />
                      </div>
                      <h3 className="text-base font-semibold">{card.title}</h3>
                      <p className="mt-2 text-sm text-slate-400">{card.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right panel - login form */}
          <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)] sm:p-10">
            <div className="mb-8 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
                Aftermarket Arbitrage
              </div>

              <div className="mb-5 flex justify-center lg:hidden">
                <Image
                  src="/logo.png"
                  alt="Aftermarket Arbitrage"
                  width={110}
                  height={110}
                  priority
                />
              </div>

              <h2 className="text-4xl font-semibold tracking-tight">Member Login</h2>
              <p className="mt-3 text-slate-400">
                Sign in to access your private dashboard.
              </p>
            </div>

            {/* Discord button */}
            <button
              onClick={handleDiscordLogin}
              disabled={loading}
              className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#5865F2] px-4 py-4 text-base font-medium text-white transition hover:bg-[#4752C4] disabled:opacity-50"
            >
              <svg width="22" height="22" viewBox="0 0 127.14 96.36" fill="white">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Continue with Discord
            </button>

            {/* Divider */}
            <div className="relative mb-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-slate-500">or sign in with email</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40"
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#030814] px-4 py-4 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Please wait..." : "Sign in"}
              </button>
            </form>

            <button
              onClick={handleSignup}
              disabled={loading}
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-base font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              Create account
            </button>

            {message && (
              <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </p>
            )}

            <div className="mt-8 text-center text-sm text-slate-400">
              <Link href="/" className="transition hover:text-white">
                Back to homepage
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
