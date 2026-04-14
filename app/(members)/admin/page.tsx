import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSubnav from "@/components/admin-subnav";

export default async function AdminOverviewPage() {
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
            href="/dashboard/deal-post"
            className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-blue-400/30"
          >
            <h2 className="text-xl font-semibold">Deal Poster</h2>
            <p className="mt-2 text-sm text-slate-400">
              Post clean deal alerts to Discord.
            </p>
          </Link>

          <Link
            href="/dashboard/ama-webhook"
            className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-blue-400/30"
          >
            <h2 className="text-xl font-semibold">AMA Webhook</h2>
            <p className="mt-2 text-sm text-slate-400">
              Manage and trigger AMA webhook notifications.
            </p>
          </Link>

          <Link
            href="/admin/guides"
            className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 transition hover:-translate-y-0.5 hover:border-blue-400/30"
          >
            <h2 className="text-xl font-semibold">Guides</h2>
            <p className="mt-2 text-sm text-slate-400">
              Create and update member training guides.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
