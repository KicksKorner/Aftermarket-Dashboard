import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AlertTriangle, TrendingUp, PoundSterling, Info } from "lucide-react";

export default async function VatTrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const VAT_THRESHOLD = 90000;
  const now = new Date();

  // Rolling 12 months
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const rollingStart = twelveMonthsAgo.toISOString().split("T")[0];

  // Current tax year (UK: April 6 to April 5)
  const taxYearStart = now.getMonth() >= 3
    ? `${now.getFullYear()}-04-06`
    : `${now.getFullYear() - 1}-04-06`;

  const [
    { data: rollingSales },
    { data: taxYearSales },
    { data: monthlyBreakdown },
  ] = await Promise.all([
    // Rolling 12 months sales
    supabase
      .from("inventory_sales")
      .select("sold_price, quantity_sold, sold_date")
      .eq("user_id", user.id)
      .gte("sold_date", rollingStart),

    // Tax year sales
    supabase
      .from("inventory_sales")
      .select("sold_price, quantity_sold, sold_date")
      .eq("user_id", user.id)
      .gte("sold_date", taxYearStart),

    // Last 12 months breakdown by month
    supabase
      .from("inventory_sales")
      .select("sold_price, quantity_sold, sold_date")
      .eq("user_id", user.id)
      .gte("sold_date", rollingStart)
      .order("sold_date", { ascending: true }),
  ]);

  const calcRevenue = (sales: { sold_price: number; quantity_sold: number }[] | null) =>
    (sales ?? []).reduce((sum, s) => sum + Number(s.sold_price) * Number(s.quantity_sold), 0);

  const rollingRevenue = calcRevenue(rollingSales);
  const taxYearRevenue = calcRevenue(taxYearSales);
  const rollingPct = Math.min((rollingRevenue / VAT_THRESHOLD) * 100, 100);
  const taxYearPct = Math.min((taxYearRevenue / VAT_THRESHOLD) * 100, 100);

  // Monthly breakdown
  const monthlyMap: Record<string, number> = {};
  for (const sale of monthlyBreakdown ?? []) {
    const month = sale.sold_date.slice(0, 7); // YYYY-MM
    monthlyMap[month] = (monthlyMap[month] ?? 0) + Number(sale.sold_price) * Number(sale.quantity_sold);
  }

  // Generate last 12 months labels
  const months: { label: string; key: string; value: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    months.push({ label, key, value: monthlyMap[key] ?? 0 });
  }

  const remaining = Math.max(0, VAT_THRESHOLD - rollingRevenue);
  const isWarning = rollingRevenue >= VAT_THRESHOLD * 0.75;
  const isDanger = rollingRevenue >= VAT_THRESHOLD * 0.9;
  const isBreached = rollingRevenue >= VAT_THRESHOLD;

  function barColour(pct: number) {
    if (pct >= 90) return "bg-red-500";
    if (pct >= 75) return "bg-amber-500";
    return "bg-emerald-500";
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <PoundSterling size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">VAT Threshold Tracker</h1>
            <p className="mt-1 text-sm text-slate-400">
              UK VAT registration is required once your taxable turnover exceeds <span className="text-white font-medium">£{VAT_THRESHOLD.toLocaleString()}</span> in any rolling 12-month period.
            </p>
          </div>
        </div>
      </section>

      {/* Alert banner if approaching */}
      {isBreached && (
        <div className="flex items-start gap-3 rounded-[20px] border border-red-500/30 bg-red-500/10 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
          <div>
            <p className="font-semibold text-red-300">VAT threshold exceeded</p>
            <p className="mt-1 text-sm text-red-300/80">Your rolling 12-month revenue has exceeded £90,000. You may be required to register for VAT. Contact your accountant immediately.</p>
          </div>
        </div>
      )}
      {isDanger && !isBreached && (
        <div className="flex items-start gap-3 rounded-[20px] border border-red-500/20 bg-red-500/8 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
          <div>
            <p className="font-semibold text-red-300">Approaching VAT threshold</p>
            <p className="mt-1 text-sm text-slate-400">You're within 10% of the £90,000 threshold. Consider speaking to an accountant about your obligations.</p>
          </div>
        </div>
      )}
      {isWarning && !isDanger && (
        <div className="flex items-start gap-3 rounded-[20px] border border-amber-500/20 bg-amber-500/8 px-5 py-4">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">75% of threshold reached</p>
            <p className="mt-1 text-sm text-slate-400">Keep an eye on your rolling revenue. You still have <span className="text-white font-medium">£{remaining.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> before you need to register.</p>
          </div>
        </div>
      )}

      {/* Main trackers */}
      <section className="grid gap-4 xl:grid-cols-2">
        {/* Rolling 12 months */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Rolling 12 Months</h2>
            <span className="text-xs text-slate-500">HMRC basis for VAT</span>
          </div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-white">£{rollingRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-slate-500">of £{VAT_THRESHOLD.toLocaleString()} threshold</p>
            </div>
            <p className={`text-lg font-semibold ${isDanger ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400"}`}>
              {rollingPct.toFixed(1)}%
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColour(rollingPct)}`}
              style={{ width: `${rollingPct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {isBreached
              ? "Threshold exceeded — register for VAT"
              : `£${remaining.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining before threshold`}
          </p>
        </div>

        {/* Current tax year */}
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Current Tax Year</h2>
            <span className="text-xs text-slate-500">6 Apr — 5 Apr</span>
          </div>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-3xl font-semibold text-white">£{taxYearRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-slate-500">of £{VAT_THRESHOLD.toLocaleString()} threshold</p>
            </div>
            <p className={`text-lg font-semibold ${taxYearPct >= 90 ? "text-red-400" : taxYearPct >= 75 ? "text-amber-400" : "text-emerald-400"}`}>
              {taxYearPct.toFixed(1)}%
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColour(taxYearPct)}`}
              style={{ width: `${taxYearPct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Tax year from {taxYearStart} · for Self Assessment reference
          </p>
        </div>
      </section>

      {/* Monthly chart */}
      <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-400" />
          <h2 className="text-base font-semibold text-white">Monthly Revenue — Last 12 Months</h2>
        </div>
        <div className="flex items-end gap-2 h-32">
          {months.map((m) => {
            const maxVal = Math.max(...months.map((x) => x.value), 1);
            const heightPct = (m.value / maxVal) * 100;
            return (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1">
                <p className="text-[9px] text-slate-500 whitespace-nowrap">
                  {m.value > 0 ? `£${Math.round(m.value)}` : ""}
                </p>
                <div className="w-full rounded-t-sm bg-blue-500/20 relative" style={{ height: "80px" }}>
                  <div
                    className="absolute bottom-0 w-full rounded-t-sm bg-blue-500 transition-all duration-500"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-600">{m.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Info box */}
      <section className="rounded-[24px] border border-white/8 bg-[#071021] p-5">
        <div className="flex items-start gap-3">
          <Info size={16} className="mt-0.5 flex-shrink-0 text-blue-400" />
          <div className="space-y-2 text-sm text-slate-400">
            <p><span className="font-medium text-white">Important:</span> This tracker uses revenue from your inventory sales only. If you earn from other sources (employment, other platforms), those must be included in your total turnover for VAT purposes.</p>
            <p>The <span className="text-white font-medium">rolling 12 months</span> is the figure HMRC uses — not the tax year. You must check both.</p>
            <p>This tool is for reference only. Always consult a qualified accountant for tax advice.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
