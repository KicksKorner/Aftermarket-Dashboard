"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, RefreshCw, Trash2, Loader2, ExternalLink, TrendingUp,
  Eye, Heart, ShoppingBag, X, ChevronDown, ChevronUp, Tag,
  AlertCircle, Users, Search,
} from "lucide-react";

const supabase = createClient();

type TrackedProfile = {
  id: string;
  vinted_user_id: string;
  username: string;
  display_name: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  total_items: number;
  last_checked_at: string | null;
  created_at: string;
};

type Snapshot = {
  id: string;
  vinted_item_id: string;
  title: string;
  price: number;
  currency: string;
  category: string | null;
  brand: string | null;
  size: string | null;
  views: number;
  favourites: number;
  image_url: string | null;
  item_url: string | null;
  status: "active" | "sold";
  first_seen_at: string;
  last_seen_at: string;
  sold_detected_at: string | null;
};

type Tab = "all" | "active" | "sold" | "trending";

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-violet-400/40 transition";

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VintedStalkerPage() {
  const [profiles, setProfiles] = useState<TrackedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshResults, setRefreshResults] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [loadingSnapshots, setLoadingSnapshots] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, Tab>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const [hasVintedConn, setHasVintedConn] = useState<boolean | null>(null);

  const fetchProfiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check Vinted connection
    const { data: conn } = await supabase
      .from("vinted_connections")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    setHasVintedConn(!!conn);

    const { data } = await supabase
      .from("vinted_tracked_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setProfiles((data || []) as TrackedProfile[]);
    setLoading(false);
  }, []);

  const fetchSnapshots = useCallback(async (profileId: string) => {
    setLoadingSnapshots(profileId);
    const { data } = await supabase
      .from("vinted_profile_snapshots")
      .select("*")
      .eq("profile_id", profileId)
      .order("last_seen_at", { ascending: false });
    setSnapshots(prev => ({ ...prev, [profileId]: (data || []) as Snapshot[] }));
    setLoadingSnapshots(null);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  async function handleAdd() {
    if (!addInput.trim()) return;
    setAdding(true); setAddError("");
    try {
      const res = await fetch("/api/vinted/stalker/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: addInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error || "Failed to add profile."); return; }
      setAddInput(""); setShowAddForm(false);
      fetchProfiles();
    } catch { setAddError("Something went wrong."); }
    finally { setAdding(false); }
  }

  async function handleRefresh(profileId: string) {
    setRefreshing(profileId);
    setRefreshResults(prev => ({ ...prev, [profileId]: "" }));
    try {
      const res = await fetch("/api/vinted/stalker/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefreshResults(prev => ({ ...prev, [profileId]: data.message }));
        fetchProfiles();
        if (expandedProfile === profileId) fetchSnapshots(profileId);
      } else {
        setRefreshResults(prev => ({ ...prev, [profileId]: data.error || "Refresh failed." }));
      }
    } catch {
      setRefreshResults(prev => ({ ...prev, [profileId]: "Refresh failed." }));
    } finally { setRefreshing(null); }
  }

  async function handleDelete(profileId: string) {
    if (!window.confirm("Stop tracking this profile? All snapshot data will be deleted.")) return;
    setDeleting(profileId);
    await fetch("/api/vinted/stalker/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    fetchProfiles();
    setSnapshots(prev => { const n = { ...prev }; delete n[profileId]; return n; });
    if (expandedProfile === profileId) setExpandedProfile(null);
    setDeleting(null);
  }

  function toggleExpand(profileId: string) {
    if (expandedProfile === profileId) {
      setExpandedProfile(null);
    } else {
      setExpandedProfile(profileId);
      if (!snapshots[profileId]) fetchSnapshots(profileId);
    }
  }

  function getFilteredSnapshots(profileId: string): Snapshot[] {
    const all = snapshots[profileId] || [];
    const tab = activeTab[profileId] || "all";
    const q = (search[profileId] || "").toLowerCase();

    let filtered = all;
    if (tab === "active") filtered = all.filter(s => s.status === "active");
    else if (tab === "sold") filtered = all.filter(s => s.status === "sold");
    else if (tab === "trending") {
      filtered = all
        .filter(s => s.status === "active")
        .sort((a, b) => (b.views + b.favourites * 3) - (a.views + a.favourites * 3))
        .slice(0, 20);
    }

    if (q) filtered = filtered.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q) ||
      (s.brand || "").toLowerCase().includes(q)
    );

    return filtered;
  }

  // Global stats across all profiles
  const totalTracked = profiles.length;
  const totalSoldDetected = Object.values(snapshots).reduce(
    (sum, snaps) => sum + snaps.filter(s => s.status === "sold").length, 0
  );
  const totalActiveListings = Object.values(snapshots).reduce(
    (sum, snaps) => sum + snaps.filter(s => s.status === "active").length, 0
  );

  // Trending items across ALL profiles
  const allActiveSnapshots = Object.values(snapshots).flat().filter(s => s.status === "active");
  const globalTrending = [...allActiveSnapshots]
    .sort((a, b) => (b.views + b.favourites * 3) - (a.views + a.favourites * 3))
    .slice(0, 10);

  // Most sold categories across all sold items
  const allSold = Object.values(snapshots).flat().filter(s => s.status === "sold");
  const categoryCount = allSold.reduce<Record<string, number>>((acc, s) => {
    const cat = s.category || "Uncategorised";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[24px] border border-violet-500/15 bg-[linear-gradient(180deg,rgba(9,5,30,0.96),rgba(5,3,20,0.92))] px-6 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                <Users size={16} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Profile Stalker</h1>
            </div>
            <p className="text-sm text-slate-400">
              Track Vinted sellers — monitor their listings, detect sold items, and spot trending products in your niche.
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
            className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-300 hover:bg-violet-500/20 transition">
            <Plus size={15} /> Track New Profile
          </button>
        </div>

        {/* No Vinted connection warning */}
        {hasVintedConn === false && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
            <span>
              You need to connect your Vinted account first to use Profile Stalker.{" "}
              <a href="/dashboard/inventory" className="underline hover:text-amber-200">Connect in AIO Tracker → Vinted tab →</a>
            </span>
          </div>
        )}

        {/* Add form */}
        {showAddForm && (
          <div className="rounded-[20px] border border-violet-500/15 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Add a Vinted profile to track</p>
              <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white"><X size={15} /></button>
            </div>
            <div className="flex gap-3">
              <input
                value={addInput}
                onChange={e => setAddInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
                placeholder="Vinted username, @handle, or profile URL"
                className={inputCls}
              />
              <button onClick={handleAdd} disabled={adding || !addInput.trim()}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition disabled:opacity-50 flex-shrink-0">
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {adding ? "Adding..." : "Track"}
              </button>
            </div>
            {addError && (
              <p className="mt-2 text-xs text-red-400">{addError}</p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Accepts: <span className="text-slate-500">username</span>, <span className="text-slate-500">@username</span>, or <span className="text-slate-500">vinted.co.uk/member/username</span>
            </p>
          </div>
        )}
      </div>

      {/* Global stats */}
      {profiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[20px] border border-violet-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-300"><Users size={14} /></div>
            <p className="text-xl font-semibold text-white">{totalTracked}</p>
            <p className="mt-0.5 text-xs text-slate-500">Profiles Tracked</p>
          </div>
          <div className="rounded-[20px] border border-emerald-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"><ShoppingBag size={14} /></div>
            <p className="text-xl font-semibold text-white">{totalSoldDetected}</p>
            <p className="mt-0.5 text-xs text-slate-500">Sales Detected</p>
          </div>
          <div className="rounded-[20px] border border-blue-500/15 bg-[#081120] p-4">
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300"><Tag size={14} /></div>
            <p className="text-xl font-semibold text-white">{totalActiveListings}</p>
            <p className="mt-0.5 text-xs text-slate-500">Active Listings Monitored</p>
          </div>
        </div>
      )}

      {/* Global trending + top categories */}
      {globalTrending.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Trending across all profiles */}
          <div className="lg:col-span-2 rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-400" />
              <p className="text-sm font-semibold text-white">Trending Across All Profiles</p>
              <span className="text-xs text-slate-600">(by views + favourites)</span>
            </div>
            <div className="space-y-2">
              {globalTrending.map(item => (
                <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-10 w-10 flex-shrink-0 rounded-lg border border-white/10 bg-white/5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.category || "—"} {item.brand ? `· ${item.brand}` : ""}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Eye size={11} />{item.views}</span>
                    <span className="flex items-center gap-1"><Heart size={11} />{item.favourites}</span>
                    <span className="font-semibold text-white">£{Number(item.price).toFixed(2)}</span>
                    {item.item_url && (
                      <a href={item.item_url} target="_blank" rel="noopener noreferrer"
                        className="text-violet-400 hover:text-violet-300">
                        <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top selling categories */}
          <div className="rounded-[20px] border border-white/10 bg-[#081120]/80 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag size={14} className="text-amber-400" />
              <p className="text-sm font-semibold text-white">Top Selling Categories</p>
            </div>
            {topCategories.length > 0 ? (
              <div className="space-y-2">
                {topCategories.map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                    <span className="text-sm text-white">{cat}</span>
                    <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
                      {count} sold
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Refresh profiles to detect sold items</p>
            )}
          </div>
        </div>
      )}

      {/* Profiles list */}
      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-violet-500/15 bg-[#081120]/50 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <Users size={24} />
          </div>
          <h3 className="text-lg font-semibold text-white">No profiles tracked yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-400">
            Find Vinted sellers in your niche and track their listings to spot what sells, at what price, and how fast.
          </p>
          <button onClick={() => setShowAddForm(true)}
            className="mt-5 flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition">
            <Plus size={14} /> Track Your First Profile
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {profiles.map(profile => {
            const isExpanded = expandedProfile === profile.id;
            const isRefreshing = refreshing === profile.id;
            const profileSnaps = snapshots[profile.id] || [];
            const soldCount = profileSnaps.filter(s => s.status === "sold").length;
            const activeCount = profileSnaps.filter(s => s.status === "active").length;
            const tab = activeTab[profile.id] || "all";
            const filtered = getFilteredSnapshots(profile.id);

            return (
              <div key={profile.id} className="rounded-[24px] border border-white/10 bg-[#081120]/80 overflow-hidden">
                {/* Profile header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username}
                      className="h-12 w-12 flex-shrink-0 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-violet-500/20 bg-violet-500/10 text-lg font-bold text-violet-300">
                      {profile.username[0]?.toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-white">@{profile.username}</p>
                      {profile.display_name && profile.display_name !== profile.username && (
                        <span className="text-sm text-slate-400">{profile.display_name}</span>
                      )}
                      {profile.profile_url && (
                        <a href={profile.profile_url} target="_blank" rel="noopener noreferrer"
                          className="text-violet-400 hover:text-violet-300">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{profile.total_items} listings</span>
                      {profileSnaps.length > 0 && (
                        <>
                          <span className="text-emerald-400">{activeCount} active</span>
                          <span className="text-amber-400">{soldCount} sold detected</span>
                        </>
                      )}
                      <span>Last checked: {timeAgo(profile.last_checked_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    {refreshResults[profile.id] && (
                      <span className="hidden text-xs text-emerald-400 lg:block">{refreshResults[profile.id]}</span>
                    )}
                    <button onClick={() => handleRefresh(profile.id)} disabled={isRefreshing}
                      className="flex items-center gap-1.5 rounded-xl border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition disabled:opacity-50">
                      {isRefreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {isRefreshing ? "Checking..." : "Refresh"}
                    </button>
                    <button onClick={() => toggleExpand(profile.id)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:bg-white/10 transition">
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {isExpanded ? "Hide" : "View"} Listings
                    </button>
                    <button onClick={() => handleDelete(profile.id)} disabled={deleting === profile.id}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300 hover:bg-red-500/20 transition disabled:opacity-40">
                      {deleting === profile.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>

                {/* Refresh result on mobile */}
                {refreshResults[profile.id] && (
                  <div className="px-5 pb-2 text-xs text-emerald-400 lg:hidden">{refreshResults[profile.id]}</div>
                )}

                {/* Expanded listings */}
                {isExpanded && (
                  <div className="border-t border-white/10 px-5 py-4 space-y-4">
                    {loadingSnapshots === profile.id ? (
                      <div className="flex items-center justify-center py-8 text-slate-500 text-sm">
                        <Loader2 size={16} className="animate-spin mr-2" /> Loading listings...
                      </div>
                    ) : profileSnaps.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <RefreshCw size={20} className="mb-2 text-slate-600" />
                        <p className="text-sm text-slate-400">No data yet — hit Refresh to snapshot this profile.</p>
                      </div>
                    ) : (
                      <>
                        {/* Tabs + search */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
                            {(["all", "active", "sold", "trending"] as Tab[]).map(t => (
                              <button key={t} onClick={() => setActiveTab(prev => ({ ...prev, [profile.id]: t }))}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                                  tab === t ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"
                                }`}>
                                {t === "all" ? `All (${profileSnaps.length})`
                                  : t === "active" ? `Active (${activeCount})`
                                  : t === "sold" ? `Sold (${soldCount})`
                                  : "🔥 Trending"}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 min-w-[160px]">
                            <Search size={12} className="text-slate-500 flex-shrink-0" />
                            <input
                              value={search[profile.id] || ""}
                              onChange={e => setSearch(prev => ({ ...prev, [profile.id]: e.target.value }))}
                              placeholder="Search items, brands, categories..."
                              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
                            />
                          </div>
                          <span className="text-xs text-slate-600">{filtered.length} showing</span>
                        </div>

                        {/* Items grid */}
                        {filtered.length === 0 ? (
                          <p className="text-sm text-center text-slate-500 py-4">No items match this filter.</p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {filtered.map(item => (
                              <div key={item.id}
                                className={`relative rounded-[18px] border bg-[#0d1829] overflow-hidden transition ${
                                  item.status === "sold"
                                    ? "border-amber-500/20 opacity-75"
                                    : "border-white/10 hover:border-violet-500/20"
                                }`}>
                                {item.status === "sold" && (
                                  <div className="absolute right-2 top-2 z-10 rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                    SOLD
                                  </div>
                                )}
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.title}
                                    className="h-40 w-full object-cover" />
                                ) : (
                                  <div className="flex h-40 w-full items-center justify-center bg-white/5">
                                    <Tag size={24} className="text-slate-700" />
                                  </div>
                                )}
                                <div className="p-3">
                                  <p className="line-clamp-2 text-sm font-medium text-white leading-snug">{item.title}</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {item.brand && (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{item.brand}</span>
                                    )}
                                    {item.size && (
                                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{item.size}</span>
                                    )}
                                    {item.category && (
                                      <span className="rounded-full border border-violet-500/15 bg-violet-500/8 px-2 py-0.5 text-[10px] text-violet-400">{item.category}</span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-base font-semibold text-white">£{Number(item.price).toFixed(2)}</span>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                      <span className="flex items-center gap-0.5"><Eye size={10} />{item.views}</span>
                                      <span className="flex items-center gap-0.5"><Heart size={10} />{item.favourites}</span>
                                    </div>
                                  </div>
                                  {item.sold_detected_at && (
                                    <p className="mt-1 text-[10px] text-amber-400">Sold detected {timeAgo(item.sold_detected_at)}</p>
                                  )}
                                  {item.item_url && item.status === "active" && (
                                    <a href={item.item_url} target="_blank" rel="noopener noreferrer"
                                      className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 py-1.5 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition">
                                      <ExternalLink size={10} /> View on Vinted
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
