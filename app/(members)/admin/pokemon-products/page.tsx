import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSubnav from "@/components/admin-subnav";
import { ArrowRight, BarChart3 } from "lucide-react";

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

export default async function AdminPokemonProductsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: counts } = await supabase
    .from("pokemon_products")
    .select("set_slug");

  const countMap = new Map<string, number>();

  counts?.forEach((item) => {
    countMap.set(item.set_slug, (countMap.get(item.set_slug) || 0) + 1);
  });

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
              <BarChart3 size={24} />
            </div>

            <div>
              <p className="text-sm text-blue-300">Aftermarket Arbitrage</p>
              <h1 className="mt-2 text-3xl font-semibold">
                Admin Pokemon Products
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Choose a set below to add, edit and delete tracked Pokémon
                products, including product names, images and current market
                values.
              </p>
            </div>
          </div>
        </div>

        <AdminSubnav />

        <section className="mt-8">
          <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
            <span className="text-blue-400">✦</span>
            <h2>Set Categories</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {sets.map((set) => {
              const productCount = countMap.get(set.slug) || 0;

              return (
                <Link
                  key={set.slug}
                  href={`/admin/pokemon-products/${set.slug}`}
                  className="group rounded-[24px] border border-blue-500/15 bg-[#071021] p-5 transition hover:-translate-y-0.5 hover:border-blue-400/30"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <PokeballIcon />
                    </div>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
                      {set.code}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold leading-tight">
                    {set.name}
                  </h3>

                  <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                    <span>{productCount} products</span>
                    <span className="inline-flex items-center gap-1 text-blue-300">
                      Manage <ArrowRight size={16} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}