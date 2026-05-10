import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const APIFY_API_KEY = process.env.APIFY_API_KEY!;

// louisdeconinck/vinted-scraper supports user profile scraping
const ACTOR_ID = "louisdeconinck~vinted-scraper";

async function scrapeVintedProfile(profileUrl: string): Promise<any[]> {
  // Run the Apify actor synchronously and get results back
  const runUrl = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_KEY}&timeout=60&memory=256`;

  const input = {
    startUrls: [{ url: profileUrl }],
    maxItems: 500,
    country: "UK",
  };

  console.log(`Apify: scraping ${profileUrl}`);

  const res = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  console.log(`Apify response status: ${res.status}`);

  if (!res.ok) {
    const err = await res.text();
    console.error("Apify error:", err);
    throw new Error(`Apify actor failed with status ${res.status}`);
  }

  const items = await res.json();
  console.log(`Apify returned ${items.length} items`);
  return Array.isArray(items) ? items : [];
}

function normaliseItem(item: any) {
  // louisdeconinck/vinted-scraper output shape
  return {
    vintedItemId: String(item.id || item.itemId || ""),
    title: item.title || item.name || "Vinted Item",
    price: parseFloat(item.price?.amount || item.price || item.priceNumeric || "0"),
    currency: item.price?.currency_code || item.currency || "GBP",
    category: item.category?.title || item.categoryTitle || item.category || null,
    brand: item.brand?.title || item.brandTitle || item.brand || null,
    size: item.size?.title || item.sizeTitle || item.size || null,
    views: item.view_count || item.viewCount || item.views || 0,
    favourites: item.favourite_count || item.favouriteCount || item.favourites || 0,
    imageUrl: item.photos?.[0]?.url || item.imageUrl || item.photo?.url || item.image || null,
    itemUrl: item.url || item.itemUrl || (item.id ? `https://www.vinted.co.uk/items/${item.id}` : null),
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId } = await req.json();
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  if (!APIFY_API_KEY) {
    return NextResponse.json({ error: "Apify API key not configured. Add APIFY_API_KEY to your environment variables." }, { status: 500 });
  }

  // Get the tracked profile
  const { data: trackedProfile } = await supabase
    .from("vinted_tracked_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!trackedProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Build the profile URL for scraping
  const profileUrl = trackedProfile.profile_url ||
    `https://www.vinted.co.uk/member/${trackedProfile.vinted_user_id}-${trackedProfile.username}`;

  // Scrape via Apify
  let rawItems: any[] = [];
  try {
    rawItems = await scrapeVintedProfile(profileUrl);
  } catch (err: any) {
    console.error("Apify scrape failed:", err.message);
    return NextResponse.json({
      error: `Scraping failed: ${err.message}. Check your APIFY_API_KEY is correct in Netlify env vars.`,
    }, { status: 500 });
  }

  if (!rawItems.length) {
    return NextResponse.json({
      ok: true,
      newItems: 0,
      updated: 0,
      soldDetected: 0,
      totalFetched: 0,
      message: "No listings found for this profile. They may have no active items.",
    });
  }

  // Normalise items
  const allItems = rawItems
    .map(normaliseItem)
    .filter(i => i.vintedItemId);

  console.log(`Normalised ${allItems.length} items for ${trackedProfile.username}`);

  // Get existing snapshots
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

  // Process current listings — batch inserts for speed
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

  // Batch insert new items
  if (toInsert.length > 0) {
    await supabase.from("vinted_profile_snapshots").insert(toInsert);
  }

  // Batch update existing — update in chunks of 50
  for (let i = 0; i < toUpdateIds.length; i += 50) {
    const chunk = toUpdateIds.slice(i, i + 50);
    await supabase
      .from("vinted_profile_snapshots")
      .update({ last_seen_at: now, status: "active" })
      .in("id", chunk);
  }

  // Detect sold items — in DB but not in current scrape
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

  // Update profile metadata
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
