import { createClient } from "@/lib/supabase/server";

export default async function GuidesPage() {
  const supabase = await createClient();

  const { data: guides } = await supabase
    .from("guides")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-semibold">Guides</h1>
      <p className="mt-2 text-slate-400">Training and reference material for members.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {guides?.map((guide) => (
          <div
            key={guide.id}
            className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-5"
          >
            <h3 className="text-xl font-semibold">{guide.title}</h3>
            <p className="mt-3 text-sm text-slate-400">{guide.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}