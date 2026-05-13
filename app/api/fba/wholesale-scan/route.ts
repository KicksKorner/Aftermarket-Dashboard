import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UK_MARKETPLACE = "A1F83G8C2ARO7P";

async function getValidToken(supabase: any, userId: string) {
  const { data: conn } = await supabase
    .from("amazon_connections")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!conn) return null;

  let token = conn.access_token;
  if (!token || new Date(conn.token_expires_at) <= new Date()) {
    const res = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
        client_id: conn.client_id,
        client_secret: conn.client_secret,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    token = data.access_token;
    await supabase.from("amazon_connections").update({
      access_token: token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }).eq("user_id", userId);
  }
  return token;
}

// Lookup a product on Amazon by ASIN or EAN
async function lookupProduct(identifier: string, type: "ASIN" | "EAN", token: string) {
  try {
    const idType = type === "ASIN" ? "ASIN" : "EAN";
    const res = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items?marketplaceIds=${UK_MARKETPLACE}&identifiers=${identifier}&identifiersType=${idType}&includedData=attributes,salesRanks,summaries`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.items?.[0] || null;
  } catch { return null; }
}

// Get FBA fees estimate for an ASIN
async function getFeesEstimate(asin: string, price: number, token: string) {
  try {
    const body = {
      FeesEstimateRequest: {
        MarketplaceId: UK_MARKETPLACE,
        IsAmazonFulfilled: true,
        PriceToEstimateFees: {
          ListingPrice: { CurrencyCode: "GBP", Amount: price },
        },
        Identifier: asin,
      },
    };
    const res = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/products/fees/v0/items/${asin}/feesEstimate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return parseFloat(
      data.payload?.FeesEstimateResult?.FeesEstimate?.TotalFeesEstimate?.Amount || "0"
    );
  } catch { return 0; }
}

// Get lowest Amazon price for an ASIN
async function getLowestPrice(asin: string, token: string) {
  try {
    const res = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/products/pricing/v0/items/${asin}/offers?MarketplaceId=${UK_MARKETPLACE}&ItemCondition=New`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const offers = data.payload?.Offers || [];
    if (!offers.length) return 0;
    const prices = offers.map((o: any) =>
      parseFloat(o.BuyingPrice?.ListingPrice?.Amount || "0")
    ).filter((p: number) => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  } catch { return 0; }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const scanName = formData.get("scanName") as string || "Wholesale Scan";
  const vatRate = parseFloat(formData.get("vatRate") as string || "20");
  const minRoi = parseFloat(formData.get("minRoi") as string || "20");
  const minProfit = parseFloat(formData.get("minProfit") as string || "1");

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const token = await getValidToken(supabase, user.id);
  if (!token) {
    return NextResponse.json({
      error: "No Amazon account connected or token expired. Connect in FBA Hub settings.",
    }, { status: 400 });
  }

  // Parse CSV
  const text = await file.text();
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return NextResponse.json({ error: "CSV appears empty" }, { status: 400 });

  // Detect header row and column positions
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const asinCol = headers.findIndex(h => h.includes("asin"));
  const eanCol = headers.findIndex(h => h.includes("ean") || h.includes("barcode") || h.includes("upc"));
  const priceCol = headers.findIndex(h => h.includes("price") || h.includes("cost") || h.includes("buy"));
  const titleCol = headers.findIndex(h => h.includes("title") || h.includes("name") || h.includes("product"));

  if (asinCol === -1 && eanCol === -1) {
    return NextResponse.json({
      error: "CSV must have an ASIN or EAN/Barcode column. Check your column headers.",
    }, { status: 400 });
  }

  // Create scan record
  const { data: scan, error: scanError } = await supabase
    .from("fba_wholesale_scans")
    .insert({
      user_id: user.id,
      scan_name: scanName,
      status: "processing",
      total_products: lines.length - 1,
    })
    .select()
    .single();

  if (scanError) return NextResponse.json({ error: scanError.message }, { status: 500 });

  const results: any[] = [];
  const rows = lines.slice(1).slice(0, 100); // Cap at 100 products per scan

  for (const line of rows) {
    const cols = line.split(",").map(c => c.trim().replace(/['"]/g, ""));
    const asin = asinCol >= 0 ? cols[asinCol] : "";
    const ean = eanCol >= 0 ? cols[eanCol] : "";
    const buyPrice = priceCol >= 0 ? parseFloat(cols[priceCol]) || 0 : 0;
    const supplierTitle = titleCol >= 0 ? cols[titleCol] : "";

    if (!asin && !ean) continue;

    // Lookup on Amazon
    const identifier = asin || ean;
    const idType = asin ? "ASIN" : "EAN";
    const product = await lookupProduct(identifier, idType, token);

    const resolvedAsin = asin || product?.asin || "";
    const title = product?.summaries?.[0]?.itemName || supplierTitle || identifier;
    const bsr = product?.salesRanks?.[0]?.ranks?.[0]?.rank || null;
    const category = product?.salesRanks?.[0]?.ranks?.[0]?.title || null;

    if (!resolvedAsin) {
      results.push({ asin: "", ean, title, buyPrice, is_profitable: false, error: "Not found on Amazon" });
      continue;
    }

    // Get Amazon price and fees
    const amazonPrice = await getLowestPrice(resolvedAsin, token);
    const fbaFees = await getFeesEstimate(resolvedAsin, amazonPrice, token);

    // Calculate profitability
    // VAT: buy price includes VAT so get ex-VAT cost
    const buyPriceExVat = buyPrice / (1 + vatRate / 100);
    const referralFee = amazonPrice * 0.15; // approximate 15% referral
    const totalFees = fbaFees || referralFee;
    const profit = amazonPrice - buyPriceExVat - totalFees;
    const roi = buyPriceExVat > 0 ? (profit / buyPriceExVat) * 100 : 0;
    const margin = amazonPrice > 0 ? (profit / amazonPrice) * 100 : 0;
    const isProfitable = profit >= minProfit && roi >= minRoi;

    results.push({
      scan_id: scan.id,
      user_id: user.id,
      asin: resolvedAsin,
      ean: ean || null,
      title,
      buy_price: buyPrice,
      amazon_price: amazonPrice,
      fba_fees: fbaFees,
      referral_fee: referralFee,
      profit: Math.round(profit * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      bsr,
      category,
      is_profitable: isProfitable,
    });

    // Small delay to respect rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  // Batch insert results
  if (results.length > 0) {
    await supabase.from("fba_wholesale_results").insert(
      results.filter(r => r.scan_id).map(r => ({ ...r }))
    );
  }

  const profitableCount = results.filter(r => r.is_profitable).length;

  await supabase.from("fba_wholesale_scans").update({
    status: "complete",
    profitable_count: profitableCount,
    total_products: results.length,
    completed_at: new Date().toISOString(),
  }).eq("id", scan.id);

  return NextResponse.json({
    ok: true,
    scanId: scan.id,
    total: results.length,
    profitable: profitableCount,
    results: results.slice(0, 50),
    message: `Scanned ${results.length} products, found ${profitableCount} profitable.`,
  });
}
