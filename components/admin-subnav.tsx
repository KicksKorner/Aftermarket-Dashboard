"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", href: "/admin" },
  { label: "Amazon Invites", href: "/admin/amazon-invites" },
  { label: "Pokemon Products", href: "/admin/pokemon-products" },
  { label: "Guides", href: "/admin/guides" },
];

export default function AdminSubnav() {
  const pathname = usePathname();

  return (
    <div className="mb-8 flex flex-wrap gap-3">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-2xl px-4 py-3 text-sm font-medium transition",
              active
                ? "border border-white/10 bg-white/10 text-white"
                : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}