import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminSubnav from "@/components/admin-subnav";
import { trackedProducts } from "@/lib/tracked-products";

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

async function updateTrackedProductOverride(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const productId = String(formData.get("product_id") || "").trim();
  const imageUrl = String(formData.get("image_url") || "").trim();
  const overridePriceValue = String(formData.get("override_price") || "").trim();

  if (!productId) return;

  const overridePrice =
    overridePriceValue.length > 0 ? Number(overridePriceValue) : null;

  if (
    overridePriceValue.length > 0 &&
    (!Number.isFinite(overridePrice) || overridePrice! < 0)
  ) {
    return;
  }

  await supabase.from("tracked_product_overrides").upsert(
    {
      product_id: productId,
      image_url: imageUrl || null,
      override_price: overridePrice,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "product_id",
    }
  );

  revalidatePath("/admin/tracked-products");
  revalidatePath("/dashboard");
}

async function clearTrackedProductOverride(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const productId = String(formData.get("product_id") || "").trim();
  if (!productId) return;

  await supabase.from("tracked_product_overrides").delete().eq("product_id", productId);

  revalidatePath("/admin/tracked-products");
  revalidatePath("/dashboard");
}

export default async function AdminTrackedProductsPage() {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: overrides } = await supabase
    .from("tracked_product_overrides")
    .select("product_id, image_url, override_price");

  const overridesMap = new Map(
    (overrides ?? []).map((item) => [item.product_id, item])
  );

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Tracked Products</h1>
          <p className="mt-2 text-sm text-slate-400">
            Manage image URLs and manual override prices for your fixed tracked products.
          </p>
        </div>

        <AdminSubnav />

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Edit Tracked Products</h2>

          <div className="mt-6 space-y-6">
            {trackedProducts.map((product) => {
              const override = overridesMap.get(product.id);

              return (
                <div
                  key={product.id}
                  className="rounded-[24px] border border-white/10 bg-[#030814] p-5"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold">{product.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Fallback image: {product.image}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Search query: {product.searchQuery}
                    </p>
                  </div>

                  <form action={updateTrackedProductOverride} className="grid gap-4">
                    <input type="hidden" name="product_id" value={product.id} />

                    <input
                      name="image_url"
                      defaultValue={override?.image_url ?? ""}
                      placeholder="Custom image URL"
                      className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                    />

                    <input
                      name="override_price"
                      type="number"
                      step="0.01"
                      defaultValue={override?.override_price ?? ""}
                      placeholder="Manual override price"
                      className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                    />

                    <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
                      Save Changes
                    </button>
                  </form>

                  <form action={clearTrackedProductOverride} className="mt-3">
                    <input type="hidden" name="product_id" value={product.id} />
                    <button className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-medium text-red-300 hover:bg-red-500/20">
                      Clear Override
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}