import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_API_KEY = process.env.APIFY_API_KEY!;

// saswave/vinted-product-item-profile-scraper
// Supports profile URLs directly - pass the member URL and it returns all their items
const ACTOR_ID = "saswave~vinted-product-item-profile-scraper";

async function scrapeVintedProfile(profileUrl: string): Promise<any[]> {
  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=120&memory=512`;

  const input = {
    startUrls: [{ url: profileUrl }],
    maxItems: 500,
  };

  console.log(`Apify saswave: scraping ${profileUrl}`);

  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  console.log(`Apify saswave response: ${res.status}`);

  if (!res.ok) {
    const err = await res.text();
    console.error("Apify error body:", err.substring(0, 500));
    throw new Error(`Apify actor failed with status ${res.status}`);
  }

  const items = await res.json();
  console.log(`Apify saswave returned ${Array.isArray(items) ? items.length : "non-array"} items`);
  if (Array.isArray(items) && items.length > 0) {
    console.log("Sample item keys:", Object.keys(items[0]).join(", "));
  }
  return Array.isArray(items) ? items : [];
}

function normaliseItem(item: any) {
  // Try all possible field names from saswave actor
  const priceRaw = item.price?.amount ?? item.price?.value ?? item.price ?? item.priceNumeric ?? "0";
  return {
    vintedItemId: String(item.id ?? item.itemId ?? item.item_id ?? ""),
    title: item.title ?? item.name ?? "Vinted Item",
    price: parseFloat(String(priceRaw)),
    currency: item.price?.currency_code ?? item.currency ?? "GBP",
    category: item.catalog?.title ?? item.category?.title ?? item.categoryTitle ?? item.category ?? null,
    brand: item.brand_title ?? item.brand?.title ?? item.brandTitle ?? item.brand ?? null,
    size: item.size_title ?? item.size?.title ?? item.sizeTitle ?? item.size ?? null,
    views: item.view_count ?? item.viewCount ?? item.views ?? 0,
    favourites: item.favourite_count ?? item.favouriteCount ?? item.favourites ?? 0,
    imageUrl:
      item.photos?.[0]?.url ??
      item.photo?.url ??
      item.image_url ??
      item.imageUrl ??
      item.thumbnail ??
      null,
    itemUrl:
      item.url ??
      item.itemUrl ??
      item.item_url ??
      (item.id ? `https://www.vinted.co.uk/items/${item.id}` : null),
    sellerUserId: String(
      item.user?.id ?? item.user_id ?? item.seller?.id ?? item.sellerId ?? ""
    ),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId } = await req.json();
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  if (!APIFY_API_KEY) {
    return NextResponse.json({ error: "APIFY_API_KEY not set in environment variables." }, { status: 500 });
  }

  const { data: trackedProfile } = await supabase
    .from("vinted_tracked_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!trackedProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const profileUrl = `https://www.vinted.co.uk/member/${trackedProfile.vinted_user_id}`;

  let rawItems: any[] = [];
  try {
    rawItems = await scrapeVintedProfile(profileUrl);
  } catch (err: any) {
    console.error("Apify scrape failed:", err.message);
    return NextResponse.json({
      error: `Scraping failed: ${err.message}. Make sure you have saved the actor saswave/vinted-product-item-profile-scraper to your Apify account.`,
    }, { status: 500 });
  }

  if (!rawItems.length) {
    return NextResponse.json({
      ok: true,
      newItems: 0,
      updated: 0,
      soldDetected: 0,
      totalFetched: 0,
      message: "No listings found for this profile.",
    });
  }

  // Filter to only items belonging to this seller
  const allItems = rawItems
    .map(normaliseItem)
    .filter(i => {
      if (!i.vintedItemId) return false;
      // If we have seller info, verify it matches
      if (i.sellerUserId && i.sellerUserId !== "0" && i.sellerUserId !== "") {
        return i.sellerUserId === trackedProfile.vinted_user_id;
      }
      return true;
    });

  console.log(`After filtering: ${allItems.length} items belong to user ${trackedProfile.vinted_user_id}`);

  const { data: existingSnapshots } = await supabase
    .from("vinted_profile_snapshots")
    .select("id, vinted_item_id, status")
    .eq("profile_id", profileId);

  const existingMap = new Map(
    (existingSnapshots || []).map((s: any) => [s.vinted_item_id, s])
  );

  const currentItemIds = new Set(allItems.map(i => i.vintedItemId));
  const now = new Date().toISOString();
  let newItems = 0;
  let soldDetected = 0;
  let updated = 0;

  const toInsert: any[] = [];
  const toUpdateIds: string[] = [];

  for (const item of allItems) {
    const existing = existingMap.get(item.vintedItemId);
    if (existing) {
      toUpdateIds.push(existing.id);
      updated++;
    } else {
      toInsert.push({
        profile_id: profileId,
        user_id: user.id,
        vinted_item_id: item.vintedItemId,
        title: item.title,
        price: item.price,
        currency: item.currency,
        category: item.category,
        brand: item.brand,
        size: item.size,
        views: item.views,
        favourites: item.favourites,
        image_url: item.imageUrl,
        item_url: item.itemUrl,
        status: "active",
        first_seen_at: now,
        last_seen_at: now,
      });
      newItems++;
    }
  }

  if (toInsert.length > 0) {
    await supabase.from("vinted_profile_snapshots").insert(toInsert);
  }

  for (let i = 0; i < toUpdateIds.length; i += 50) {
    await supabase
      .from("vinted_profile_snapshots")
      .update({ last_seen_at: now, status: "active" })
      .in("id", toUpdateIds.slice(i, i + 50));
  }

  // Detect sold items
  const soldIds: string[] = [];
  for (const [vintedItemId, snapshot] of existingMap.entries()) {
    if (!currentItemIds.has(vintedItemId) && snapshot.status === "active") {
      soldIds.push(snapshot.id);
      soldDetected++;
    }
  }

  if (soldIds.length > 0) {
    await supabase
      .from("vinted_profile_snapshots")
      .update({ status: "sold", sold_detected_at: now })
      .in("id", soldIds);
  }

  await supabase
    .from("vinted_tracked_profiles")
    .update({ last_checked_at: now, total_items: allItems.length })
    .eq("id", profileId);

  return NextResponse.json({
    ok: true,
    newItems,
    updated,
    soldDetected,
    totalFetched: allItems.length,
    message: `${newItems} new listings, ${soldDetected} sold detected, ${updated} updated.`,
  });
}
