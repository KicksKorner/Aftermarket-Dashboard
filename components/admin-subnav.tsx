"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminLinks = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/guides", label: "Guides" },
  { href: "/dashboard/deal-post", label: "Deal Poster" },
  { href: "/dashboard/ama-webhook", label: "AMA Webhook" },
];

export default function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {adminLinks.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
