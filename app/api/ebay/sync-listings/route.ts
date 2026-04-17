import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function refreshEbayToken(refreshToken: string) {
  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
        "https://api.ebay.com/oauth/api_scope/sell.finances",
        "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
      ].join(" "),
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function getAccessToken() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", supabase: null, accessToken: null };

  const { data: conn } = await supabase.from("ebay_connections").select("*").eq("user_id", user.id).single();
  if (!conn) return { error: "No eBay account connected", supabase, accessToken: null };

  let accessToken = conn.access_token;
  if (new Date(conn.token_expires_at) <= new Date()) {
    const refreshed = await refreshEbayToken(conn.refresh_token);
    if (!refreshed) return { error: "Token refresh failed. Please reconnect your eBay account.", supabase, accessToken: null };
    accessToken = refreshed.access_token;
    await supabase.from("ebay_connections").update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq("user_id", user.id);
  }
  return { error: null, supabase, accessToken, user };
}

// GET — fetch listings for review
export async function GET() {
  const { error, supabase, accessToken, user } = await getAccessToken();
  if (error || !supabase || !accessToken || !user) {
    return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 400 });
  }

  const tradingRes = await fetch("https://api.ebay.com/ws/api.dll", {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID": "3",
      "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
      "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
      "X-EBAY-API-IAF-TOKEN": accessToken,
      "Content-Type": "text/xml",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${accessToken}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
  </ActiveList>
  <ErrorLanguage>en_GB</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
</GetMyeBaySellingRequest>`,
  });

  if (!tradingRes.ok) {
    return NextResponse.json({ error: "Failed to fetch eBay listings. Please reconnect your eBay account." }, { status: 400 });
  }

  const xmlText = await tradingRes.text();
  const listings: Array<{ ebayItemId: string; title: string; price: number; quantity: number; imageUrl: string | null; alreadyInInventory: boolean }> = [];

  for (const match of xmlText.matchAll(/<Item>([\s\S]*?)<\/Item>/g)) {
    const x = match[1];
    const ebayItemId = x.match(/<ItemID>(.*?)<\/ItemID>/)?.[1] || "";
    if (!ebayItemId) continue;
    listings.push({
      ebayItemId,
      title: x.match(/<Title>(.*?)<\/Title>/)?.[1] || "eBay Item",
      price: parseFloat(x.match(/<CurrentPrice[^>]*>([\d.]+)<\/CurrentPrice>/)?.[1] || "0"),
      quantity: parseInt(x.match(/<QuantityAvailable>(.*?)<\/QuantityAvailable>/)?.[1] || "1"),
      imageUrl: x.match(/<GalleryURL>(.*?)<\/GalleryURL>/)?.[1] || null,
      alreadyInInventory: false,
    });
  }

  // Mark which ones are already in inventory
  const { data: existing } = await supabase
    .from("inventory_items").select("ebay_listing_id").eq("user_id", user.id).not("ebay_listing_id", "is", null);
  const existingIds = new Set((existing || []).map((i: any) => i.ebay_listing_id));
  listings.forEach(l => { l.alreadyInInventory = existingIds.has(l.ebayItemId); });

  return NextResponse.json({ listings });
}

// POST — add a single selected listing to inventory
export async function POST(req: Request) {
  const { error, supabase, user } = await getAccessToken();
  if (error || !supabase || !user) {
    return NextResponse.json({ error }, { status: 401 });
  }

  const { ebayItemId, title, price, quantity } = await req.json();
  if (!ebayItemId || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Prevent duplicates
  const { data: existing } = await supabase.from("inventory_items").select("id")
    .eq("user_id", user.id).eq("ebay_listing_id", ebayItemId).single();
  if (existing) return NextResponse.json({ error: "Already in inventory" }, { status: 409 });

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + 14);

  const { error: insertError } = await supabase.from("inventory_items").insert({
    user_id: user.id,
    item_name: title,
    buy_price: 0,
    sold_price: null,
    fees: 0,
    shipping: 0,
    status: "in_stock",
    purchase_date: null,
    sold_date: null,
    quantity: quantity || 1,
    quantity_sold: 0,
    quantity_remaining: quantity || 1,
    return_window_days: 14,
    return_deadline: deadline.toISOString(),
    ebay_listing_id: ebayItemId,
    source: "ebay",
  });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
