"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Link as LinkIcon,
  BookOpen,
  Shield,
  LogOut,
  Boxes,
  Receipt,
  Mail,
  Footprints,
} from "lucide-react";

export default function Sidebar({
  role,
  email,
}: {
  role: string;
  email: string;
}) {
  const pathname = usePathname();

  const baseItem =
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition";
  const activeItem =
    "border border-white/10 bg-white/10 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.02)]";
  const inactiveItem = "text-slate-300 hover:bg-white/5 hover:text-white";

  return (
    <aside className="w-[270px] border-r border-white/10 bg-[#071021]/80 p-6 backdrop-blur-xl">
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
        <Link
          href="/dashboard"
          className={`${baseItem} ${
            pathname === "/dashboard" ? activeItem : inactiveItem
          }`}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </Link>

        <Link
          href="/dashboard/sole-scan"
          className={`${baseItem} ${
            pathname.startsWith("/dashboard/sole-scan")
              ? activeItem
              : inactiveItem
          }`}
        >
          <Footprints size={18} />
          Sole Scan
        </Link>

        <Link
          href="/dashboard/inventory"
          className={`${baseItem} ${
            pathname.startsWith("/dashboard/inventory")
              ? activeItem
              : inactiveItem
          }`}
        >
          <Boxes size={18} />
          Inventory Tracker
        </Link>

        <Link
          href="/dashboard/expenses"
          className={`${baseItem} ${
            pathname.startsWith("/dashboard/expenses")
              ? activeItem
              : inactiveItem
          }`}
        >
          <Receipt size={18} />
          Expenses
        </Link>

        <Link
          href="/dashboard/gmail-sync"
          className={`${baseItem} ${
            pathname.startsWith("/dashboard/gmail-sync")
              ? activeItem
              : inactiveItem
          }`}
        >
          <Mail size={18} />
          Gmail Sync
        </Link>

        <Link
          href="/links"
          className={`${baseItem} ${
            pathname === "/links" ? activeItem : inactiveItem
          }`}
        >
          <LinkIcon size={18} />
          Amazon Invites
        </Link>

        <Link
          href="/guides"
          className={`${baseItem} ${
            pathname === "/guides" ? activeItem : inactiveItem
          }`}
        >
          <BookOpen size={18} />
          Guides
        </Link>

        {role === "admin" && (
          <Link
            href="/admin"
            className={`${baseItem} ${
              pathname === "/admin" ? activeItem : inactiveItem
            }`}
          >
            <Shield size={18} />
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-10">
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-2xl border border-blue-500/20 bg-blue-600/15 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-600/25">
            <LogOut size={18} />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}