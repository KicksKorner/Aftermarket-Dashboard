import { EbaySearchResponse, searchEbayBySku, summarisePrices } from "@/lib/ebay";

export async function searchPokemonProduct(query: string) {
  return searchEbayBySku(query);
}

export function extractPokemonPricesFromSearch(
  response: EbaySearchResponse,
  options?: {
    minPrice?: number;
    maxPrice?: number;
    excludeKeywords?: string[];
  }
) {
  const items = response.itemSummaries ?? [];
  const excludeKeywords = (options?.excludeKeywords ?? []).map((item) =>
    item.toLowerCase()
  );

  return items
    .filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const price = Number(item.price?.value ?? 0);

      if (!Number.isFinite(price) || price <= 0) {
        return false;
      }

      if (options?.minPrice != null && price < options.minPrice) {
        return false;
      }

      if (options?.maxPrice != null && price > options.maxPrice) {
        return false;
      }

      if (
        title.includes("empty") ||
        title.includes("opened") ||
        title.includes("open") ||
        title.includes("damaged") ||
        title.includes("proxy") ||
        title.includes("fake")
      ) {
        return false;
      }

      for (const keyword of excludeKeywords) {
        if (title.includes(keyword)) {
          return false;
        }
      }

      return true;
    })
    .map((item) => Number(item.price?.value ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function summarisePokemonPrices(prices: number[]) {
  return summarisePrices(prices);
}