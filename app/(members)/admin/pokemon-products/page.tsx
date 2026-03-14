import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminSubnav from "@/app/components/admin-subnav";

const pokemonSets = [
  { name: "Scarlet & Violet Base Set", slug: "sv1-base-set" },
  { name: "Paldea Evolved", slug: "paldea-evolved" },
  { name: "Obsidian Flames", slug: "obsidian-flames" },
  { name: "151", slug: "151" },
  { name: "Paradox Rift", slug: "paradox-rift" },
  { name: "Paldean Fates", slug: "paldean-fates" },
  { name: "Temporal Forces", slug: "temporal-forces" },
  { name: "Twilight Masquerade", slug: "twilight-masquerade" },
  { name: "Shrouded Fable", slug: "shrouded-fable" },
  { name: "Stellar Crown", slug: "stellar-crown" },
  { name: "Surging Sparks", slug: "surging-sparks" },
  { name: "Prismatic Evolutions", slug: "prismatic-evolutions" },
  { name: "Journey Together", slug: "journey-together" },
  { name: "Destined Rivals", slug: "destined-rivals" },
  { name: "Black Bolt", slug: "black-bolt" },
  { name: "White Flare", slug: "white-flare" },
  { name: "Mega Evolution: Base Set", slug: "mega-evolution-base-set" },
  { name: "Mega Evolution: Phantasmal Flames", slug: "mega-evolution-phantasmal-flames" },
  { name: "Mega Evolution: Ascended Heroes", slug: "mega-evolution-ascended-heroes" },
  { name: "Mega Evolution: Perfect Order", slug: "mega-evolution-perfect-order" },
];

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, user: null, isAdmin: false };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    isAdmin: profile?.role === "admin",
  };
}

async function addPokemonProduct(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const set_slug = String(formData.get("set_slug") || "");
  const name = String(formData.get("name") || "");
  const image_url = String(formData.get("image_url") || "");
  const source_url = String(formData.get("source_url") || "");
  const priceValue = String(formData.get("current_price_gbp") || "");
  const current_price_gbp = priceValue ? Number(priceValue) : null;

  if (!set_slug || !name) return;

  await supabase.from("pokemon_products").insert({
    set_slug,
    name,
    image_url,
    source_url,
    current_price_gbp,
  });

  revalidatePath("/admin/pokemon-products");
  revalidatePath("/pokemon-market-tracker");
  revalidatePath(`/pokemon-market-tracker/${set_slug}`);
}

async function updatePokemonProduct(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  const set_slug = String(formData.get("set_slug") || "");
  const name = String(formData.get("name") || "");
  const image_url = String(formData.get("image_url") || "");
  const source_url = String(formData.get("source_url") || "");
  const priceValue = String(formData.get("current_price_gbp") || "");
  const current_price_gbp = priceValue ? Number(priceValue) : null;

  if (!id || !set_slug || !name) return;

  await supabase
    .from("pokemon_products")
    .update({
      set_slug,
      name,
      image_url,
      source_url,
      current_price_gbp,
    })
    .eq("id", id);

  revalidatePath("/admin/pokemon-products");
  revalidatePath("/pokemon-market-tracker");
  revalidatePath(`/pokemon-market-tracker/${set_slug}`);
}

async function deletePokemonProduct(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  const set_slug = String(formData.get("set_slug") || "");

  if (!id) return;

  await supabase.from("pokemon_products").delete().eq("id", id);

  revalidatePath("/admin/pokemon-products");
  revalidatePath("/pokemon-market-tracker");
  if (set_slug) {
    revalidatePath(`/pokemon-market-tracker/${set_slug}`);
  }
}

export default async function AdminPokemonProductsPage() {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: pokemonProducts } = await supabase
    .from("pokemon_products")
    .select("*")
    .order("set_slug", { ascending: true })
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Pokemon Products</h1>
        </div>

        <AdminSubnav />

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Add Pokémon Tracker Product</h2>

          <form action={addPokemonProduct} className="mt-6 grid gap-4">
            <select
              name="set_slug"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
              defaultValue=""
            >
              <option value="" disabled>
                Select set
              </option>
              {pokemonSets.map((set) => (
                <option key={set.slug} value={set.slug}>
                  {set.name}
                </option>
              ))}
            </select>

            <input
              name="name"
              placeholder="Product name"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="image_url"
              placeholder="Image URL"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="current_price_gbp"
              type="number"
              step="0.01"
              placeholder="Current price in £"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="source_url"
              placeholder="Optional source URL"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />

            <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
              Add Tracker Product
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Edit Pokémon Tracker Products</h2>

          <div className="mt-6 space-y-6">
            {pokemonProducts?.map((product) => (
              <div
                key={product.id}
                className="rounded-[24px] border border-white/10 bg-[#030814] p-5"
              >
                <form action={updatePokemonProduct} className="grid gap-4">
                  <input type="hidden" name="id" value={product.id} />

                  <select
                    name="set_slug"
                    defaultValue={product.set_slug}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  >
                    {pokemonSets.map((set) => (
                      <option key={set.slug} value={set.slug}>
                        {set.name}
                      </option>
                    ))}
                  </select>

                  <input
                    name="name"
                    defaultValue={product.name}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="image_url"
                    defaultValue={product.image_url ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="current_price_gbp"
                    type="number"
                    step="0.01"
                    defaultValue={product.current_price_gbp ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="source_url"
                    defaultValue={product.source_url ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />

                  <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
                    Save Changes
                  </button>
                </form>

                <form action={deletePokemonProduct} className="mt-3">
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="set_slug" value={product.set_slug} />
                  <button className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-medium text-red-300 hover:bg-red-500/20">
                    Delete Product
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}