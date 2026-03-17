import { NextResponse } from "next/server";
import { trackedProducts } from "@/lib/tracked-products";
import { searchEbayListings, summarisePrices } from "@/lib/ebay";
import { createClient } from "@/lib/supabase/server";

type EbaySummaryItem = {
  title?: string;
  price?: {
    value?: string;
  };
};

function extractTrackedProductPrices(
  items: EbaySummaryItem[],
  excludeKeywords: string[] = []
) {
  const excludes = excludeKeywords.map((k) => k.toLowerCase());

  return items
    .filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const price = Number(item.price?.value ?? 0);

      if (!Number.isFinite(price) || price <= 0) {
        return false;
      }

      if (
        title.includes("empty") ||
        title.includes("opened") ||
        title.includes("open") ||
        title.includes("damaged") ||
        title.includes("proxy") ||
        title.includes("fake") ||
        title.includes("job lot") ||
        title.includes("bundle") ||
        title.includes("case") ||
        title.includes("collection") ||
        title.includes("bulk") ||
        title.includes("psa") ||
        title.includes("graded")
      ) {
        return false;
      }

      for (const keyword of excludes) {
        if (title.includes(keyword)) {
          return false;
        }
      }

      return true;
    })
    .map((item) => Number(item.price?.value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: overridesData } = await supabase
      .from("tracked_product_overrides")
      .select("product_id, image_url, override_price");

    const overridesMap = new Map(
      (overridesData ?? []).map((item) => [item.product_id, item])
    );

    const results = await Promise.all(
      trackedProducts.map(async (product) => {
        const override = overridesMap.get(product.id);

        try {
          const response = await searchEbayListings({
            query: product.searchQuery,
            limit: 25,
            minPrice: product.minPrice,
            maxPrice: product.maxPrice,
          });

          const prices = extractTrackedProductPrices(
            response.itemSummaries ?? [],
            product.excludeKeywords ?? []
          );

          const summary = summarisePrices(prices);
          const livePrice = summary?.avgSold ?? null;

          return {
            id: product.id,
            name: product.name,
            image:
              override?.image_url && override.image_url.trim().length > 0
                ? override.image_url
                : product.image,
            currentPrice:
              override?.override_price != null
                ? Number(override.override_price)
                : livePrice,
            livePrice,
            isOverride: override?.override_price != null,
          };
        } catch (error) {
          console.error(`Tracked product price fetch failed for ${product.name}:`, error);

          return {
            id: product.id,
            name: product.name,
            image:
              override?.image_url && override.image_url.trim().length > 0
                ? override.image_url
                : product.image,
            currentPrice:
              override?.override_price != null
                ? Number(override.override_price)
                : null,
            livePrice: null,
            isOverride: override?.override_price != null,
          };
        }
      })
    );

    const topFive = results
      .filter((item) => item.currentPrice != null)
      .sort((a, b) => Number(b.currentPrice) - Number(a.currentPrice))
      .slice(0, 5);

    return NextResponse.json({ products: topFive });
  } catch (error) {
    console.error("Top tracked products route error:", error);
    return NextResponse.json(
      { error: "Failed to load tracked product prices" },
      { status: 500 }
    );
  }
}