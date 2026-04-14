import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowRight } from "lucide-react";

export default async function GuidesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: guides } = await supabase
    .from("guides")
    .select("id, title, slug, summary, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Guides Library</h1>
            <p className="mt-1 text-sm text-slate-400">
              Training, walkthroughs and setup guides for members.
            </p>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-[#0a1228] px-4 py-2 text-sm">
          <span className="text-slate-500">Total guides: </span>
          <span className="font-semibold text-white">{guides?.length ?? 0}</span>
        </div>
      </section>

      {/* Guides grid */}
      {!guides || guides.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] py-20 text-center">
          <BookOpen size={36} className="mb-4 text-slate-600" />
          <p className="text-lg font-semibold text-white">No guides yet</p>
          <p className="mt-2 text-sm text-slate-400">
            Check back soon — guides will appear here as they're added.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((guide) => (
            <Link
              key={guide.id}
              href={`/guides/${guide.slug}`}
              className="group flex flex-col rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6 transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_20px_50px_rgba(30,64,175,0.14)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                <BookOpen size={18} />
              </div>

              <h2 className="text-lg font-semibold leading-tight text-white">
                {guide.title}
              </h2>

              {guide.summary && (
                <p className="mt-3 flex-1 text-sm text-slate-400 leading-relaxed">
                  {guide.summary}
                </p>
              )}

              <div className="mt-5 flex items-center gap-1.5 text-sm font-medium text-blue-400 transition group-hover:text-blue-300">
                Read guide
                <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
