"use client";

import { useEffect, useState, useRef } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import {
  PackageSearch, User, Plus, Trash2, CheckCircle2, AlertTriangle,
  Clock, CalendarDays, CreditCard, MapPin, Mail, Phone,
  ChevronDown, Upload, X, Save, Package, Loader2, Bell,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "orders" | "profiles";

type Profile = {
  id: string;
  profile_name: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  address_1: string | null;
  address_2: string | null;
  city: string | null;
  postcode: string | null;
  country: string | null;
  county: string | null;
  card_last4: string | null;
  card_expiry: string | null;
};

type Order = {
  id: string;
  item_name: string;
  quantity: number;
  price_per_unit: number;
  release_date: string | null;
  payment_date: string | null;
  profile_id: string | null;
  notes: string | null;
  no_email_flag: boolean;
  status: string;
  profile?: Profile;
};

type ProfileForm = {
  profile_name: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  address_1: string;
  address_2: string;
  city: string;
  postcode: string;
  country: string;
  county: string;
  card_last4: string;
  card_expiry: string;
};

const emptyProfileForm: ProfileForm = {
  profile_name: "", email: "", phone: "",
  first_name: "", last_name: "",
  address_1: "", address_2: "",
  city: "", postcode: "", country: "United Kingdom", county: "",
  card_last4: "", card_expiry: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CountdownBadge({ days, label }: { days: number | null; label: string }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-xs text-slate-500">Passed</span>;
  const urgent = days <= 7;
  const soon = days <= 14;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border
      ${urgent ? "border-red-500/30 bg-red-500/10 text-red-400" :
        soon ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
        "border-blue-500/20 bg-blue-500/10 text-blue-400"}`}>
      <Clock size={10} />
      {days === 0 ? `${label} today` : `${label} in ${days}d`}
    </span>
  );
}

// ─── Profile Card (visual like the screenshot) ────────────────────────────────
function ProfileCard({ form }: { form: ProfileForm }) {
  const expiry = form.card_expiry || "MM/YY";
  const last4 = form.card_last4 || "••••";
  const name = [form.first_name, form.last_name].filter(Boolean).join(" ") || "CARD HOLDER";
  return (
    <div className="relative h-44 w-full rounded-2xl overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 60%, #8b5cf6 100%)" }}>
      <div className="absolute inset-0 opacity-20"
        style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
      <div className="absolute top-4 left-5 flex gap-2">
        <div className="w-8 h-6 rounded-sm bg-yellow-400/90" />
        <div className="w-6 h-6 rounded-full border-2 border-white/40" />
      </div>
      <div className="absolute top-4 right-5 text-white font-bold text-lg tracking-widest opacity-90">VISA</div>
      <div className="absolute top-16 left-5 text-white/70 text-sm tracking-[0.3em] font-mono">
        •••• •••• •••• {last4}
      </div>
      <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
        <div>
          <p className="text-white/50 text-[9px] uppercase tracking-widest">Card Holder</p>
          <p className="text-white font-semibold text-sm tracking-wide">{name.toUpperCase()}</p>
        </div>
        <div className="text-right">
          <p className="text-white/50 text-[9px] uppercase tracking-widest">Expires</p>
          <p className="text-white font-semibold text-sm">{expiry}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PokemonCheckoutsPage() {
  const supabase = createClientComponentClient();
  const [tab, setTab] = useState<Tab>("orders");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfileForm);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Order form state
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    item_name: "", quantity: "1", price_per_unit: "",
    release_date: "", payment_date: "",
    profile_id: "", notes: "", no_email_flag: false,
  });
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");

  // CSV import
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvMsg, setCsvMsg] = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from("preorder_profiles").select("*").order("created_at", { ascending: true }),
      supabase.from("preorder_orders").select("*, profile:preorder_profiles(*)").order("release_date", { ascending: true }),
    ]);
    setProfiles(p || []);
    setOrders((o || []) as Order[]);
    setLoading(false);
  }

  // ── Save Profile ─────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!profileForm.profile_name.trim()) { setProfileMsg("Profile name is required."); return; }
    setSavingProfile(true);
    setProfileMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("preorder_profiles").insert({
      user_id: user.id,
      ...profileForm,
      card_last4: profileForm.card_last4.slice(-4),
    });
    setSavingProfile(false);
    if (error) { setProfileMsg(error.message); return; }
    setProfileMsg("Profile saved!");
    setProfileForm(emptyProfileForm);
    setShowProfileForm(false);
    loadAll();
  }

  // ── Delete Profile ────────────────────────────────────────────────────────────
  async function deleteProfile(id: string) {
    if (!confirm("Delete this profile?")) return;
    await supabase.from("preorder_profiles").delete().eq("id", id);
    loadAll();
  }

  // ── Save Order ────────────────────────────────────────────────────────────────
  async function saveOrder() {
    if (!orderForm.item_name.trim()) { setOrderMsg("Item name is required."); return; }
    setSavingOrder(true);
    setOrderMsg("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("preorder_orders").insert({
      user_id: user.id,
      item_name: orderForm.item_name,
      quantity: parseInt(orderForm.quantity) || 1,
      price_per_unit: parseFloat(orderForm.price_per_unit) || 0,
      release_date: orderForm.release_date || null,
      payment_date: orderForm.payment_date || null,
      profile_id: orderForm.profile_id || null,
      notes: orderForm.notes || null,
      no_email_flag: orderForm.no_email_flag,
      status: "active",
    });
    setSavingOrder(false);
    if (error) { setOrderMsg(error.message); return; }
    setOrderMsg("Order logged!");
    setOrderForm({ item_name: "", quantity: "1", price_per_unit: "", release_date: "", payment_date: "", profile_id: "", notes: "", no_email_flag: false });
    setShowOrderForm(false);
    loadAll();
  }

  // ── Mark Delivered ────────────────────────────────────────────────────────────
  async function markDelivered(id: string) {
    await supabase.from("preorder_orders").update({ status: "delivered" }).eq("id", id);
    loadAll();
  }

  // ── Delete Order ──────────────────────────────────────────────────────────────
  async function deleteOrder(id: string) {
    if (!confirm("Delete this order?")) return;
    await supabase.from("preorder_orders").delete().eq("id", id);
    loadAll();
  }

  // ── Update Release Date ───────────────────────────────────────────────────────
  async function updateReleaseDate(id: string, date: string) {
    await supabase.from("preorder_orders").update({ release_date: date }).eq("id", id);
    loadAll();
  }

  // ── CSV Import ────────────────────────────────────────────────────────────────
  async function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvMsg("Importing...");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const text = await file.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());

    const idx = (name: string) => headers.indexOf(name);
    let imported = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      const cardRaw = cols[idx("Card Number")] || "";
      const last4 = cardRaw.replace(/\s/g, "").slice(-4);
      const expMonth = cols[idx("Card Exp Month")] || "";
      const expYear = (cols[idx("Card Exp Year")] || "").slice(-2);
      const expiry = expMonth && expYear ? `${expMonth.padStart(2,"0")}/${expYear}` : "";

      await supabase.from("preorder_profiles").insert({
        user_id: user.id,
        profile_name: cols[idx("Profile Name")] || `Profile ${i}`,
        email: cols[idx("Email")] || null,
        phone: cols[idx("Phone")] || null,
        first_name: cols[idx("Delivery First Name")] || null,
        last_name: cols[idx("Delivery Last Name")] || null,
        address_1: cols[idx("Delivery Address 1")] || null,
        address_2: cols[idx("Delivery Address 2")] || null,
        city: cols[idx("Delivery City")] || null,
        postcode: cols[idx("Delivery ZIP")] || null,
        country: cols[idx("Delivery Country")] || null,
        county: cols[idx("Delivery State")] || null,
        card_last4: last4,
        card_expiry: expiry,
      });
      imported++;
    }
    setCsvMsg(`✅ Imported ${imported} profile${imported !== 1 ? "s" : ""}`);
    if (csvRef.current) csvRef.current.value = "";
    loadAll();
  }

  const activeOrders = orders.filter(o => o.status !== "delivered");
  const deliveredOrders = orders.filter(o => o.status === "delivered");

  const inputCls = "w-full rounded-xl border border-white/10 bg-[#030814] px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-400/40 transition";
  const labelCls = "block text-xs font-medium text-slate-400 mb-1.5";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-4 rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_20px_50px_rgba(0,0,0,0.22)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
            <PackageSearch size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pokémon Checkouts</h1>
            <p className="mt-1 text-sm text-slate-400">Track preorders, profiles and payment dates — never lose an order again.</p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-full border border-white/10 bg-[#0a1228] px-3 py-1.5">
            <span className="text-slate-500">Active: </span><span className="font-semibold text-white">{activeOrders.length}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-[#0a1228] px-3 py-1.5">
            <span className="text-slate-500">Profiles: </span><span className="font-semibold text-white">{profiles.length}</span>
          </span>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["orders", "My Orders", Package], ["profiles", "My Profiles", User]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition
              ${tab === t ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "border border-white/10 bg-white/5 text-slate-400 hover:text-white"}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── ORDERS TAB ── */}
      {tab === "orders" && (
        <div className="space-y-4">
          {/* Add Order Button */}
          <div className="flex justify-end">
            <button onClick={() => setShowOrderForm(!showOrderForm)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition">
              <Plus size={15} /> Log New Order
            </button>
          </div>

          {/* Add Order Form */}
          {showOrderForm && (
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6 space-y-4">
              <h2 className="font-semibold text-white">Log a Preorder</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelCls}>Item Name</label>
                  <input value={orderForm.item_name} onChange={e => setOrderForm(p => ({...p, item_name: e.target.value}))}
                    placeholder="e.g. Prismatic Evolutions ETB" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Quantity</label>
                  <input type="number" min="1" value={orderForm.quantity} onChange={e => setOrderForm(p => ({...p, quantity: e.target.value}))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Price Per Unit (£)</label>
                  <input type="number" step="0.01" value={orderForm.price_per_unit} onChange={e => setOrderForm(p => ({...p, price_per_unit: e.target.value}))}
                    placeholder="49.99" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Release / Delivery Date</label>
                  <input type="date" value={orderForm.release_date} onChange={e => setOrderForm(p => ({...p, release_date: e.target.value}))}
                    className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Expected Payment Date</label>
                  <input type="date" value={orderForm.payment_date} onChange={e => setOrderForm(p => ({...p, payment_date: e.target.value}))}
                    className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Profile Used</label>
                  <select value={orderForm.profile_id} onChange={e => setOrderForm(p => ({...p, profile_id: e.target.value}))}
                    className={inputCls}>
                    <option value="">— Select a profile —</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.profile_name} — {p.first_name} {p.last_name} {p.card_last4 ? `(••••${p.card_last4})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={orderForm.notes} onChange={e => setOrderForm(p => ({...p, notes: e.target.value}))}
                    placeholder="e.g. No confirmation email received" rows={2} className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={orderForm.no_email_flag} onChange={e => setOrderForm(p => ({...p, no_email_flag: e.target.checked}))}
                      className="h-4 w-4 accent-amber-500" />
                    <span className="text-sm text-amber-400">⚠️ No confirmation email received</span>
                  </label>
                </div>
              </div>
              {orderMsg && <p className="text-sm text-blue-300">{orderMsg}</p>}
              <div className="flex gap-3">
                <button onClick={saveOrder} disabled={savingOrder}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition disabled:opacity-50">
                  {savingOrder ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save Order
                </button>
                <button onClick={() => setShowOrderForm(false)}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 hover:text-white transition">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Orders List */}
          {activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] py-16 text-center">
              <PackageSearch size={32} className="mb-3 text-slate-600" />
              <p className="text-base font-semibold text-white">No active orders</p>
              <p className="mt-1 text-sm text-slate-500">Log a preorder above to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(order => {
                const releaseCountdown = daysUntil(order.release_date);
                const paymentCountdown = daysUntil(order.payment_date);
                const paymentUrgent = paymentCountdown !== null && paymentCountdown <= 7 && paymentCountdown >= 0;
                const profile = order.profile as Profile | undefined;

                return (
                  <div key={order.id}
                    className={`rounded-[20px] border bg-[linear-gradient(160deg,rgba(9,18,46,0.95),rgba(3,8,20,0.98))] p-5 transition
                      ${paymentUrgent ? "border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.08)]" : "border-white/[0.07]"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-2">
                        {/* Title row */}
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-white">{order.item_name}</h3>
                          {order.no_email_flag && (
                            <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                              <AlertTriangle size={10} /> No email
                            </span>
                          )}
                        </div>

                        {/* Meta */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          <span>Qty: <span className="text-white">{order.quantity}</span></span>
                          <span>£{(order.price_per_unit * order.quantity).toFixed(2)} total</span>
                          {order.release_date && (
                            <span className="flex items-center gap-1">
                              <CalendarDays size={11} /> Release: {formatDate(order.release_date)}
                            </span>
                          )}
                          {order.payment_date && (
                            <span className={`flex items-center gap-1 ${paymentUrgent ? "text-red-400" : ""}`}>
                              <CreditCard size={11} /> Payment: {formatDate(order.payment_date)}
                            </span>
                          )}
                        </div>

                        {/* Countdowns */}
                        <div className="flex flex-wrap gap-2">
                          <CountdownBadge days={releaseCountdown} label="Release" />
                          <CountdownBadge days={paymentCountdown} label="Payment" />
                        </div>

                        {/* Profile */}
                        {profile && (
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><User size={11} /> {profile.profile_name}</span>
                            <span className="flex items-center gap-1"><MapPin size={11} /> {[profile.address_1, profile.city, profile.postcode].filter(Boolean).join(", ")}</span>
                            <span className="flex items-center gap-1"><Mail size={11} /> {profile.email}</span>
                            {profile.card_last4 && <span className="flex items-center gap-1"><CreditCard size={11} /> ••••{profile.card_last4}</span>}
                          </div>
                        )}

                        {/* Notes */}
                        {order.notes && (
                          <p className="text-xs text-slate-500 italic">📝 {order.notes}</p>
                        )}

                        {/* Editable release date */}
                        <div className="flex items-center gap-2 pt-1">
                          <label className="text-xs text-slate-500">Update release date:</label>
                          <input type="date" defaultValue={order.release_date || ""}
                            onBlur={e => { if (e.target.value !== order.release_date) updateReleaseDate(order.id, e.target.value); }}
                            className="rounded-lg border border-white/10 bg-[#030814] px-2 py-1 text-xs text-white outline-none focus:border-blue-400/40" />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 lg:flex-col lg:items-end">
                        <button onClick={() => markDelivered(order.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition">
                          <CheckCircle2 size={13} /> Mark Delivered
                        </button>
                        <button onClick={() => deleteOrder(order.id)}
                          className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/20 transition">
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Delivered orders (collapsed) */}
          {deliveredOrders.length > 0 && (
            <details className="rounded-[20px] border border-white/[0.07] bg-[#071021] p-4">
              <summary className="cursor-pointer text-sm font-medium text-slate-400 flex items-center gap-2 list-none">
                <CheckCircle2 size={14} className="text-emerald-500" />
                {deliveredOrders.length} Delivered Order{deliveredOrders.length !== 1 ? "s" : ""}
              </summary>
              <div className="mt-3 space-y-2">
                {deliveredOrders.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-xl border border-white/5 px-4 py-2.5 text-sm">
                    <div>
                      <span className="text-slate-400 line-through">{o.item_name}</span>
                      <span className="ml-2 text-xs text-slate-600">×{o.quantity}</span>
                    </div>
                    <button onClick={() => deleteOrder(o.id)} className="text-slate-600 hover:text-red-400 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── PROFILES TAB ── */}
      {tab === "profiles" && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <button onClick={() => setShowProfileForm(!showProfileForm)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition">
              <Plus size={15} /> Add Profile
            </button>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:border-white/20 transition">
              <Upload size={15} /> Import CSV
              <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
            </label>
          </div>
          {csvMsg && <p className="text-sm text-blue-300">{csvMsg}</p>}

          {/* Profile Form — styled like screenshot */}
          {showProfileForm && (
            <div className="rounded-[24px] border border-blue-500/15 bg-[#071021] p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-white text-lg">Create Profile</h2>
                <button onClick={() => setShowProfileForm(false)} className="text-slate-500 hover:text-white transition">
                  <X size={18} />
                </button>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Left: form */}
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Profile Name</label>
                    <input value={profileForm.profile_name} onChange={e => setProfileForm(p => ({...p, profile_name: e.target.value}))}
                      placeholder="Profile Name" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input value={profileForm.email} onChange={e => setProfileForm(p => ({...p, email: e.target.value}))}
                        placeholder="Email" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Phone</label>
                      <input value={profileForm.phone} onChange={e => setProfileForm(p => ({...p, phone: e.target.value}))}
                        placeholder="Phone" className={inputCls} />
                    </div>
                  </div>

                  {/* Shipping Address */}
                  <div className="rounded-2xl border border-white/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                      <MapPin size={14} className="text-emerald-400" /> Shipping Address
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>First Name</label>
                        <input value={profileForm.first_name} onChange={e => setProfileForm(p => ({...p, first_name: e.target.value}))}
                          placeholder="First Name" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Last Name</label>
                        <input value={profileForm.last_name} onChange={e => setProfileForm(p => ({...p, last_name: e.target.value}))}
                          placeholder="Last Name" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Address 1</label>
                        <input value={profileForm.address_1} onChange={e => setProfileForm(p => ({...p, address_1: e.target.value}))}
                          placeholder="Address 1" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Address 2 (Optional)</label>
                        <input value={profileForm.address_2} onChange={e => setProfileForm(p => ({...p, address_2: e.target.value}))}
                          placeholder="Address 2 (Optional)" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Country</label>
                        <input value={profileForm.country} onChange={e => setProfileForm(p => ({...p, country: e.target.value}))}
                          placeholder="United Kingdom" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>County / State</label>
                        <input value={profileForm.county} onChange={e => setProfileForm(p => ({...p, county: e.target.value}))}
                          placeholder="e.g. Lincolnshire" className={inputCls} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>City</label>
                        <input value={profileForm.city} onChange={e => setProfileForm(p => ({...p, city: e.target.value}))}
                          placeholder="City" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Postcode</label>
                        <input value={profileForm.postcode} onChange={e => setProfileForm(p => ({...p, postcode: e.target.value}))}
                          placeholder="Postcode" className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: card preview + payment info */}
                <div className="space-y-4">
                  <ProfileCard form={profileForm} />

                  <div className="rounded-2xl border border-white/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                      <CreditCard size={14} className="text-emerald-400" /> Payment Information
                    </div>
                    <div>
                      <label className={labelCls}>Card Holder Name</label>
                      <input
                        value={[profileForm.first_name, profileForm.last_name].filter(Boolean).join(" ")}
                        readOnly
                        placeholder="Auto-filled from name above"
                        className={`${inputCls} opacity-60 cursor-default`} />
                    </div>
                    <div>
                      <label className={labelCls}>Last 4 Digits</label>
                      <input
                        value={profileForm.card_last4}
                        onChange={e => setProfileForm(p => ({...p, card_last4: e.target.value.replace(/\D/g, "").slice(0,4)}))}
                        placeholder="e.g. 6327"
                        maxLength={4}
                        className={inputCls} />
                      <p className="mt-1.5 text-[11px] text-slate-600">We only store the last 4 digits for identification purposes.</p>
                    </div>
                    <div>
                      <label className={labelCls}>Expiry Date</label>
                      <input
                        value={profileForm.card_expiry}
                        onChange={e => setProfileForm(p => ({...p, card_expiry: e.target.value}))}
                        placeholder="MM/YY"
                        maxLength={5}
                        className={inputCls} />
                    </div>
                  </div>

                  {profileMsg && <p className="text-sm text-blue-300">{profileMsg}</p>}

                  <button onClick={saveProfile} disabled={savingProfile}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                    {savingProfile ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Create Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Profiles List */}
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] py-16 text-center">
              <User size={32} className="mb-3 text-slate-600" />
              <p className="text-base font-semibold text-white">No profiles yet</p>
              <p className="mt-1 text-sm text-slate-500">Add a profile above or import via CSV.</p>
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/[0.07] bg-[#071021] overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-0 border-b border-white/10 px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                <span className="w-8">#</span>
                <span>Profile</span>
                <span>Name</span>
                <span>Email</span>
                <span></span>
              </div>
              {profiles.map((profile, i) => (
                <div key={profile.id}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-0 items-center border-b border-white/5 px-5 py-4 hover:bg-white/[0.02] transition last:border-0">
                  <span className="w-8 text-xs text-slate-600">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{profile.profile_name}</p>
                    <p className="text-xs text-slate-500">
                      {profile.card_last4 ? `MASTERCARD ••${profile.card_last4}` : "No card"} · {profile.card_expiry || "—"}
                    </p>
                  </div>
                  <p className="text-sm text-slate-300">{[profile.first_name, profile.last_name].filter(Boolean).join(" ")}</p>
                  <p className="text-sm text-slate-400 truncate pr-4">{profile.email || "—"}</p>
                  <button onClick={() => deleteProfile(profile.id)}
                    className="text-slate-600 hover:text-red-400 transition p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
