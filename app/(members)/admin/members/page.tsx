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
  admin:
    "border-amber-400/30 bg-amber-500/10 text-amber-300",
  premium:
    "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  member:
    "border-white/10 bg-white/5 text-slate-400",
};

export default async function AdminMembersPage() {
  const { supabase, user, isAdmin } = await requireAdmin();
  if (!user) redirect("/login");
  if (!isAdmin) redirect("/dashboard");

  const { data: members } = await supabase
    .from("profiles")
    .select("id, email, role, created_at")
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
          <p className="mt-2 text-sm text-slate-400">
            Manage member roles and Premium access.
          </p>
        </div>

        <AdminSubnav />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total members", value: counts.total, color: "text-white" },
            { label: "Premium", value: counts.premium, color: "text-emerald-300" },
            { label: "Member", value: counts.member, color: "text-slate-300" },
            { label: "Admin", value: counts.admin, color: "text-amber-300" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-5"
            >
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                {stat.label}
              </p>
              <p className={`mt-2 text-3xl font-semibold ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Members table */}
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
                    {member.email?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {member.email ?? "No email"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Joined{" "}
                      {member.created_at
                        ? new Date(member.created_at).toLocaleDateString(
                            "en-GB",
                            { day: "numeric", month: "short", year: "numeric" }
                          )
                        : "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${roleBadge[member.role] ?? roleBadge.member}`}
                  >
                    {member.role ?? "member"}
                  </span>

                  {/* Skip role toggle for own account */}
                  {member.id !== user.id && (
                    <form action={setMemberRole} className="flex gap-2">
                      <input type="hidden" name="member_id" value={member.id} />

                      {member.role !== "premium" && member.role !== "admin" && (
                        <button
                          name="new_role"
                          value="premium"
                          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                        >
                          Grant Premium
                        </button>
                      )}

                      {member.role === "premium" && (
                        <button
                          name="new_role"
                          value="member"
                          className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/20"
                        >
                          Revoke Premium
                        </button>
                      )}

                      {member.role !== "admin" && (
                        <button
                          name="new_role"
                          value="admin"
                          className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
                        >
                          Make Admin
                        </button>
                      )}

                      {member.role === "admin" && (
                        <button
                          name="new_role"
                          value="member"
                          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-white/10"
                        >
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
              <p className="py-8 text-center text-sm text-slate-500">
                No members found.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
