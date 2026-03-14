"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

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

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Account created. You can now log in.");
    setLoading(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-16">
        <div className="grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_520px]">
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
                <div className="rounded-[22px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <div className="mb-4 h-10 w-10 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
                  <h3 className="text-base font-semibold">Private Access</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Secure member login.
                  </p>
                </div>

                <div className="rounded-[22px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <div className="mb-4 h-10 w-10 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
                  <h3 className="text-base font-semibold">Guides</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Training in one place.
                  </p>
                </div>

                <div className="rounded-[22px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
                  <div className="mb-4 h-10 w-10 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
                  <h3 className="text-base font-semibold">Tools</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Built to expand later.
                  </p>
                </div>
              </div>
            </div>
          </section>

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

            {message ? (
              <p className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {message}
              </p>
            ) : null}

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