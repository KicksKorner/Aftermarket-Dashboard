import { NextResponse } from "next/server";
import { pokemonTrackedProducts } from "@/lib/pokemon-products";
import {
  extractPokemonPricesFromSearch,
  searchPokemonProduct,
  summarisePokemonPrices,
} from "@/lib/pokemon-ebay";

function getConfidence(count: number): "low" | "medium" | "high" {
  if (count >= 15) return "high";
  if (count >= 7) return "medium";
  return "low";
}

export async function GET() {
  try {
    const results = await Promise.all(
      pokemonTrackedProducts.map(async (product) => {
        try {
          const ebayResponse = await searchPokemonProduct(product.searchQuery);

          const prices = extractPokemonPricesFromSearch(ebayResponse, {
            minPrice: product.minPrice,
            maxPrice: product.maxPrice,
            excludeKeywords: product.excludeKeywords,
          });

          const summary = summarisePokemonPrices(prices);

          return {
            id: product.id,
            name: product.name,
            image: product.image,
            currentPrice: summary?.avgSold ?? null,
            lowestPrice: summary?.lowestSold ?? null,
            highestPrice: summary?.highestSold ?? null,
            listingsUsed: summary?.salesCount ?? 0,
            confidence: summary ? getConfidence(summary.salesCount) : "low",
            source: "eBay market estimate",
          };
        } catch (error) {
          console.error(`Failed to fetch Pokemon price for ${product.name}:`, error);

          return {
            id: product.id,
            name: product.name,
            image: product.image,
            currentPrice: null,
            lowestPrice: null,
            highestPrice: null,
            listingsUsed: 0,
            confidence: "low" as const,
            source: "eBay market estimate",
          };
        }
      })
    );

    return NextResponse.json({ products: results });
  } catch (error) {
    console.error("Pokemon market prices route error:", error);
    return NextResponse.json(
      { error: "Failed to load Pokemon market prices" },
      { status: 500 }
    );
  }
}