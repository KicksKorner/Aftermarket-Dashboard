import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminSubnav from "@/app/components/admin-subnav";

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

async function addLink(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const title = String(formData.get("title") || "");
  const image_url = String(formData.get("image_url") || "");
  const amazon_url = String(formData.get("amazon_url") || "");
  const priceValue = String(formData.get("price_gbp") || "");
  const price_gbp = priceValue ? Number(priceValue) : null;

  if (!title || !amazon_url) return;

  await supabase.from("links").insert({
    title,
    image_url,
    amazon_url,
    price_gbp,
  });

  revalidatePath("/admin/amazon-invites");
  revalidatePath("/links");
  revalidatePath("/dashboard");
}

async function updateLink(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") || "");
  const image_url = String(formData.get("image_url") || "");
  const amazon_url = String(formData.get("amazon_url") || "");
  const priceValue = String(formData.get("price_gbp") || "");
  const price_gbp = priceValue ? Number(priceValue) : null;

  if (!id || !title || !amazon_url) return;

  await supabase
    .from("links")
    .update({
      title,
      image_url,
      amazon_url,
      price_gbp,
    })
    .eq("id", id);

  revalidatePath("/admin/amazon-invites");
  revalidatePath("/links");
  revalidatePath("/dashboard");
}

async function deleteLink(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  if (!id) return;

  await supabase.from("links").delete().eq("id", id);

  revalidatePath("/admin/amazon-invites");
  revalidatePath("/links");
  revalidatePath("/dashboard");
}

export default async function AdminAmazonInvitesPage() {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: links } = await supabase
    .from("links")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Amazon Invites</h1>
        </div>

        <AdminSubnav />

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Add New Product Link</h2>

          <form action={addLink} className="mt-6 grid gap-4">
            <input
              name="title"
              placeholder="Product title"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="image_url"
              placeholder="Image URL"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="price_gbp"
              type="number"
              step="0.01"
              placeholder="Price in £"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="amazon_url"
              placeholder="Amazon product URL"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />

            <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
              Add Product Link
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Edit Existing Product Links</h2>

          <div className="mt-6 space-y-6">
            {links?.map((link) => (
              <div
                key={link.id}
                className="rounded-[24px] border border-white/10 bg-[#030814] p-5"
              >
                <form action={updateLink} className="grid gap-4">
                  <input type="hidden" name="id" value={link.id} />

                  <input
                    name="title"
                    defaultValue={link.title}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="image_url"
                    defaultValue={link.image_url ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="price_gbp"
                    type="number"
                    step="0.01"
                    defaultValue={link.price_gbp ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="amazon_url"
                    defaultValue={link.amazon_url ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />

                  <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
                    Save Changes
                  </button>
                </form>

                <form action={deleteLink} className="mt-3">
                  <input type="hidden" name="id" value={link.id} />
                  <button className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-medium text-red-300 hover:bg-red-500/20">
                    Delete Link
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