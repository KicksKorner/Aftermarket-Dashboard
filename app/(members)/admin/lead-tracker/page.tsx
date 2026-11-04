import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSubnav from "@/components/admin-subnav";
import LeadCsvButton, { type LeadRow } from "@/components/lead-csv-button";

// Counts the posts each staff member sent with the AI Deal Formatter, for
// wages. Rows are written by /api/admin/send-deal after Discord accepts a post.

const CHANNEL_LABELS: Record<string, string> = {
  kicks_flips: "flips",
  sneaker_streetwear: "sneaker-and-streetwear-flips",
  pokemon_flips: "pokemon-info",
  brick_flips: "brick-flips",
};

const PERIODS = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "all", label: "All time" },
] as const;

type PeriodId = (typeof PERIODS)[number]["id"];

// Run once in Supabase → SQL Editor. RLS on with no policies: only the
// service role (server code) can read or write it.
const SETUP_SQL = `create table if not exists public.deal_posts (
  id bigint generated always as identity primary key,
  posted_at timestamptz not null default now(),
  user_id uuid,
  email text,
  discord_username text,
  channel text,
  style text,
  title text
);
alter table public.deal_posts enable row level security;
create index if not exists deal_posts_posted_at_idx on public.deal_posts (posted_at desc);`;

const TZ = "Europe/London";

// UK wall-clock parts of an instant.
function londonParts(t: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ, year: "numeric", month: "numeric", day: "numeric",
      hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23", weekday: "short",
    }).formatToParts(new Date(t)).map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year), m: Number(parts.month), d: Number(parts.day),
    hh: Number(parts.hour), mm: Number(parts.minute), ss: Number(parts.second),
    weekday: parts.weekday as string,
  };
}

// The instant of midnight UK time on a UK calendar date (handles BST).
function londonMidnight(y: number, m: number, d: number): Date {
  const guess = Date.UTC(y, m - 1, d);
  const p = londonParts(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - guess;
  return new Date(guess - offset);
}

// Weeks run Monday to Sunday.
function periodRange(period: PeriodId): { from: Date | null; to: Date | null } {
  const now = londonParts(Date.now());
  const dayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(now.weekday);
  const thisMonday = londonMidnight(now.y, now.m, now.d - dayIndex);
  switch (period) {
    case "this-week":
      return { from: thisMonday, to: null };
    case "last-week":
      return { from: londonMidnight(now.y, now.m, now.d - dayIndex - 7), to: thisMonday };
    case "this-month":
      return { from: londonMidnight(now.y, now.m, 1), to: null };
    case "last-month":
      return { from: londonMidnight(now.y, now.m - 1, 1), to: londonMidnight(now.y, now.m, 1) };
    default:
      return { from: null, to: null };
  }
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function LeadTrackerPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { period: requested } = await searchParams;
  const period: PeriodId = PERIODS.some((p) => p.id === requested) ? (requested as PeriodId) : "this-week";
  const { from, to } = periodRange(period);

  const { createClient: createAdminClient } = await import("@supabase/supabase-js");
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let query = admin
    .from("deal_posts")
    .select("id, posted_at, user_id, email, discord_username, channel, style, title")
    .order("posted_at", { ascending: false })
    .limit(5000);
  if (from) query = query.gte("posted_at", from.toISOString());
  if (to) query = query.lt("posted_at", to.toISOString());
  const { data, error } = await query;

  const needsSetup = error?.code === "PGRST205" || /deal_posts/.test(error?.message ?? "");
  const rows: LeadRow[] = (data ?? []).map((r) => ({
    postedAt: r.posted_at,
    who: r.discord_username || r.email || "Unknown",
    email: r.email ?? "",
    channel: CHANNEL_LABELS[r.channel] ?? r.channel ?? "",
    style: r.style ?? "",
    title: r.title ?? "",
  }));

  // One line per staff member, most posts first.
  const byPerson = new Map<string, { who: string; email: string; posts: number; last: string; channels: Map<string, number> }>();
  for (const r of rows) {
    const key = r.email || r.who;
    const p = byPerson.get(key) ?? { who: r.who, email: r.email, posts: 0, last: r.postedAt, channels: new Map() };
    p.posts++;
    p.channels.set(r.channel, (p.channels.get(r.channel) ?? 0) + 1);
    byPerson.set(key, p);
  }
  const people = [...byPerson.values()].sort((a, b) => b.posts - a.posts);
  const periodLabel = PERIODS.find((p) => p.id === period)!.label;

  return (
    <main className="min-h-screen bg-[#030814] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-6">
          <p className="text-sm text-blue-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">Lead Tracker</h1>
          <p className="mt-2 text-sm text-slate-400">
            Posts each staff member sent to Discord with the AI Deal Formatter. Weeks run Monday to Sunday, UK time.
          </p>
        </div>

        <AdminSubnav />

        {needsSetup ? (
          <section className="rounded-[24px] border border-amber-500/20 bg-[#071021] p-6">
            <h2 className="text-xl font-semibold">One-time setup</h2>
            <p className="mt-2 text-sm text-slate-400">
              The tracker&apos;s database table doesn&apos;t exist yet. In Supabase, open SQL Editor, paste this and press Run. Posts are counted from then on.
            </p>
            <pre className="mt-4 overflow-x-auto rounded-xl bg-[#030814] p-4 text-xs text-slate-300">{SETUP_SQL}</pre>
          </section>
        ) : error ? (
          <section className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-300">
            Couldn&apos;t load posts: {error.message}
          </section>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {PERIODS.map((p) => (
                <Link
                  key={p.id}
                  href={`/admin/lead-tracker?period=${p.id}`}
                  className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                    p.id === period
                      ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {p.label}
                </Link>
              ))}
              <div className="ml-auto">
                <LeadCsvButton rows={rows} filename={`lead-tracker-${period}.csv`} />
              </div>
            </div>

            <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <h2 className="text-xl font-semibold">{periodLabel}: posts per staff member</h2>
              {people.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400">No posts in this period.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">Staff</th>
                        <th className="py-2 pr-4">Posts</th>
                        <th className="py-2 pr-4">Channels</th>
                        <th className="py-2">Last post</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p) => (
                        <tr key={p.email || p.who} className="border-t border-white/5">
                          <td className="py-3 pr-4">
                            <p className="font-medium">{p.who}</p>
                            {p.email && p.email !== p.who && <p className="text-xs text-slate-500">{p.email}</p>}
                          </td>
                          <td className="py-3 pr-4 text-lg font-semibold">{p.posts}</td>
                          <td className="py-3 pr-4 text-xs text-slate-400">
                            {[...p.channels].map(([c, n]) => `${c} ${n}`).join(" · ")}
                          </td>
                          <td className="py-3 text-slate-400">{fmtDate(p.last)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {rows.length > 0 && (
              <section className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
                <h2 className="text-xl font-semibold">Every post ({rows.length})</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="py-2 pr-4">When</th>
                        <th className="py-2 pr-4">Staff</th>
                        <th className="py-2 pr-4">Channel</th>
                        <th className="py-2">Post</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="whitespace-nowrap py-2 pr-4 text-slate-400">{fmtDate(r.postedAt)}</td>
                          <td className="py-2 pr-4">{r.who}</td>
                          <td className="py-2 pr-4 text-slate-400">{r.channel}</td>
                          <td className="py-2">{r.title}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
