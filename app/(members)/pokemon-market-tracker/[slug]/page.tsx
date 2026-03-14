import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

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

export default async function PokemonSetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const set = sets.find((item) => item.slug === slug);

  if (!set) {
    return (
      <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-red-200">
        Set not found.
      </div>
    );
  }

  const supabase = await createClient();

  const { data: products } = await supabase
    .from("pokemon_products")
    .select("*")
    .eq("set_slug", slug)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-8 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <p className="text-sm text-blue-300">{set.code}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {set.name}
        </h1>
        <p className="mt-3 text-slate-400">
          Products in this set, ready for manual pricing now and live market tracking later.
        </p>
      </section>

      <section>
        <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
          <span className="text-blue-400">✦</span>
          <h2>Tracked Products</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {products?.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.96),rgba(3,8,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
            >
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  width={600}
                  height={500}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center bg-[#071021] text-slate-500">
                  No image yet
                </div>
              )}

              <div className="p-5">
                <h3 className="text-lg font-semibold leading-tight">
                  {product.name}
                </h3>

                {product.current_price_gbp ? (
                  <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                    <span className="text-sm text-blue-300">Current Price </span>
                    <span className="text-2xl font-semibold text-blue-200">
                      £{Number(product.current_price_gbp).toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                    Price not added yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!products?.length ? (
          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/5 p-6 text-slate-400">
            No products found for this set yet.
          </div>
        ) : null}
      </section>
    </div>
  );
}