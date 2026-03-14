import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute left-1/2 top-32 h-72 w-72 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl items-center justify-center px-6 py-16">
        <div className="w-full max-w-5xl text-center">
          <div className="relative mx-auto mb-8 flex w-fit items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl" />
            <Image
              src="/logo.png"
              alt="Aftermarket Arbitrage"
              width={170}
              height={170}
              className="relative mx-auto"
              priority
            />
          </div>

          <div className="mb-6 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-sm text-blue-300">
            Aftermarket Arbitrage
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Members Dashboard
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg text-slate-400 sm:text-xl">
            Private access for members, guides, links, tools, and future premium
            features in one clean platform.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/login"
              className="rounded-2xl bg-blue-600 px-8 py-4 text-base font-medium text-white transition hover:bg-blue-500"
            >
              Member Login
            </Link>

            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white transition hover:bg-white/10"
            >
              View Dashboard
            </Link>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="mb-4 h-11 w-11 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
              <h3 className="text-xl font-semibold">Private Member Access</h3>
              <p className="mt-3 text-sm text-slate-400">
                Protected login, gated content, and a cleaner member experience.
              </p>
            </div>

            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="mb-4 h-11 w-11 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
              <h3 className="text-xl font-semibold">Guides and Links</h3>
              <p className="mt-3 text-sm text-slate-400">
                Keep your most important resources and training all in one place.
              </p>
            </div>

            <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
              <div className="mb-4 h-11 w-11 rounded-2xl border border-blue-500/20 bg-blue-500/10" />
              <h3 className="text-xl font-semibold">Built to Expand</h3>
              <p className="mt-3 text-sm text-slate-400">
                Ready for Pro tools, SKU systems, trackers, and more later.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}