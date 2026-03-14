import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminSubnav from "@/components/admin-subnav";

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

async function addGuide(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const title = String(formData.get("title") || "");
  const slug = String(formData.get("slug") || "");
  const summary = String(formData.get("summary") || "");
  const content = String(formData.get("content") || "");

  if (!title || !slug) return;

  await supabase.from("guides").insert({
    title,
    slug,
    summary,
    content,
  });

  revalidatePath("/admin/guides");
  revalidatePath("/guides");
  revalidatePath("/dashboard");
}

async function updateGuide(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") || "");
  const slug = String(formData.get("slug") || "");
  const summary = String(formData.get("summary") || "");
  const content = String(formData.get("content") || "");

  if (!id || !title || !slug) return;

  await supabase
    .from("guides")
    .update({
      title,
      slug,
      summary,
      content,
    })
    .eq("id", id);

  revalidatePath("/admin/guides");
  revalidatePath("/guides");
  revalidatePath("/dashboard");
}

async function deleteGuide(formData: FormData) {
  "use server";

  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;

  const id = Number(formData.get("id"));
  if (!id) return;

  await supabase.from("guides").delete().eq("id", id);

  revalidatePath("/admin/guides");
  revalidatePath("/guides");
  revalidatePath("/dashboard");
}

export default async function AdminGuidesPage() {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: guides } = await supabase
    .from("guides")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Guides</h1>
        </div>

        <AdminSubnav />

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Add New Guide</h2>

          <form action={addGuide} className="mt-6 grid gap-4">
            <input
              name="title"
              placeholder="Guide title"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="slug"
              placeholder="guide-slug"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <input
              name="summary"
              placeholder="Short summary"
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />
            <textarea
              name="content"
              placeholder="Guide content"
              rows={6}
              className="rounded-2xl border border-white/10 bg-[#030814] px-4 py-3"
            />

            <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
              Add Guide
            </button>
          </form>
        </section>

        <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="text-2xl font-semibold">Edit Existing Guides</h2>

          <div className="mt-6 space-y-6">
            {guides?.map((guide) => (
              <div
                key={guide.id}
                className="rounded-[24px] border border-white/10 bg-[#030814] p-5"
              >
                <form action={updateGuide} className="grid gap-4">
                  <input type="hidden" name="id" value={guide.id} />

                  <input
                    name="title"
                    defaultValue={guide.title}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="slug"
                    defaultValue={guide.slug}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <input
                    name="summary"
                    defaultValue={guide.summary ?? ""}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />
                  <textarea
                    name="content"
                    defaultValue={guide.content ?? ""}
                    rows={6}
                    className="rounded-2xl border border-white/10 bg-[#071021] px-4 py-3"
                  />

                  <button className="rounded-2xl bg-blue-600 px-4 py-3 font-medium hover:bg-blue-500">
                    Save Changes
                  </button>
                </form>

                <form action={deleteGuide} className="mt-3">
                  <input type="hidden" name="id" value={guide.id} />
                  <button className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-medium text-red-300 hover:bg-red-500/20">
                    Delete Guide
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