import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Trophy, TrendingUp, Package, ShoppingCart, Tag, Users,
  Activity, PoundSterling, Star,
} from "lucide-react";

type MemberStat = {
  user_id: string;
  email: string;
  role: string;
  discord_username: string | null;
  inventory_items: number;
  inventory_sales: number;
  total_revenue: number;
  total_profit: number;
  ebay_sales: number;
  amazon_sales: number;
  vinted_sales: number;
  last_active: string | null;
  joined: string | null;
};

function fmt(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ActivityBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${color}`}>
      <span className="font-semibold">{count}</span>
      <span className="text-opacity-70">{label}</span>
    </div>
  );
}

export default async function AdminActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  // Use service role to fetch all members data
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all profiles
  const { data: profiles } = await serviceSupabase
    .from("profiles")
    .select("id, role, discord_username, created_at")
    .order("created_at", { ascending: false });

  // Get auth users for emails
  const { data: authUsers } = await serviceSupabase.auth.admin.listUsers();
  const emailMap = new Map(authUsers.users.map(u => [u.id, { email: u.email || "", last_sign_in: u.last_sign_in_at || null }]));

  if (!profiles) return <div>No members found.</div>;

  // Fetch activity counts for all members in parallel
  const memberStats: MemberStat[] = await Promise.all(
    profiles.map(async (p) => {
      const uid = p.id;

      const [
        { count: invItems },
        { data: salesData },
        { count: ebaySales },
        { count: amazonSales },
        { count: vintedSales },
      ] = await Promise.all([
        serviceSupabase.from("inventory_items").select("*", { count: "exact", head: true }).eq("user_id", uid),
        serviceSupabase.from("inventory_sales").select("sold_price, quantity_sold, buy_price_per_unit:inventory_items!inner(buy_price)").eq("user_id", uid),
        serviceSupabase.from("ebay_sales").select("*", { count: "exact", head: true }).eq("user_id", uid),
        serviceSupabase.from("amazon_sales").select("*", { count: "exact", head: true }).eq("user_id", uid),
        serviceSupabase.from("vinted_sales").select("*", { count: "exact", head: true }).eq("user_id", uid),
      ]);

      // Calculate revenue and profit from inventory_sales
      const sales = (salesData || []) as any[];
      const totalRevenue = sales.reduce((s, r) => s + Number(r.sold_price) * Number(r.quantity_sold), 0);
      const totalProfit = sales.reduce((s, r) => {
        const revenue = Number(r.sold_price) * Number(r.quantity_sold);
        const cost = Number(r.buy_price_per_unit?.buy_price || 0) * Number(r.quantity_sold);
        return s + revenue - cost;
      }, 0);

      const authUser = emailMap.get(uid);

      return {
        user_id: uid,
        email: authUser?.email || "Unknown",
        role: p.role || "member",
        discord_username: p.discord_username,
        inventory_items: invItems || 0,
        inventory_sales: sales.length,
        total_revenue: totalRevenue,
        total_profit: totalProfit,
        ebay_sales: ebaySales || 0,
        amazon_sales: amazonSales || 0,
        vinted_sales: vintedSales || 0,
        last_active: authUser?.last_sign_in || null,
        joined: p.created_at || null,
      };
    })
  );

  // Sort by total revenue desc
  const sorted = [...memberStats].sort((a, b) => b.total_revenue - a.total_revenue);

  // Summary stats
  const totalMembers = profiles.length;
  const activeMembers = memberStats.filter(m => m.inventory_items > 0 || m.inventory_sales > 0).length;
  const totalRevenue = memberStats.reduce((s, m) => s + m.total_revenue, 0);
  const totalSalesLogged = memberStats.reduce((s, m) => s + m.inventory_sales, 0);

  const roleBadge: Record<string, string> = {
    admin: "border-red-400/30 bg-red-500/10 text-red-300",
    premium: "border-orange-400/30 bg-orange-500/10 text-orange-300",
    member: "border-white/10 bg-white/5 text-slate-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-center gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <Trophy size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Member Activity</h1>
          <p className="mt-1 text-sm text-slate-400">Track engagement, sales and profit across all members.</p>
        </div>
      </section>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Members", value: String(totalMembers), icon: Users, color: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
          { label: "Active Members", value: String(activeMembers), icon: Activity, color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
          { label: "Total Revenue Tracked", value: `£${fmt(totalRevenue)}`, icon: PoundSterling, color: "border-violet-500/20 bg-violet-500/10 text-violet-300" },
          { label: "Total Sales Logged", value: String(totalSalesLogged), icon: TrendingUp, color: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-[20px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${s.color}`}>
                <Icon size={18} />
              </div>
              <p className="text-2xl font-semibold text-white">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Leaderboard table */}
      <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] overflow-hidden">
        <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star size={15} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Member Leaderboard</h2>
          </div>
          <p className="text-xs text-slate-500">Sorted by total revenue</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium w-10">#</th>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Inventory</th>
                <th className="px-4 py-3 font-medium">Sales</th>
                <th className="px-4 py-3 font-medium">Revenue</th>
                <th className="px-4 py-3 font-medium">Profit</th>
                <th className="px-4 py-3 font-medium">Platforms</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, i) => {
                const isTop = i === 0 && m.total_revenue > 0;
                const isActive = m.inventory_items > 0 || m.inventory_sales > 0;
                return (
                  <tr key={m.user_id}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition ${isTop ? "bg-amber-500/[0.03]" : ""}`}>
                    <td className="px-4 py-4">
                      {i === 0 && m.total_revenue > 0 ? <Trophy size={14} className="text-amber-400" />
                        : i === 1 && m.total_revenue > 0 ? <span className="text-slate-400 font-bold">2</span>
                        : i === 2 && m.total_revenue > 0 ? <span className="text-slate-500 font-bold">3</span>
                        : <span className="text-slate-600 text-xs">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-white truncate max-w-[180px]">
                          {m.discord_username || m.email.split("@")[0]}
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[180px]">{m.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${roleBadge[m.role] ?? roleBadge.member}`}>
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <Package size={12} className="text-slate-500" />
                        <span className={m.inventory_items > 0 ? "text-white" : "text-slate-600"}>{m.inventory_items}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={m.inventory_sales > 0 ? "text-white font-medium" : "text-slate-600"}>
                        {m.inventory_sales}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={m.total_revenue > 0 ? "text-emerald-400 font-semibold" : "text-slate-600"}>
                        {m.total_revenue > 0 ? `£${fmt(m.total_revenue)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={m.total_profit > 0 ? "text-emerald-300" : m.total_profit < 0 ? "text-red-300" : "text-slate-600"}>
                        {m.total_profit !== 0 ? `£${fmt(m.total_profit)}` : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {m.ebay_sales > 0 && (
                          <ActivityBadge count={m.ebay_sales} label="eBay" color="border-blue-500/20 bg-blue-500/10 text-blue-400" />
                        )}
                        {m.amazon_sales > 0 && (
                          <ActivityBadge count={m.amazon_sales} label="Amz" color="border-orange-500/20 bg-orange-500/10 text-orange-400" />
                        )}
                        {m.vinted_sales > 0 && (
                          <ActivityBadge count={m.vinted_sales} label="Vinted" color="border-violet-500/20 bg-violet-500/10 text-violet-400" />
                        )}
                        {!isActive && <span className="text-xs text-slate-600">No activity</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-400 text-xs">
                      {m.last_active
                        ? new Date(m.last_active).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "Never"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
