"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type TopTrackedProduct = {
  id: string;
  name: string;
  image: string;
  currentPrice: number | null;
  livePrice: number | null;
  isOverride: boolean;
};

function formatCurrency(value: number | null) {
  if (value == null) return "N/A";
  return `£${Number(value).toFixed(2)}`;
}

export default function TopTrackedProductsOverview() {
  const [products, setProducts] = useState<TopTrackedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTopProducts() {
      try {
        setLoading(true);

        const res = await fetch("/api/tracked-products/top-prices", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "Failed to load tracked products");
          return;
        }

        setProducts(data.products ?? []);
      } catch (error) {
        console.error("Tracked products fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTopProducts();
  }, []);

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
      {loading
        ? Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
            >
              <div className="h-[180px] rounded-2xl bg-white/5" />
              <div className="mt-4 h-5 w-3/4 rounded bg-white/5" />
              <div className="mt-5 h-4 w-1/3 rounded bg-white/5" />
              <div className="mt-2 h-10 w-1/2 rounded bg-white/5" />
            </div>
          ))
        : products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
            >
              <div className="relative h-[190px] w-full overflow-hidden rounded-[18px] border border-white/10 bg-black/20">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized={product.image.startsWith("http")}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No image
                  </div>
                )}
              </div>

              <div className="mt-4 min-h-[56px] text-lg font-semibold leading-tight text-white">
                {product.name}
              </div>

              <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                Current Price
              </div>

              <div className="mt-2 text-[32px] font-semibold leading-none text-[#39FF88] drop-shadow-[0_0_12px_rgba(57,255,136,0.22)]">
                {formatCurrency(product.currentPrice)}
              </div>

              {product.isOverride ? (
                <div className="mt-3 inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300">
                  Manual Override
                </div>
              ) : null}
            </div>
          ))}
    </div>
  );
}