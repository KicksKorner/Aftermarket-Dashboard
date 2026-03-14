"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  X,
  ClipboardList,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";

type Product = {
  id: number;
  title: string;
  image_url: string | null;
  price_gbp: number | null;
  amazon_url: string | null;
};

function extractAmazonAsin(url: string) {
  try {
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/gp\/product\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /[?&]asin=([A-Z0-9]{10})/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) {
        return match[1].toUpperCase();
      }
    }

    return "";
  } catch {
    return "";
  }
}

export default function AmazonInvitesClient({
  products,
}: {
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const asinList = useMemo(() => {
    return products
      .map((product) => extractAmazonAsin(product.amazon_url ?? ""))
      .filter(Boolean);
  }, [products]);

  const asinText = useMemo(() => asinList.join(","), [asinList]);

  const amazonMultiViewUrl = useMemo(() => {
    if (!asinList.length) return "#";

    const asinPipeString = asinList.join("|");

    const params = new URLSearchParams({
      k: asinPipeString,
      rh: "p_6:A3P5ROKL5A1OLE",
      s: "date-desc-rank",
      tag: "pokemoninstoc-21",
      ref: "as_li_ss_tl",
    });

    return `https://www.amazon.co.uk/s?${params.toString()}`;
  }, [asinList]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(asinText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div>
      <div className="mb-8 grid gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                <ClipboardList size={22} />
              </div>

              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Export ASINs for Your Bot
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Copy a ready-to-paste ASIN list for all products on this page.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {asinList.length} ASIN{asinList.length === 1 ? "" : "s"} ready
              </div>

              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                <Copy size={18} />
                Export All ASINs
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(9,18,46,0.96),rgba(5,10,26,0.92))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <ShoppingBag size={22} />
              </div>

              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  View All Items on Amazon
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Open one Amazon search containing all current ASINs on this page.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Auto-updates with products
              </div>

              <a
                href={amazonMultiViewUrl}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium text-white transition ${
                  asinList.length
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "pointer-events-none bg-slate-700 opacity-50"
                }`}
              >
                <ExternalLink size={18} />
                View All on Amazon
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-semibold">Amazon Invites</h2>
        <p className="mt-2 text-slate-400">
          Exclusive product invites available to members.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {products?.map((link) => (
          <div
            key={link.id}
            className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.96),rgba(3,8,20,0.98))] shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition duration-300 hover:-translate-y-1 hover:border-blue-400/30 hover:shadow-[0_20px_50px_rgba(30,64,175,0.14)]"
          >
            {link.image_url ? (
              <div className="relative">
                <Image
                  src={link.image_url}
                  alt={link.title}
                  width={600}
                  height={500}
                  className="h-56 w-full object-cover"
                />
                <div className="absolute right-3 top-3 rounded-full border border-blue-400/20 bg-blue-500/80 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                  Exclusive
                </div>
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center bg-[#071021] text-slate-500">
                No image
              </div>
            )}

            <div className="p-5">
              <h3 className="line-clamp-2 text-xl font-semibold leading-tight">
                {link.title}
              </h3>

              {link.price_gbp ? (
                <div className="mt-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                  <span className="text-sm text-blue-300">Price </span>
                  <span className="text-3xl font-semibold text-blue-200">
                    £{Number(link.price_gbp).toFixed(2)}
                  </span>
                </div>
              ) : null}

              {link.amazon_url ? (
                <a
                  href={link.amazon_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex w-full items-center justify-center rounded-2xl bg-blue-600 px-4 py-4 text-base font-medium text-white transition hover:bg-blue-500"
                >
                  View on Amazon
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-blue-500/20 bg-[linear-gradient(180deg,rgba(9,18,46,0.98),rgba(5,10,26,0.96))] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">ASIN Clipboard Export</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Copy all ASINs in comma-separated format for your bot.
                </p>
              </div>

              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-[#030814] p-4">
              <div className="mb-3 text-sm text-slate-400">
                {asinList.length} ASIN{asinList.length === 1 ? "" : "s"} found
              </div>

              <textarea
                readOnly
                value={asinText}
                className="min-h-[220px] w-full resize-none rounded-2xl border border-white/10 bg-[#071021] px-4 py-3 text-sm text-white outline-none"
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Copied" : "Copy All ASINs"}
              </button>

              <button
                onClick={() => setOpen(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}