import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get Vinted connection
  const { data: conn } = await supabase
    .from("vinted_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!conn) return NextResponse.json({ error: "No Vinted account connected" }, { status: 400 });

  const token = conn.access_token;
  let vintedUserId = conn.vinted_user_id;

  const headers = {
    "Authorization": `Bearer ${token}`,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
    "Content-Type": "application/json",
    "X-Anon-Id": "",
    "Pragma": "no-cache",
  };

  // Get user ID if we don't have it
  if (!vintedUserId) {
    const meRes = await fetch("https://www.vinted.co.uk/api/v2/users/current", { headers });
    if (!meRes.ok) {
      return NextResponse.json({
        error: "Token invalid or expired. Please reconnect your Vinted account.",
      }, { status: 401 });
    }
    const meData = await meRes.json();
    vintedUserId = String(meData.user?.id || "");
    if (vintedUserId) {
      await supabase.from("vinted_connections").update({ vinted_user_id: vintedUserId }).eq("user_id", user.id);
    }
  }

  if (!vintedUserId) {
    return NextResponse.json({ error: "Could not retrieve Vinted user ID." }, { status: 400 });
  }

  // Fetch sold transactions
  const txRes = await fetch(
    `https://www.vinted.co.uk/api/v2/users/${vintedUserId}/sold_items?page=1&per_page=100`,
    { headers }
  );

  if (!txRes.ok) {
    const errText = await txRes.text();
    console.error("Vinted sold items fetch failed:", errText);
    return NextResponse.json({
      error: "Failed to fetch Vinted sales. Your token may have expired — please reconnect.",
    }, { status: 400 });
  }

  const txData = await txRes.json();
  const items = txData.items || txData.sold_items || [];

  if (!items.length) {
    return NextResponse.json({ synced: 0, matched: 0, message: "No sold items found on Vinted." });
  }

  // Get existing inventory for matching
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, quantity_remaining")
    .eq("user_id", user.id);

  let synced = 0;
  let matched = 0;

  for (const item of items) {
    const vintedOrderId = String(item.id || item.transaction_id || "");
    const title: string = item.title || item.item_title || "Vinted Item";
    const price: number = parseFloat(item.price?.amount || item.price || "0");
    const fees: number = parseFloat(item.service_fee?.amount || item.seller_fee?.amount || "0");
    const soldDate: string = item.sold_at || item.created_at || new Date().toISOString();
    const soldDateStr = soldDate.split("T")[0];

    if (!vintedOrderId) continue;

    // Skip if already synced
    const { data: existing } = await supabase
      .from("vinted_sales")
      .select("id")
      .eq("user_id", user.id)
      .eq("vinted_order_id", vintedOrderId)
      .single();

    if (existing) continue;

    // Try to match inventory
    let matchedId: string | null = null;
    let autoMatched = false;

    if (inventoryItems) {
      const titleLower = title.toLowerCase();
      const match = inventoryItems.find(inv => {
        const name = (inv.item_name || "").toLowerCase();
        return (
          titleLower.includes(name) ||
          name.includes(titleLower) ||
          name.split(" ").filter((w: string) => w.length > 3).every((w: string) => titleLower.includes(w))
        );
      });

      if (match && Number(match.quantity_remaining) > 0) {
        matchedId = match.id;
        autoMatched = true;
        const newRemaining = Math.max(0, Number(match.quantity_remaining) - 1);

        await supabase.from("inventory_sales").insert({
          user_id: user.id,
          inventory_item_id: match.id,
          item_name: match.item_name,
          quantity_sold: 1,
          sold_price: price,
          fees,
          shipping: 0,
          sold_date: soldDateStr,
        });

        await supabase.from("inventory_items").update({
          quantity_remaining: newRemaining,
          status: newRemaining === 0 ? "sold" : "in_stock",
          sold_price: price,
          sold_date: soldDateStr,
        }).eq("id", match.id);

        matched++;
      }
    }

    await supabase.from("vinted_sales").insert({
      user_id: user.id,
      item_title: title,
      quantity_sold: 1,
      sale_price: price,
      fees,
      sold_date: soldDateStr,
      notes: null,
      vinted_order_id: vintedOrderId,
      matched_inventory_id: matchedId,
      auto_matched: autoMatched,
    });

    synced++;
  }

  return NextResponse.json({
    synced,
    matched,
    message: `${synced} sale${synced !== 1 ? "s" : ""} synced, ${matched} matched to inventory`,
  });
}
