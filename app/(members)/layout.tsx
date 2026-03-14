import Sidebar from "@/components/sidebar";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MembersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  return (
    <div className="min-h-screen overflow-hidden bg-[#030814] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(53,86,180,0.08)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(44,91,255,0.18),transparent_35%)]" />

      <div className="relative flex min-h-screen">
        <Sidebar role={profile?.role ?? "member"} email={user.email ?? ""} />

        <main className="flex-1">
          <div className="border-b border-white/10 bg-[#071021]/60 px-8 py-5 backdrop-blur-xl">
            <h2 className="text-xl font-semibold tracking-tight">
              Aftermarket Arbitrage Dashboard
            </h2>
          </div>

          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}