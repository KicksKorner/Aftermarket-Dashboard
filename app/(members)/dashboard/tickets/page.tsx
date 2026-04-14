"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Ticket, Plus, Trash2, Bell, TrendingUp, PoundSterling, CalendarDays, Settings, Check } from "lucide-react";

const supabase = createClient();

type TicketItem = {
  id: string;
  event_name: string;
  venue: string | null;
  seat_info: string | null;
  event_date: string | null;
  transfer_deadline: string | null;
  cost_price: number;
  sell_price: number | null;
  status: "holding" | "sold" | "transferred" | "expired";
  discord_reminder: boolean;
  notes: string | null;
  created_at: string;
};

const statusStyles: Record<string, string> = {
  holding: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  sold: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  transferred: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  expired: "border-red-500/20 bg-red-500/10 text-red-300",
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showWebhookSettings, setShowWebhookSettings] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(true);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [venue, setVenue] = useState("");
  const [seatInfo, setSeatInfo] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [transferDeadline, setTransferDeadline] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [status, setStatus] = useState<TicketItem["status"]>("holding");
  const [discordReminder, setDiscordReminder] = useState(false);
  const [notes, setNotes] = useState("");

  const fetchWebhook = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setWebhookLoading(false); return; }
    const { data } = await supabase.from("profiles").select("ticket_webhook_url").eq("id", user.id).single();
    setWebhookUrl(data?.ticket_webhook_url ?? "");
    setWebhookLoading(false);
  }, []);

  useEffect(() => { fetchTickets(); fetchWebhook(); }, [fetchWebhook]);

  async function fetchTickets() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase.from("tickets").select("*").eq("user_id", user.id).order("event_date", { ascending: true });
    setTickets((data || []) as TicketItem[]);
    setLoading(false);
  }

  async function handleSaveWebhook() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("profiles").update({ ticket_webhook_url: webhookUrl.trim() || null }).eq("id", user.id);
    setWebhookSaved(true);
    setTimeout(() => setWebhookSaved(false), 2000);
  }

  async function handleTestWebhook() {
    if (!webhookUrl.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await fetch(webhookUrl.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "Aftermarket Arbitrage",
          embeds: [{
            title: "🎟️ Ticket Reminder Test",
            description: "This is a test reminder from your Aftermarket Arbitrage dashboard. If you can see this, your webhook is working correctly!",
            color: 0x3b82f6,
            footer: { text: "Aftermarket Arbitrage · Ticket Reminders" },
          }],
        }),
      });
      setTestResult(res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTestSending(false);
    }
  }

  async function sendReminder(ticket: TicketItem) {
    if (!webhookUrl.trim() || !ticket.discord_reminder) return;
    const daysUntil = ticket.transfer_deadline
      ? Math.ceil((new Date(ticket.transfer_deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    await fetch(webhookUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Aftermarket Arbitrage",
        embeds: [{
          title: `⏰ Transfer Deadline Reminder — ${ticket.event_name}`,
          color: daysUntil !== null && daysUntil <= 1 ? 0xef4444 : 0xf59e0b,
          fields: [
            { name: "Event", value: ticket.event_name, inline: true },
            { name: "Transfer Deadline", value: ticket.transfer_deadline ?? "—", inline: true },
            { name: "Days Remaining", value: daysUntil !== null ? `${daysUntil} day(s)` : "—", inline: true },
            ...(ticket.venue ? [{ name: "Venue", value: ticket.venue, inline: true }] : []),
            ...(ticket.seat_info ? [{ name: "Seat Info", value: ticket.seat_info, inline: true }] : []),
          ],
          footer: { text: "Aftermarket Arbitrage · Ticket Reminders" },
        }],
      }),
    });
  }

  function resetForm() {
    setEventName(""); setVenue(""); setSeatInfo(""); setEventDate("");
    setTransferDeadline(""); setCostPrice(""); setSellPrice("");
    setStatus("holding"); setDiscordReminder(false); setNotes("");
    setEditId(null);
  }

  function openEdit(t: TicketItem) {
    setEditId(t.id);
    setEventName(t.event_name); setVenue(t.venue ?? ""); setSeatInfo(t.seat_info ?? "");
    setEventDate(t.event_date ?? ""); setTransferDeadline(t.transfer_deadline ?? "");
    setCostPrice(String(t.cost_price)); setSellPrice(t.sell_price ? String(t.sell_price) : "");
    setStatus(t.status); setDiscordReminder(t.discord_reminder); setNotes(t.notes ?? "");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eventName.trim() || !costPrice) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload = {
      user_id: user.id,
      event_name: eventName.trim(), venue: venue.trim() || null,
      seat_info: seatInfo.trim() || null, event_date: eventDate || null,
      transfer_deadline: transferDeadline || null, cost_price: Number(costPrice),
      sell_price: sellPrice ? Number(sellPrice) : null, status,
      discord_reminder: discordReminder, notes: notes.trim() || null,
    };

    if (editId) {
      await supabase.from("tickets").update(payload).eq("id", editId);
    } else {
      const { data: newTicket } = await supabase.from("tickets").insert(payload).select().single();
      if (newTicket && discordReminder && webhookUrl.trim()) {
        await sendReminder(newTicket as TicketItem);
      }
    }

    resetForm(); setShowForm(false); setSaving(false); fetchTickets();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this ticket?")) return;
    await supabase.from("tickets").delete().eq("id", id);
    fetchTickets();
  }

  async function handleSendReminder(ticket: TicketItem) {
    if (!webhookUrl.trim()) {
      alert("Please add your Discord webhook URL in settings first.");
      setShowWebhookSettings(true);
      return;
    }
    await sendReminder(ticket);
    alert("Reminder sent to Discord!");
  }

  const totalCost = tickets.reduce((s, t) => s + Number(t.cost_price), 0);
  const totalRevenue = tickets.reduce((s, t) => s + (t.sell_price ? Number(t.sell_price) : 0), 0);
  const totalProfit = totalRevenue - tickets.filter((t) => t.sell_price).reduce((s, t) => s + Number(t.cost_price), 0);
  const holding = tickets.filter((t) => t.status === "holding").length;

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-400">🎟️</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
              <p className="mt-1 text-sm text-slate-400">Track tickets, set transfer reminders and log profit.</p>
            </div>
          </div>
          <button
            onClick={() => setShowWebhookSettings(!showWebhookSettings)}
            className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
          >
            <Settings size={14} />
            Reminder Settings
          </button>
        </div>

        {/* Webhook settings panel */}
        {showWebhookSettings && (
          <div className="mb-5 rounded-[20px] border border-blue-500/15 bg-[#081120] p-5">
            <h3 className="mb-1 text-sm font-semibold text-white flex items-center gap-2">
              <Bell size={14} className="text-blue-300" />
              Discord Reminder Webhook
            </h3>
            <p className="mb-4 text-xs text-slate-500">
              Paste your personal Discord webhook URL below. When you toggle reminders on a ticket, alerts will be sent to this webhook. To create one: Discord server → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={webhookLoading ? "" : webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/30"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveWebhook}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition ${webhookSaved ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
                >
                  {webhookSaved ? <><Check size={13} />Saved</> : "Save"}
                </button>
                <button
                  onClick={handleTestWebhook}
                  disabled={!webhookUrl.trim() || testSending}
                  className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-2.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-40"
                >
                  {testSending ? "Sending..." : "Test"}
                </button>
              </div>
            </div>
            {testResult === "success" && <p className="mt-2 text-xs text-emerald-400">Test sent successfully — check your Discord channel.</p>}
            {testResult === "error" && <p className="mt-2 text-xs text-red-400">Failed to send. Check the webhook URL is correct.</p>}
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Holding", value: String(holding), icon: Ticket, cls: "border-blue-500/20 bg-blue-500/10 text-blue-300" },
            { label: "Total Cost", value: `£${totalCost.toFixed(2)}`, icon: PoundSterling, cls: "border-amber-500/20 bg-amber-500/10 text-amber-300" },
            { label: "Total Revenue", value: `£${totalRevenue.toFixed(2)}`, icon: CalendarDays, cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" },
            { label: "Net Profit", value: `£${totalProfit.toFixed(2)}`, icon: TrendingUp, cls: totalProfit >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border ${s.cls}`}><Icon size={18} /></div>
                <div className="text-2xl font-semibold text-white">{loading ? "..." : s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{s.label}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.72),rgba(5,10,26,0.88))] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">My Tickets</h2>
            <p className="mt-1 text-sm text-slate-400">Add and manage your ticket purchases.</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }}
            className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
            <Plus size={15} />Add Ticket
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-[20px] border border-blue-500/15 bg-[#081120] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">{editId ? "Edit Ticket" : "New Ticket"}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Event Name *</label>
                <input value={eventName} onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Taylor Swift — Wembley Stadium"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/30" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Transfer Deadline</label>
                <input type="date" value={transferDeadline} onChange={(e) => setTransferDeadline(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Event Date</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Venue / Event Location</label>
                <input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="O2 Arena, London..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Seat Info</label>
                <input value={seatInfo} onChange={(e) => setSeatInfo(e.target.value)} placeholder="Block A, Row 12, Seats 4–5..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Cost Price (£) *</label>
                <input type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="0.00" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Sell Price (£)</label>
                <input type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="Leave blank if not sold yet"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TicketItem["status"])}
                  className="w-full rounded-xl border border-white/10 bg-[#182235] px-3 py-2.5 text-sm text-white outline-none">
                  <option value="holding">Holding</option>
                  <option value="sold">Sold</option>
                  <option value="transferred">Transferred</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-400">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Order ref, buyer details, platform used..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 resize-none" />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-2"><Bell size={14} className="text-blue-300" />Send Discord Reminder</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {webhookUrl.trim() ? "Sends to your saved webhook URL — 7 days, 1 day, and day of transfer deadline" : "Add your webhook URL in Reminder Settings first"}
                  </p>
                </div>
                <button type="button" onClick={() => setDiscordReminder(!discordReminder)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${discordReminder ? "bg-blue-600" : "bg-white/10"}`}>
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${discordReminder ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                {saving ? "Saving..." : editId ? "Save Changes" : "Add Ticket"}
              </button>
              <button type="button" onClick={() => { resetForm(); setShowForm(false); }}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-white hover:bg-white/5">
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Ticket size={32} className="mb-3 text-slate-700" />
            <p className="text-sm font-medium text-slate-400">No tickets yet.</p>
            <p className="mt-1 text-xs text-slate-600">Click "Add Ticket" to track your first purchase.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => {
              const profit = t.sell_price ? Number(t.sell_price) - Number(t.cost_price) : null;
              const daysUntilDeadline = getDaysUntil(t.transfer_deadline);
              const daysUntilEvent = getDaysUntil(t.event_date);
              return (
                <div key={t.id} className="rounded-[20px] border border-white/8 bg-[#081120] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-base font-semibold text-white">{t.event_name}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[t.status] ?? statusStyles.holding}`}>{t.status}</span>
                        {t.discord_reminder && webhookUrl.trim() && (
                          <span className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs text-blue-300">
                            <Bell size={10} />Reminder on
                          </span>
                        )}
                        {t.discord_reminder && !webhookUrl.trim() && (
                          <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs text-amber-300">
                            <Bell size={10} />No webhook set
                          </span>
                        )}
                      </div>
                      <div className="grid gap-x-6 gap-y-1 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                        {t.venue && <p>📍 {t.venue}</p>}
                        {t.seat_info && <p>💺 {t.seat_info}</p>}
                        {t.event_date && (
                          <p className={daysUntilEvent !== null && daysUntilEvent <= 7 ? "text-amber-400" : ""}>
                            🗓️ Event: {t.event_date}{daysUntilEvent !== null && daysUntilEvent >= 0 && ` (${daysUntilEvent}d)`}
                          </p>
                        )}
                        {t.transfer_deadline && (
                          <p className={daysUntilDeadline !== null && daysUntilDeadline <= 3 ? "text-red-400 font-medium" : daysUntilDeadline !== null && daysUntilDeadline <= 7 ? "text-amber-400" : ""}>
                            ⏰ Transfer by: {t.transfer_deadline}{daysUntilDeadline !== null && daysUntilDeadline >= 0 && ` (${daysUntilDeadline}d)`}
                          </p>
                        )}
                        {t.notes && <p className="sm:col-span-2 lg:col-span-3 text-slate-500">📝 {t.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 lg:flex-col lg:items-end lg:gap-2">
                      <div className="flex gap-4 text-sm">
                        <div className="text-right">
                          <p className="text-xs text-slate-500">Cost</p>
                          <p className="font-semibold text-white">£{Number(t.cost_price).toFixed(2)}</p>
                        </div>
                        {t.sell_price && (
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Sold for</p>
                            <p className="font-semibold text-white">£{Number(t.sell_price).toFixed(2)}</p>
                          </div>
                        )}
                        {profit !== null && (
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Profit</p>
                            <p className={`font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {profit >= 0 ? "+" : ""}£{profit.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {t.discord_reminder && t.status === "holding" && (
                          <button onClick={() => handleSendReminder(t)}
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-300 hover:bg-blue-500/20 flex items-center gap-1">
                            <Bell size={11} />Remind
                          </button>
                        )}
                        <button onClick={() => openEdit(t)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">Edit</button>
                        <button onClick={() => handleDelete(t.id)}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
