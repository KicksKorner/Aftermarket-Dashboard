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

// Known UK retailers to check for sourcing
const UK_RETAILERS = [
  { name: "Tesco", searchUrl: "https://www.tesco.com/groceries/en-GB/search?query=" },
  { name: "Argos", searchUrl: "https://www.argos.co.uk/search/" },
  { name: "B&M", searchUrl: "https://www.bmstores.co.uk/search?query=" },
  { name: "The Range", searchUrl: "https://www.therange.co.uk/search/#q=" },
  { name: "Amazon Warehouse", searchUrl: `https://www.amazon.co.uk/s?k=` },
  { name: "eBay", searchUrl: "https://www.ebay.co.uk/sch/i.html?_nkw=" },
  { name: "Asda", searchUrl: "https://www.asda.com/search/" },
  { name: "Wilko", searchUrl: "https://www.wilko.com/search?q=" },
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { asin } = await req.json();
  if (!asin?.trim()) return NextResponse.json({ error: "ASIN required" }, { status: 400 });

  const token = await getValidToken(supabase, user.id);
  if (!token) {
    return NextResponse.json({ error: "No Amazon account connected." }, { status: 400 });
  }

  // ── Get product details from Amazon ──────────────────────────────────────
  let title = "";
  let amazonPrice = 0;
  let category = "";
  let bsr = null;
  let brand = "";
  let ean = "";
  let imageUrl = "";
  let numOffers = 0;

  try {
    const catalogRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${asin}?marketplaceIds=${UK_MARKETPLACE}&includedData=attributes,salesRanks,summaries,images,identifiers`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (catalogRes.ok) {
      const catalogData = await catalogRes.json();
      title = catalogData.summaries?.[0]?.itemName || "";
      brand = catalogData.summaries?.[0]?.brand || "";
      bsr = catalogData.salesRanks?.[0]?.ranks?.[0]?.rank || null;
      category = catalogData.salesRanks?.[0]?.displayGroupRanks?.[0]?.title ||
                 catalogData.salesRanks?.[0]?.ranks?.[0]?.title || "";
      imageUrl = catalogData.images?.[0]?.images?.[0]?.link || "";
      // Get EAN from identifiers
      const identifiers = catalogData.identifiers?.[0]?.identifiers || [];
      const eanId = identifiers.find((i: any) => i.identifierType === "EAN");
      ean = eanId?.identifier || "";
    }
  } catch (e) {
    console.error("Catalog lookup error:", e);
  }

  // ── Get current Amazon pricing and competition ────────────────────────────
  try {
    const pricingRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/products/pricing/v0/items/${asin}/offers?MarketplaceId=${UK_MARKETPLACE}&ItemCondition=New`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (pricingRes.ok) {
      const pricingData = await pricingRes.json();
      const offers = pricingData.payload?.Offers || [];
      numOffers = offers.length;
      const prices = offers
        .map((o: any) => parseFloat(o.BuyingPrice?.ListingPrice?.Amount || "0"))
        .filter((p: number) => p > 0);
      if (prices.length) amazonPrice = Math.min(...prices);
    }
  } catch (e) {
    console.error("Pricing lookup error:", e);
  }

  // ── Get FBA fees estimate ─────────────────────────────────────────────────
  let fbaFees = 0;
  if (amazonPrice > 0) {
    try {
      const feesRes = await fetch(
        `https://sellingpartnerapi-eu.amazon.com/products/fees/v0/items/${asin}/feesEstimate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "x-amz-access-token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            FeesEstimateRequest: {
              MarketplaceId: UK_MARKETPLACE,
              IsAmazonFulfilled: true,
              PriceToEstimateFees: {
                ListingPrice: { CurrencyCode: "GBP", Amount: amazonPrice },
              },
              Identifier: asin,
            },
          }),
        }
      );
      if (feesRes.ok) {
        const feesData = await feesRes.json();
        fbaFees = parseFloat(
          feesData.payload?.FeesEstimateResult?.FeesEstimate?.TotalFeesEstimate?.Amount || "0"
        );
      }
    } catch (e) {
      console.error("Fees lookup error:", e);
    }
  }

  // ── Build sourcing suggestions ────────────────────────────────────────────
  const searchTerm = encodeURIComponent(title || asin);
  const sourcingLinks = UK_RETAILERS.map(r => ({
    name: r.name,
    url: r.searchUrl + searchTerm,
  }));

  // ── Calculate break-even and profit at various buy prices ─────────────────
  const referralFee = amazonPrice * 0.15;
  const totalAmazonCost = fbaFees + referralFee;
  const breakEven = amazonPrice - totalAmazonCost;

  const profitScenarios = [10, 15, 20, 25, 30, 40, 50].map(roi => {
    const maxBuyPrice = breakEven / (1 + roi / 100);
    return {
      roi,
      maxBuyPrice: Math.round(maxBuyPrice * 100) / 100,
      profit: Math.round((breakEven - maxBuyPrice) * 100) / 100,
    };
  }).filter(s => s.maxBuyPrice > 0);

  // Save search to history
  const result = {
    asin,
    title,
    brand,
    ean,
    amazon_price: amazonPrice,
    fba_fees: fbaFees,
    referral_fee: referralFee,
    break_even: Math.round(breakEven * 100) / 100,
    category,
    bsr,
    num_offers: numOffers,
    image_url: imageUrl,
    sourcing_links: sourcingLinks,
    profit_scenarios: profitScenarios,
  };

  await supabase.from("fba_asin_searches").insert({
    user_id: user.id,
    asin,
    title,
    amazon_price: amazonPrice,
    category,
    bsr,
    results: result,
  });

  return NextResponse.json({ ok: true, ...result });
}
