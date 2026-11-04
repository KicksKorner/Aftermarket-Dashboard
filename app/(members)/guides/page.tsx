import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, ArrowRight, Clock } from "lucide-react";

// Cycles through accent colours for visual variety across cards
const ACCENT_COLORS = [
  "from-blue-500 to-indigo-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-cyan-500",
  "from-orange-500 to-amber-500",
  "from-rose-500 to-pink-500",
  "from-sky-500 to-blue-400",
];

const ICON_COLORS = [
  "border-blue-500/20 bg-blue-500/10 text-blue-400",
  "border-violet-500/20 bg-violet-500/10 text-violet-400",
  "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  "border-orange-500/20 bg-orange-500/10 text-orange-400",
  "border-rose-500/20 bg-rose-500/10 text-rose-400",
  "border-sky-500/20 bg-sky-500/10 text-sky-400",
];

function estimateReadTime(content?: string | null): string {
  if (!content) return "~1 min";
  const words = content.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `~${mins} min read`;
}

function isNew(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const diff = Date.now() - new Date(createdAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000; // within last 7 days
}

export default async function GuidesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: guides } = await supabase
    .from("guides")
    .select("id, title, slug, summary, content, created_at")
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
            Check back soon — guides will appear here as they&apos;re added.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guides.map((guide, i) => {
            const accent = ACCENT_COLORS[i % ACCENT_COLORS.length];
            const iconColor = ICON_COLORS[i % ICON_COLORS.length];
            const readTime = estimateReadTime(guide.content);
            const showNew = isNew(guide.created_at);

            return (
              <Link
                key={guide.id}
                href={`/guides/${guide.slug}`}
                className="group flex flex-col rounded-[24px] border border-white/[0.07] bg-[linear-gradient(160deg,rgba(9,18,46,0.95),rgba(3,8,20,0.98))] overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-blue-400/25 hover:shadow-[0_20px_50px_rgba(30,64,175,0.15)]"
              >
                {/* Coloured accent bar */}
                <div className={`h-[3px] w-full bg-gradient-to-r ${accent}`} />

                <div className="flex flex-col flex-1 p-6">
                  {/* Icon row */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${iconColor}`}>
                      <BookOpen size={16} />
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-500">
                      <Clock size={10} />
                      {readTime}
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-[15px] font-semibold leading-snug text-white">
                    {guide.title}
                  </h2>

                  {/* Summary */}
                  {guide.summary && (
                    <p className="mt-2.5 flex-1 text-sm text-slate-400 leading-relaxed line-clamp-3">
                      {guide.summary}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-blue-400 transition group-hover:text-blue-300">
                      Read guide
                      <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
                    </span>
                    {showNew && (
                      <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        New
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
