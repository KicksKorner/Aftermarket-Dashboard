import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";

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

  const role = profile?.role ?? "member";
  const email = user.email ?? "";

  // Admin-only portal: everyone else is signed out and bounced to login.
  if (role !== "admin") {
    redirect("/auth/denied");
  }

  return (
    <div className="min-h-screen bg-[#030814] text-white lg:grid lg:grid-cols-[270px_minmax(0,1fr)]">
      <Sidebar role={role} email={email} />

      <main className="min-w-0 overflow-x-hidden px-4 pb-6 pt-20 sm:px-5 lg:px-8 lg:pb-8 lg:pt-6">
        {children}
      </main>
    </div>
  );
}