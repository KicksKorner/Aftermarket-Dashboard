import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import AdminSubnav from "@/components/admin-subnav";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

async function setMemberRole(formData: FormData) {
  "use server";
  const { supabase, isAdmin } = await requireAdmin();
  if (!isAdmin) return;
  const memberId = String(formData.get("member_id") || "");
  const newRole = String(formData.get("new_role") || "");
  if (!memberId || !["member", "premium", "admin"].includes(newRole)) return;
  await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
  revalidatePath("/admin/members");
}

const roleBadge: Record<string, string> = {
  admin: "border-red-400/30 bg-red-500/10 text-red-300",
  premium: "border-orange-400/30 bg-orange-500/10 text-orange-300",
  member: "border-white/10 bg-white/5 text-slate-400",
};

export default async function AdminMembersPage() {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role, created_at, discord_id, discord_username")
    .order("created_at", { ascending: false });

  const counts = {
    total: members?.length ?? 0,
    premium: members?.filter((m) => m.role === "premium").length ?? 0,
    admin: members?.filter((m) => m.role === "admin").length ?? 0,
    member: members?.filter((m) => m.role === "member").length ?? 0,
  };

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Members</h1>
          <p className="mt-2 text-sm text-slate-400">Manage member roles and Premium access.</p>
        </div>

        <AdminSubnav />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total members", value: counts.total, color: "text-white" },
            { label: "Premium", value: counts.premium, color: "text-orange-300" },
            { label: "Member", value: counts.member, color: "text-slate-300" },
            { label: "Admin", value: counts.admin, color: "text-red-300" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-5">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{stat.label}</p>
              <p className={`mt-2 text-3xl font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Members list */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
          <h2 className="mb-6 text-xl font-semibold">All Members</h2>

          <div className="space-y-3">
            {members?.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-4 rounded-[20px] border border-white/8 bg-[#030814] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold uppercase text-slate-300">
                    {member.discord_username?.[0] ?? member.email?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {member.email ?? "No email"}
                    </p>
                    {member.discord_username && (
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5865F2]">
                        <svg width="12" height="12" viewBox="0 0 127.14 96.36" fill="currentColor">
                          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                        </svg>
                        {member.discord_username}
                        {member.discord_id && (
                          <span className="text-slate-600">#{member.discord_id.slice(-4)}</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Joined{" "}
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${roleBadge[member.role] ?? roleBadge.member}`}>
                    {member.role ?? "member"}
                  </span>

                  {member.id !== user.id && (
                    <form action={setMemberRole} className="flex flex-wrap gap-2">
                      <input type="hidden" name="member_id" value={member.id} />

                      {member.role !== "premium" && member.role !== "admin" && (
                        <button name="new_role" value="premium"
                          className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300 transition hover:bg-orange-500/20">
                          Grant Premium
                        </button>
                      )}
                      {member.role === "premium" && (
                        <button name="new_role" value="member"
                          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20">
                          Revoke Premium
                        </button>
                      )}
                      {member.role !== "admin" && (
                        <button name="new_role" value="admin"
                          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20">
                          Make Admin
                        </button>
                      )}
                      {member.role === "admin" && (
                        <button name="new_role" value="member"
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/10">
                          Remove Admin
                        </button>
                      )}
                    </form>
                  )}

                  {member.id === user.id && (
                    <span className="text-xs text-slate-600">(you)</span>
                  )}
                </div>
              </div>
            ))}

            {(!members || members.length === 0) && (
              <p className="py-8 text-center text-sm text-slate-500">No members found.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
