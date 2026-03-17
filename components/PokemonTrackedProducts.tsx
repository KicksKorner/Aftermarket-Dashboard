"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type PokemonTrackedItem = {
  id: string;
  name: string;
  image: string;
  currentPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  listingsUsed: number;
  confidence: "low" | "medium" | "high";
  source: string;
};

function formatCurrency(value: number | null) {
  if (value == null) return "N/A";
  return `£${Number(value).toFixed(2)}`;
}

export default function PokemonTrackedProducts() {
  const [products, setProducts] = useState<PokemonTrackedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPrices() {
      try {
        setLoading(true);

        const res = await fetch("/api/pokemon-market/prices", {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          console.error(data.error || "Failed to load Pokemon market prices");
          return;
        }

        setProducts(data.products ?? []);
      } catch (error) {
        console.error("Pokemon market fetch error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadPrices();
  }, []);

  return (
    <section>
      <div className="mb-5 flex items-center gap-2 text-2xl font-semibold">
        <span className="text-blue-400">✦</span>
        <h2>Tracked Products</h2>
      </div>

      {loading ? (
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 text-slate-400">
          Loading tracked product prices...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="overflow-hidden rounded-[24px] border border-blue-500/15 bg-[linear-gradient(180deg,rgba(5,10,26,0.92),rgba(3,8,20,0.96))] shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
            >
              <div className="relative h-[220px] w-full bg-black/20">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="p-5">
                <h3 className="text-2xl font-semibold">{product.name}</h3>

                <div className="mt-4 rounded-[18px] border border-blue-500/20 bg-[#07142e] p-4">
                  <div className="text-sm text-sky-300">Current Price</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {formatCurrency(product.currentPrice)}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Lowest
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {formatCurrency(product.lowestPrice)}
                    </div>
                  </div>

                  <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Highest
                    </div>
                    <div className="mt-2 text-lg font-semibold">
                      {formatCurrency(product.highestPrice)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-slate-400">
                  Confidence: {product.confidence.toUpperCase()} • Based on{" "}
                  {product.listingsUsed} listings
                </div>
                <div className="mt-1 text-xs text-slate-500">{product.source}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}