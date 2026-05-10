import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function makeHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "X-Client-Id": "web",
    Referer: "https://www.vinted.co.uk/",
    Origin: "https://www.vinted.co.uk",
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { profileId } = await req.json();
  if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

  // Get the tracked profile
  const { data: trackedProfile } = await supabase
    .from("vinted_tracked_profiles")
    .select("*")
    .eq("id", profileId)
    .eq("user_id", user.id)
    .single();

  if (!trackedProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Get Vinted token
  const { data: conn } = await supabase
    .from("vinted_connections")
    .select("access_token")
    .eq("user_id", user.id)
    .single();

  if (!conn?.access_token) {
    return NextResponse.json({ error: "No Vinted account connected" }, { status: 400 });
  }

  const headers = makeHeaders(conn.access_token);

  // Fetch all current listings for this seller
  let allItems: any[] = [];
  let page = 1;
  const perPage = 96;

  while (true) {
    const res = await fetch(
      `https://www.vinted.co.uk/api/v2/users/${trackedProfile.vinted_user_id}/items?page=${page}&per_page=${perPage}&order=newest_first`,
      { headers }
    );

    if (!res.ok) {
      console.error(`Vinted items fetch failed for user ${trackedProfile.vinted_user_id}:`, res.status);
      break;
    }

    const data = await res.json();
    const items = data.items || [];
    allItems = allItems.concat(items);

    // Stop if we got fewer items than per_page (last page)
    if (items.length < perPage) break;
    // Safety cap at 5 pages (480 items)
    if (page >= 5) break;
    page++;
  }

  console.log(`Vinted stalker: fetched ${allItems.length} items for ${trackedProfile.username}`);

  // Get existing snapshots for this profile
  const { data: existingSnapshots } = await supabase
    .from("vinted_profile_snapshots")
    .select("id, vinted_item_id, status")
    .eq("profile_id", profileId);

  const existingMap = new Map(
    (existingSnapshots || []).map((s: any) => [s.vinted_item_id, s])
  );

  const currentItemIds = new Set(allItems.map((i: any) => String(i.id)));

  const now = new Date().toISOString();
  let newItems = 0;
  let soldDetected = 0;
  let updated = 0;

  // Process current listings
  for (const item of allItems) {
    const vintedItemId = String(item.id);
    const price = parseFloat(item.price?.amount || item.price || "0");
    const imageUrl = item.photos?.[0]?.url || item.photos?.[0]?.thumbnails?.[0]?.url || null;
    const category = item.catalog?.title || item.category_title || null;
    const brand = item.brand_title || null;
    const size = item.size_title || null;
    const views = item.view_count || item.views || 0;
    const favourites = item.favourite_count || item.favourites || 0;
    const itemUrl = `https://www.vinted.co.uk/items/${vintedItemId}`;

    const existing = existingMap.get(vintedItemId);

    if (existing) {
      // Update views, favourites and last_seen
      await supabase
        .from("vinted_profile_snapshots")
        .update({
          views,
          favourites,
          price,
          last_seen_at: now,
          status: "active",
        })
        .eq("id", existing.id);
      updated++;
    } else {
      // New item
      await supabase.from("vinted_profile_snapshots").insert({
        profile_id: profileId,
        user_id: user.id,
        vinted_item_id: vintedItemId,
        title: item.title || "Vinted Item",
        price,
        currency: item.price?.currency_code || "GBP",
        category,
        brand,
        size,
        views,
        favourites,
        image_url: imageUrl,
        item_url: itemUrl,
        status: "active",
        first_seen_at: now,
        last_seen_at: now,
      });
      newItems++;
    }
  }

  // Detect sold items — items in DB that are no longer in the current listing
  for (const [vintedItemId, snapshot] of existingMap.entries()) {
    if (!currentItemIds.has(vintedItemId) && snapshot.status === "active") {
      await supabase
        .from("vinted_profile_snapshots")
        .update({ status: "sold", sold_detected_at: now })
        .eq("id", snapshot.id);
      soldDetected++;
    }
  }

  // Update profile last_checked and total_items
  await supabase
    .from("vinted_tracked_profiles")
    .update({
      last_checked_at: now,
      total_items: allItems.length,
    })
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
