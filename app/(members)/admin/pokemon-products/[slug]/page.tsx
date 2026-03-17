import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AdminSubnav from "@/components/admin-subnav";

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

async function requireAdmin() {
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

  return supabase;
}

export default async function AdminPokemonSetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const set = sets.find((item) => item.slug === slug);

  if (!set) {
    return (
      <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-red-200">
          Set not found.
        </div>
      </main>
    );
  }

  const supabase = await requireAdmin();

  async function addProduct(formData: FormData) {
    "use server";

    const supabase = await requireAdmin();

    const name = String(formData.get("name") || "").trim();
    const image_url = String(formData.get("image_url") || "").trim();
    const current_price_gbp = String(formData.get("current_price_gbp") || "").trim();
    const cardmarket_product_id = String(
      formData.get("cardmarket_product_id") || ""
    ).trim();
    const price_source = String(formData.get("price_source") || "manual").trim();

    if (!name) return;

    await supabase.from("pokemon_products").insert({
      set_slug: slug,
      name,
      image_url: image_url || null,
      current_price_gbp: current_price_gbp ? Number(current_price_gbp) : null,
      previous_price_gbp: null,
      source_url: null,
      cardmarket_product_id: cardmarket_product_id || null,
      price_source: cardmarket_product_id ? "cardmarket" : price_source,
      manual_price_override: false,
      sync_status: cardmarket_product_id ? "matched" : "pending",
    });

    revalidatePath(`/admin/pokemon-products/${slug}`);
    revalidatePath(`/pokemon-market-tracker/${slug}`);
  }

  async function updateProduct(formData: FormData) {
    "use server";

    const supabase = await requireAdmin();

    const id = String(formData.get("id") || "");
    const name = String(formData.get("name") || "").trim();
    const image_url = String(formData.get("image_url") || "").trim();
    const current_price_gbp = String(formData.get("current_price_gbp") || "").trim();
    const cardmarket_product_id = String(
      formData.get("cardmarket_product_id") || ""
    ).trim();
    const price_source = String(formData.get("price_source") || "manual").trim();
    const manual_price_override = formData.get("manual_price_override") === "on";

    if (!id || !name) return;

    await supabase
      .from("pokemon_products")
      .update({
        name,
        image_url: image_url || null,
        current_price_gbp: current_price_gbp ? Number(current_price_gbp) : null,
        cardmarket_product_id: cardmarket_product_id || null,
        price_source: cardmarket_product_id ? "cardmarket" : price_source,
        manual_price_override,
        sync_status: cardmarket_product_id ? "matched" : "pending",
      })
      .eq("id", id);

    revalidatePath(`/admin/pokemon-products/${slug}`);
    revalidatePath(`/pokemon-market-tracker/${slug}`);
  }

  async function deleteProduct(formData: FormData) {
    "use server";

    const supabase = await requireAdmin();

    const id = String(formData.get("id") || "");
    if (!id) return;

    await supabase.from("pokemon_products").delete().eq("id", id);

    revalidatePath(`/admin/pokemon-products/${slug}`);
    revalidatePath(`/pokemon-market-tracker/${slug}`);
  }

  const { data: products } = await supabase
    .from("pokemon_products")
    .select("*")
    .eq("set_slug", slug)
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/admin/pokemon-products"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <ArrowLeft size={18} />
            Back to Pokemon Sets
          </Link>
        </div>

        <div className="mb-8 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <p className="text-sm text-blue-300">{set.code}</p>
          <h1 className="mt-2 text-3xl font-semibold">{set.name}</h1>
          <p className="mt-2 text-sm text-slate-400">
            Add, edit and delete tracked products for this set. You can also
            attach a Cardmarket Product ID now so prices can be synced
            automatically later.
          </p>
        </div>

        <AdminSubnav />

        <section className="mt-8 rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus size={18} className="text-emerald-300" />
            <h2 className="text-xl font-semibold">Add New Product</h2>
          </div>

          <form action={addProduct} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Product Name
              </label>
              <input
                name="name"
                placeholder="Pokemon product name"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Image URL
              </label>
              <input
                name="image_url"
                placeholder="https://..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Current Price GBP
              </label>
              <input
                name="current_price_gbp"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Cardmarket Product ID
              </label>
              <input
                name="cardmarket_product_id"
                placeholder="e.g. 123456"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:opacity-90"
              >
                Add Product
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
            <span className="text-blue-400">✦</span>
            <h2>Existing Products</h2>
          </div>

          {!products?.length ? (
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-slate-400">
              No products found for this set yet.
            </div>
          ) : (
            <div className="space-y-5">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[#071021]"
                >
                  <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
                    <div className="border-b border-white/10 bg-[#081120] lg:border-b-0 lg:border-r">
                      {product.image_url ? (
                        <Image
                          src={product.image_url}
                          alt={product.name}
                          width={600}
                          height={500}
                          className="h-full min-h-[220px] w-full object-cover"
                        />
                      ) : (
                        <div className="flex min-h-[220px] items-center justify-center text-slate-500">
                          No image yet
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <form action={updateProduct} className="grid gap-4 xl:grid-cols-3">
                        <input type="hidden" name="id" value={product.id} />
                        <input type="hidden" name="price_source" value="manual" />

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Product Name
                          </label>
                          <input
                            name="name"
                            defaultValue={product.name ?? ""}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Image URL
                          </label>
                          <input
                            name="image_url"
                            defaultValue={product.image_url ?? ""}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Current Price GBP
                          </label>
                          <input
                            name="current_price_gbp"
                            type="number"
                            step="0.01"
                            defaultValue={product.current_price_gbp ?? ""}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-300">
                            Cardmarket Product ID
                          </label>
                          <input
                            name="cardmarket_product_id"
                            defaultValue={product.cardmarket_product_id ?? ""}
                            placeholder="e.g. 123456"
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none"
                          />
                        </div>

                        <div className="flex items-end">
                          <label className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                            <input
                              type="checkbox"
                              name="manual_price_override"
                              defaultChecked={Boolean(product.manual_price_override)}
                              className="h-4 w-4"
                            />
                            Manual price override
                          </label>
                        </div>

                        <div className="flex flex-col justify-end">
                          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                            <div>Status: {product.sync_status ?? "pending"}</div>
                            <div className="mt-1">
                              Last sync:{" "}
                              {product.last_price_sync_at
                                ? new Date(product.last_price_sync_at).toLocaleString("en-GB")
                                : "-"}
                            </div>
                          </div>
                        </div>

                        <div className="xl:col-span-3 flex flex-wrap gap-3 pt-2">
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-black transition hover:opacity-90"
                          >
                            <Save size={16} />
                            Save Changes
                          </button>
                        </div>
                      </form>

                      <form action={deleteProduct} className="mt-3">
                        <input type="hidden" name="id" value={product.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                        >
                          <Trash2 size={16} />
                          Delete Product
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}