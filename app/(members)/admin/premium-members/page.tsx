"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Edit2, Trash2, Save, X, Users, Crown,
  Calendar, CheckCircle, AlertCircle, Clock, Loader2,
} from "lucide-react";

const supabase = createClient();

type Package = "6_months" | "12_months" | "lifetime";

type PremiumMember = {
  id: string;
  discord_username: string;
  package: Package;
  start_date: string;
  expiry_date: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
};

const PACKAGE_CONFIG: Record<Package, { label: string; color: string; months: number | null }> = {
  "6_months":  { label: "6 Months",  color: "border-blue-500/20 bg-blue-500/10 text-blue-300",    months: 6 },
  "12_months": { label: "12 Months", color: "border-violet-500/20 bg-violet-500/10 text-violet-300", months: 12 },
  "lifetime":  { label: "Lifetime",  color: "border-amber-500/20 bg-amber-500/10 text-amber-300",  months: null },
};

function calcExpiry(startDate: string, pkg: Package): string | null {
  if (pkg === "lifetime") return null;
  const months = PACKAGE_CONFIG[pkg].months!;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function daysRemaining(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/30 transition";

export default function PremiumMembersPage() {
  const [members, setMembers] = useState<PremiumMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "expired">("all");
  const [search, setSearch] = useState("");

  // Add form
  const [newUsername, setNewUsername] = useState("");
  const [newPackage, setNewPackage] = useState<Package>("lifetime");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newNotes, setNewNotes] = useState("");

  // Edit form
  const [editUsername, setEditUsername] = useState("");
  const [editPackage, setEditPackage] = useState<Package>("lifetime");
  const [editStartDate, setEditStartDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editActive, setEditActive] = useState(true);

  useEffect(() => { fetchMembers(); }, []);

  async function fetchMembers() {
    setLoading(true);
    const { data } = await supabase
      .from("premium_members")
      .select("*")
      .order("created_at", { ascending: false });
    setMembers((data || []) as PremiumMember[]);
    setLoading(false);
  }

  async function handleAdd() {
    if (!newUsername.trim()) return;
    setSaving(true);
    const expiry = calcExpiry(newStartDate, newPackage);
    await supabase.from("premium_members").insert({
      discord_username: newUsername.trim(),
      package: newPackage,
      start_date: newStartDate,
      expiry_date: expiry,
      notes: newNotes.trim() || null,
      active: true,
    });
    setNewUsername(""); setNewPackage("lifetime");
    setNewStartDate(new Date().toISOString().split("T")[0]);
    setNewNotes(""); setShowAdd(false); setSaving(false);
    fetchMembers();
  }

  function startEdit(m: PremiumMember) {
    setEditingId(m.id);
    setEditUsername(m.discord_username);
    setEditPackage(m.package);
    setEditStartDate(m.start_date);
    setEditNotes(m.notes || "");
    setEditActive(m.active);
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    const expiry = calcExpiry(editStartDate, editPackage);
    await supabase.from("premium_members").update({
      discord_username: editUsername.trim(),
      package: editPackage,
      start_date: editStartDate,
      expiry_date: expiry,
      notes: editNotes.trim() || null,
      active: editActive,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setEditingId(null); setSaving(false);
    fetchMembers();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this member?")) return;
    await supabase.from("premium_members").delete().eq("id", id);
    fetchMembers();
  }

  async function toggleActive(m: PremiumMember) {
    await supabase.from("premium_members").update({ active: !m.active }).eq("id", m.id);
    fetchMembers();
  }

  const filtered = members.filter(m => {
    const matchSearch = m.discord_username.toLowerCase().includes(search.toLowerCase());
    const isExpired = m.expiry_date ? daysRemaining(m.expiry_date) <= 0 : false;
    const matchFilter =
      filter === "all" ? true :
      filter === "active" ? m.active && !isExpired :
      isExpired || !m.active;
    return matchSearch && matchFilter;
  });

  const activeCount = members.filter(m => m.active && (!m.expiry_date || daysRemaining(m.expiry_date) > 0)).length;
  const expiredCount = members.filter(m => m.expiry_date && daysRemaining(m.expiry_date) <= 0).length;
  const lifetimeCount = members.filter(m => m.package === "lifetime" && m.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex items-center justify-between gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <Crown size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Premium Members</h1>
            <p className="mt-1 text-sm text-slate-400">Manage member access, packages and expiry dates.</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition">
          <Plus size={15} /> Add Member
        </button>
      </section>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active Members", value: activeCount, icon: CheckCircle, color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" },
          { label: "Lifetime Members", value: lifetimeCount, icon: Crown, color: "text-amber-400 border-amber-500/20 bg-amber-500/10" },
          { label: "Expired / Inactive", value: expiredCount, icon: AlertCircle, color: "text-red-400 border-red-500/20 bg-red-500/10" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-[20px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
              <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${s.color}`}>
                <Icon size={15} />
              </div>
              <p className="text-2xl font-semibold text-white">{s.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 space-y-4">
          <h3 className="text-base font-semibold text-white">Add New Member</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Discord Username *</label>
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder="e.g. Ashayd123" className={inputCls} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Package</label>
              <select value={newPackage} onChange={e => setNewPackage(e.target.value as Package)}
                className={inputCls}>
                <option value="6_months">6 Months</option>
                <option value="12_months">12 Months</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Start Date</label>
              <input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Notes (optional)</label>
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="e.g. Lifetime unpaid" className={inputCls} />
            </div>
          </div>
          {newPackage !== "lifetime" && newStartDate && (
            <p className="text-xs text-slate-500">
              Expiry: <span className="text-white font-medium">{calcExpiry(newStartDate, newPackage)}</span>
            </p>
          )}
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={!newUsername.trim() || saving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition disabled:opacity-50">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {saving ? "Adding..." : "Add Member"}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
          {(["all", "active", "expired"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-lg px-4 py-1.5 text-xs font-medium capitalize transition
                ${filter === f ? "bg-white/10 text-white" : "text-slate-500 hover:text-white"}`}>
              {f} {f === "all" ? `(${members.length})` : f === "active" ? `(${activeCount})` : `(${expiredCount})`}
            </button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by username..."
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/30 w-full sm:w-64" />
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))]">
        <div className="border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            <p className="text-sm font-semibold text-white">{filtered.length} member{filtered.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-left text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Username</th>
                <th className="px-4 py-3 font-medium">Package</th>
                <th className="px-4 py-3 font-medium">Start Date</th>
                <th className="px-4 py-3 font-medium">Expiry</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  <Loader2 size={16} className="animate-spin inline mr-2" />Loading...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center">
                  <Crown size={28} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-sm text-slate-500">No members found.</p>
                </td></tr>
              ) : filtered.map(m => {
                const isEditing = editingId === m.id;
                const isExpired = m.expiry_date ? daysRemaining(m.expiry_date) <= 0 : false;
                const days = m.expiry_date ? daysRemaining(m.expiry_date) : null;
                const pkgCfg = PACKAGE_CONFIG[m.package];

                if (isEditing) {
                  return (
                    <tr key={m.id} className="border-b border-white/5 bg-blue-500/5">
                      <td className="px-4 py-3">
                        <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                          className="w-36 rounded-xl border border-white/10 bg-[#030814] px-3 py-1.5 text-sm text-white outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <select value={editPackage} onChange={e => setEditPackage(e.target.value as Package)}
                          className="rounded-xl border border-white/10 bg-[#030814] px-3 py-1.5 text-sm text-white outline-none">
                          <option value="6_months">6 Months</option>
                          <option value="12_months">12 Months</option>
                          <option value="lifetime">Lifetime</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)}
                          className="rounded-xl border border-white/10 bg-[#030814] px-3 py-1.5 text-sm text-white outline-none" />
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {editPackage === "lifetime" ? "Never" : calcExpiry(editStartDate, editPackage)}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setEditActive(!editActive)}
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${editActive ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
                          {editActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                          placeholder="Notes..."
                          className="w-32 rounded-xl border border-white/10 bg-[#030814] px-3 py-1.5 text-xs text-white outline-none" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => handleSaveEdit(m.id)} disabled={saving}
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20 transition">
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">
                            <X size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={m.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition ${!m.active || isExpired ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{m.discord_username}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${pkgCfg.color}`}>
                        {pkgCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {new Date(m.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      {m.expiry_date ? (
                        <div>
                          <p className={`text-xs font-medium ${isExpired ? "text-red-400" : days! <= 30 ? "text-amber-400" : "text-slate-300"}`}>
                            {new Date(m.expiry_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${isExpired ? "text-red-500" : days! <= 30 ? "text-amber-500" : "text-slate-500"}`}>
                            {isExpired ? `Expired ${Math.abs(days!)}d ago` : `${days}d remaining`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400 font-medium">Never</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(m)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                          !m.active ? "border-slate-500/20 bg-slate-500/10 text-slate-400" :
                          isExpired ? "border-red-500/20 bg-red-500/10 text-red-400" :
                          "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        }`}>
                        {!m.active ? "Inactive" : isExpired ? "Expired" : "Active"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">
                      {m.notes || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        <button onClick={() => startEdit(m)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition">
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => handleDelete(m.id)}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20 transition">
                          <Trash2 size={11} />
                        </button>
                      </div>
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
