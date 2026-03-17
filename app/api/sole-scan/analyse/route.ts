import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchEbayBySku,
  extractPricesFromSearch,
  summarisePrices,
} from "@/lib/ebay";

function calculateMetrics({
  avgSold,
  buyPrice,
  feePercent = 13,
  shipping = 4,
}: {
  avgSold: number;
  buyPrice: number;
  feePercent?: number;
  shipping?: number;
}) {
  const feeAmount = (avgSold * feePercent) / 100;
  const estimatedProfit = avgSold - feeAmount - shipping - buyPrice;
  const roi = buyPrice > 0 ? (estimatedProfit / buyPrice) * 100 : 0;
  const safeBuyPrice = avgSold - feeAmount - shipping - 10;

  let flipScore = 1;

  if (roi >= 50) flipScore = 10;
  else if (roi >= 40) flipScore = 9;
  else if (roi >= 30) flipScore = 8;
  else if (roi >= 20) flipScore = 7;
  else if (roi >= 10) flipScore = 5;
  else if (roi >= 0) flipScore = 3;

  return {
    estimatedProfit,
    roi,
    safeBuyPrice,
    flipScore,
  };
}

function getConfidence(salesCount: number): "low" | "medium" | "high" {
  if (salesCount >= 15) return "high";
  if (salesCount >= 7) return "medium";
  return "low";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }

    const body = await req.json();

    const sku = String(body?.sku ?? "").trim().toUpperCase();
    const buyPrice = Number(body?.buyPrice ?? 0);

    if (!sku) {
      return NextResponse.json({ error: "SKU is required" }, { status: 400 });
    }

    if (!buyPrice || Number.isNaN(buyPrice) || buyPrice <= 0) {
      return NextResponse.json(
        { error: "Valid buy price is required" },
        { status: 400 }
      );
    }

    const ebayResponse = await searchEbayBySku(sku);
    const prices = extractPricesFromSearch(ebayResponse, sku);
    const summary = summarisePrices(prices);

    if (!summary) {
      return NextResponse.json(
        { error: "No eBay market data found for this SKU" },
        { status: 404 }
      );
    }

    const metrics = calculateMetrics({
      avgSold: summary.avgSold,
      buyPrice,
    });

    const confidence = getConfidence(summary.salesCount);

    const result = {
      sku,
      avgSold: summary.avgSold,
      lowestSold: summary.lowestSold,
      highestSold: summary.highestSold,
      salesCount: summary.salesCount,
      confidence,
      roi: Number(metrics.roi.toFixed(1)),
      estimatedProfit: Number(metrics.estimatedProfit.toFixed(2)),
      safeBuyPrice: Number(metrics.safeBuyPrice.toFixed(2)),
      flipScore: metrics.flipScore,
      source: "eBay market estimate",
    };

    const { error: insertError } = await supabase
      .from("sole_scan_history")
      .insert({
        user_id: user.id,
        sku,
        avg_sold: result.avgSold,
        lowest_sold: result.lowestSold,
        highest_sold: result.highestSold,
        roi: result.roi,
        flip_score: result.flipScore,
        safe_buy_price: result.safeBuyPrice,
        confidence: result.confidence,
        sales_count: result.salesCount,
      });

    if (insertError) {
      console.error("sole_scan_history insert error:", insertError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Sole Scan analyse error:", error);
    return NextResponse.json(
      { error: "Failed to analyse SKU" },
      { status: 500 }
    );
  }
}