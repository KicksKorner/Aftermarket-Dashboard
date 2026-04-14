"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Mail, Ticket, ShoppingCart, X, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const supabase = createClient();

type Notification = {
  id: string;
  type: "gmail" | "ticket" | "ebay" | "info";
  title: string;
  body: string;
  href: string;
  read: boolean;
  created_at: string;
};

const iconMap = {
  gmail: Mail,
  ticket: Ticket,
  ebay: ShoppingCart,
  info: Bell,
};

const colourMap = {
  gmail: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  ticket: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  ebay: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  info: "border-slate-500/20 bg-slate-500/10 text-slate-300",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    generateNotifications();
    // Close on outside click
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function generateNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const notifs: Notification[] = [];
    const now = new Date();

    // Check Gmail import queue
    const { count: gmailCount } = await supabase
      .from("gmail_imports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (gmailCount && gmailCount > 0) {
      notifs.push({
        id: "gmail-pending",
        type: "gmail",
        title: "Gmail orders pending",
        body: `${gmailCount} order${gmailCount > 1 ? "s" : ""} waiting for review in Gmail Sync`,
        href: "/dashboard/gmail-sync",
        read: false,
        created_at: now.toISOString(),
      });
    }

    // Check upcoming ticket transfer deadlines
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, event_name, transfer_deadline")
      .eq("user_id", user.id)
      .eq("status", "holding")
      .not("transfer_deadline", "is", null);

    if (tickets) {
      for (const ticket of tickets) {
        const daysUntil = Math.ceil(
          (new Date(ticket.transfer_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysUntil <= 7 && daysUntil >= 0) {
          notifs.push({
            id: `ticket-${ticket.id}`,
            type: "ticket",
            title: daysUntil === 0 ? "Transfer deadline TODAY" : `Transfer deadline in ${daysUntil} day${daysUntil > 1 ? "s" : ""}`,
            body: ticket.event_name,
            href: "/dashboard/tickets",
            read: false,
            created_at: now.toISOString(),
          });
        }
      }
    }

    // Check eBay connection status
    const { data: ebayConn } = await supabase
      .from("ebay_connections")
      .select("token_expires_at")
      .eq("user_id", user.id)
      .single();

    if (ebayConn) {
      const expiresIn = Math.ceil(
        (new Date(ebayConn.token_expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (expiresIn <= 3 && expiresIn >= 0) {
        notifs.push({
          id: "ebay-expiring",
          type: "ebay",
          title: "eBay session expiring",
          body: `Your eBay connection expires in ${expiresIn} day${expiresIn !== 1 ? "s" : ""} — reconnect to keep syncing`,
          href: "/dashboard/inventory",
          read: false,
          created_at: now.toISOString(),
        });
      }
    }

    setNotifications(notifs);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-[20px] border border-white/10 bg-[#081120] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white">
                <CheckCheck size={12} />Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell size={24} className="mb-2 text-slate-700" />
                <p className="text-sm text-slate-500">All caught up!</p>
                <p className="mt-1 text-xs text-slate-700">No notifications right now.</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = iconMap[notif.type];
                return (
                  <div key={notif.id} className={`flex items-start gap-3 px-4 py-3 transition hover:bg-white/5 ${!notif.read ? "bg-blue-500/5" : ""}`}>
                    <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border ${colourMap[notif.type]}`}>
                      <Icon size={13} />
                    </div>
                    <Link href={notif.href} onClick={() => { setOpen(false); dismiss(notif.id); }} className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{notif.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{notif.body}</p>
                    </Link>
                    <button onClick={() => dismiss(notif.id)} className="mt-0.5 flex-shrink-0 text-slate-600 hover:text-white">
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-2.5">
            <p className="text-center text-xs text-slate-600">Notifications refresh on page load</p>
          </div>
        </div>
      )}
    </div>
  );
}
