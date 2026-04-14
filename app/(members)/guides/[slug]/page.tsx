import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

type Props = {
  params: Promise<{ slug: string }>;
};

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs font-mono text-blue-300">$1</code>');
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="mt-8 mb-3 text-xl font-semibold text-white">
          {line.replace("## ", "")}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="mt-6 mb-2 text-base font-semibold text-white">
          {line.replace("### ", "")}
        </h3>
      );
    } else if (line.trim() === "---") {
      elements.push(<hr key={key++} className="my-6 border-white/10" />);
    } else if (line.startsWith("- ")) {
      const text = line.replace("- ", "");
      elements.push(
        <div key={key++} className="flex items-start gap-2 text-sm text-slate-300 leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
          <span dangerouslySetInnerHTML={{ __html: formatInline(text) }} />
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm text-slate-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: formatInline(line) }}
        />
      );
    }
  }

  return elements;
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: guide } = await supabase
    .from("guides")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!guide) notFound();

  const createdAt = guide.created_at
    ? new Date(guide.created_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/guides"
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <ArrowLeft size={15} />
        Back to Guides
      </Link>

      <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)]">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <BookOpen size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {guide.title}
            </h1>
            {guide.summary && (
              <p className="mt-2 text-sm text-slate-400">{guide.summary}</p>
            )}
            {createdAt && (
              <p className="mt-3 text-xs text-slate-600">Added {createdAt}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] px-7 py-7">
        {guide.content ? (
          <div className="space-y-1">
            {renderContent(guide.content)}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No content yet.</p>
        )}
      </section>

      <Link
        href="/guides"
        className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
      >
        <ArrowLeft size={15} />
        Back to Guides
      </Link>
    </div>
  );
}
