import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSubnav from "@/components/admin-subnav";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <p className="text-sm text-blue-300">Aftermarket Arbitrage</p>
          <h1 className="mt-2 text-3xl font-semibold">Admin Overview</h1>
          <p className="mt-2 text-sm text-slate-400">{user.email}</p>
        </div>

        <AdminSubnav />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/admin/deal-formatter"
            className="rounded-[24px] border border-violet-500/20 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-violet-400/30"
          >
            <h2 className="text-xl font-semibold">🪄 AI Deal Formatter</h2>
            <p className="mt-2 text-sm text-slate-400">
              Paste raw deal info — Claude rewrites it into a polished Discord embed.
            </p>
          </Link>

          <Link
            href="/admin/guides"
            className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-blue-400/30"
          >
            <h2 className="text-xl font-semibold">📝 Guide Creation</h2>
            <p className="mt-2 text-sm text-slate-400">
              Write and edit guides. They appear under Guides in the sidebar.
            </p>
          </Link>

          <Link
            href="/admin/lead-tracker"
            className="rounded-[24px] border border-emerald-500/20 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-emerald-400/30"
          >
            <h2 className="text-xl font-semibold">📊 Lead Tracker</h2>
            <p className="mt-2 text-sm text-slate-400">
              How many leads each staff member has posted with the Deal Formatter, for wages.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}



