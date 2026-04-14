"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Shield,
  LogOut,
  Boxes,
  Receipt,
  Mail,
  Footprints,
  Menu,
  X,
  Send,
  Webhook,
} from "lucide-react";

type SidebarProps = {
  role: string;
  email: string;
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  startsWith?: boolean;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/deal-post",
    label: "Deal Poster",
    icon: Send,
    startsWith: true,
  },
  {
    href: "/dashboard/ama-webhook",
    label: "AMA Webhook",
    icon: Webhook,
    startsWith: true,
  },
  {
    href: "/dashboard/sole-scan",
    label: "Sole Scan",
    icon: Footprints,
    startsWith: true,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory Tracker",
    icon: Boxes,
    startsWith: true,
  },
  {
    href: "/dashboard/expenses",
    label: "Expenses",
    icon: Receipt,
    startsWith: true,
  },
  {
    href: "/dashboard/gmail-sync",
    label: "Gmail Sync",
    icon: Mail,
    startsWith: true,
  },
  {
    href: "/guides",
    label: "Guides",
    icon: BookOpen,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Shield,
    adminOnly: true,
  },
];

function SidebarContent({
  role,
  email,
  pathname,
  onNavigate,
}: {
  role: string;
  email: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const baseItem =
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";
  const activeItem =
    "border border-white/10 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
  const inactiveItem = "text-slate-300 hover:bg-white/5 hover:text-white";

  const filteredItems = useMemo(() => {
    return navItems.filter((item) => !item.adminOnly || role === "admin");
  }, [role]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-8 flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Aftermarket Arbitrage"
          width={42}
          height={42}
          className="rounded-lg"
        />
        <div>
          <p className="text-xs text-blue-300">Aftermarket Arbitrage</p>
          <h1 className="text-xl font-semibold tracking-tight">Members Area</h1>
        </div>
      </div>

      <div className="mb-8 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,27,60,0.95),rgba(7,16,33,0.9))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
          Signed in as
        </p>
        <p className="mt-3 truncate text-sm text-slate-200">{email}</p>
        <p className="mt-2 inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-emerald-300">
          {role}
        </p>
      </div>

      <nav className="space-y-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.startsWith
            ? pathname.startsWith(item.href)
            : pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`${baseItem} ${isActive ? activeItem : inactiveItem}`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-600/15 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600/25">
            <LogOut size={18} />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-[#071021]/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Aftermarket Arbitrage"
              width={34}
              height={34}
              className="rounded-lg"
            />
            <div>
              <p className="text-[11px] text-blue-300">Aftermarket Arbitrage</p>
              <p className="text-base font-semibold leading-tight text-white">
                Members Area
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      <aside className="hidden h-screen w-[270px] border-r border-white/10 bg-[#071021]/80 p-6 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:flex-col">
        <SidebarContent role={role} email={email} pathname={pathname} />
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close menu overlay"
          />

          <aside className="absolute left-0 top-0 h-full w-[86%] max-w-[320px] border-r border-white/10 bg-[#071021] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Aftermarket Arbitrage"
                  width={38}
                  height={38}
                  className="rounded-lg"
                />
                <div>
                  <p className="text-xs text-blue-300">Aftermarket Arbitrage</p>
                  <p className="text-lg font-semibold text-white">
                    Members Area
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <SidebarContent
              role={role}
              email={email}
              pathname={pathname}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
