import Link from "next/link";
import { ArrowLeft, BarChart3 } from "lucide-react";

const sets = [
  { name: "Scarlet & Violet Base Set", code: "SV1", slug: "sv1-base-set" },
  { name: "Paldea Evolved", code: "SV2", slug: "paldea-evolved" },
  { name: "Obsidian Flames", code: "SV3", slug: "obsidian-flames" },
  { name: "151", code: "SV3.5", slug: "151" },
  { name: "Paradox Rift", code: "SV4", slug: "paradox-rift" },
  { name: "Paldean Fates", code: "SV4.5", slug: "paldean-fates" },
  { name: "Temporal Forces", code: "SV5", slug: "temporal-forces" },
  { name: "Twilight Masquerade", code: "SV6", slug: "twilight-masquerade" },
  { name: "Shrouded Fable", code: "SV6.5", slug: "shrouded-fable" },
  { name: "Stellar Crown", code: "SV7", slug: "stellar-crown" },
  { name: "Surging Sparks", code: "SV8", slug: "surging-sparks" },
  { name: "Prismatic Evolutions", code: "SV8.5", slug: "prismatic-evolutions" },
  { name: "Journey Together", code: "SV9", slug: "journey-together" },
  { name: "Destined Rivals", code: "SV10", slug: "destined-rivals" },
  { name: "Black Bolt", code: "SV10.5", slug: "black-bolt" },
  { name: "White Flare", code: "SV10.5", slug: "white-flare" },
  {
    name: "Mega Evolution: Base Set",
    code: "ME1",
    slug: "mega-evolution-base-set",
  },
  {
    name: "Mega Evolution: Phantasmal Flames",
    code: "ME2",
    slug: "mega-evolution-phantasmal-flames",
  },
  {
    name: "Mega Evolution: Ascended Heroes",
    code: "ME2.5",
    slug: "mega-evolution-ascended-heroes",
  },
  {
    name: "Mega Evolution: Perfect Order",
    code: "ME3",
    slug: "mega-evolution-perfect-order",
  },
];

function PokeballIcon() {
  return (
    <div className="relative h-8 w-8">
      <div className="absolute inset-0 overflow-hidden rounded-full border border-white/20">
        <div className="h-1/2 bg-red-500/90" />
        <div className="h-1/2 bg-white" />
      </div>
      <div className="absolute left-0 right-0 top-1/2 h-[2px] -translate-y-1/2 bg-slate-900" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900 bg-white shadow-[0_0_0_2px_rgba(3,8,20,0.9)]" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900" />
    </div>
  );
}

export default function PokemonMarketTrackerPage() {
  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <ArrowLeft size={18} />
          Return to Dashboard
        </Link>
      </div>

      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <BarChart3 size={24} />
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Pokemon Market Tracker
            </h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Track products by Pokémon set. Choose a set below to manage
              products now, and later add live market value tracking.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
          <span className="text-blue-400">✦</span>
          <h2>Set Categories</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {sets.map((set) => (
            <Link
              key={set.slug}
              href={`/pokemon-market-tracker/${set.slug}`}
              className="group rounded-xl border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] px-4 py-4 transition duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:shadow-[0_10px_25px_rgba(30,64,175,0.12)]"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-1.5">
                  <PokeballIcon />
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-300">
                  {set.code}
                </p>
              </div>

              <h3 className="text-sm font-semibold leading-tight text-white">
                {set.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}