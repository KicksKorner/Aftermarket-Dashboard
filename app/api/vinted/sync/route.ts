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

  let token = conn.access_token;
  let vintedUserId = conn.vinted_user_id;

  function makeHeaders(t: string) {
    return {
      "Authorization": `Bearer ${t}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "en-GB,en;q=0.9",
      "X-Client-Id": "web",
      "Referer": "https://www.vinted.co.uk/",
      "Origin": "https://www.vinted.co.uk",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    };
  }

  // Try to refresh token using Vinted's OAuth endpoint if we have a refresh token
  async function tryRefreshToken(): Promise<string | null> {
    if (!conn.refresh_token) return null;
    try {
      const res = await fetch("https://www.vinted.co.uk/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: conn.refresh_token,
          client_id: "android",
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newToken = data.access_token;
      if (newToken) {
        await supabase.from("vinted_connections").update({
          access_token: newToken,
          ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
        }).eq("user_id", user!.id);
        return newToken;
      }
    } catch { return null; }
    return null;
  }

  let headers = makeHeaders(token);

  // Get user ID — also validates token
  if (!vintedUserId) {
    let meRes = await fetch("https://www.vinted.co.uk/api/v2/users/current", { headers });

    // Token expired — try refresh
    if (!meRes.ok && (meRes.status === 401 || meRes.status === 403)) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        token = refreshed;
        headers = makeHeaders(token);
        meRes = await fetch("https://www.vinted.co.uk/api/v2/users/current", { headers });
      }
    }

    if (!meRes.ok) {
      return NextResponse.json({
        error: "Token expired. Please reconnect your Vinted account with a fresh token.",
      }, { status: 401 });
    }
    const meData = await meRes.json();
    vintedUserId = String(meData.user?.id || "");
    if (vintedUserId) {
      await supabase.from("vinted_connections").update({ vinted_user_id: vintedUserId }).eq("user_id", user!.id);
    }
  }

  if (!vintedUserId) {
    return NextResponse.json({ error: "Could not retrieve Vinted user ID." }, { status: 400 });
  }

  // Fetch sold transactions
  // Try fetching sold items using the correct Vinted endpoint
  // Try multiple endpoints as Vinted changes these periodically
  const endpoints = [
    `https://www.vinted.co.uk/api/v2/my_orders?type=sold&per_page=100&page=1`,
    `https://www.vinted.co.uk/api/v2/my_orders?type=sold&status=completed&per_page=100&page=1`,
    `https://www.vinted.co.uk/api/v2/my_orders?type=sold&status=in_progress&per_page=100&page=1`,
  ];

  let txRes: Response | null = null;
  let workingEndpoint = "";

  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, { headers });
    console.log(`Vinted endpoint ${endpoint} → ${res.status}`);
    if (res.ok) {
      txRes = res;
      workingEndpoint = endpoint;
      break;
    }
    // If 401, try refresh once then retry all endpoints
    if ((res.status === 401 || res.status === 403) && conn.refresh_token) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        headers = makeHeaders(refreshed);
        const retryRes = await fetch(endpoint, { headers });
        if (retryRes.ok) {
          txRes = retryRes;
          workingEndpoint = endpoint;
          break;
        }
      }
    }
  }

  if (!txRes) {
    console.error("All Vinted endpoints failed for user", vintedUserId);
    return NextResponse.json({
      error: "Could not fetch Vinted sales. Please disconnect, get a fresh token from your browser cookies and reconnect.",
    }, { status: 400 });
  }
  console.log("Vinted working endpoint:", workingEndpoint);

  const txData = await txRes.json();
  console.log("Vinted response keys:", Object.keys(txData));
  // my_orders endpoint returns { orders: [...] }
  const items = txData.orders || txData.items || txData.sold_items || txData.transactions || [];
  console.log(`Vinted response keys: ${Object.keys(txData).join(", ")} — ${items.length} orders`);
  console.log(`Vinted returned ${items.length} items from ${workingEndpoint}`);

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
    const vintedOrderId = String(item.id || item.order_id || "");
    // my_orders response: order has item{} nested inside
    const itemData = item.item || item;
    const title: string = itemData.title || item.title || "Vinted Item";
    // Price: seller receives total_item_price minus fees
    const totalPrice: number = parseFloat(
      item.total_item_price?.amount || itemData.price?.amount || item.price?.amount || item.price || "0"
    );
    const price: number = totalPrice;
    const fees: number = parseFloat(
      item.service_fee?.amount || item.seller_fee?.amount ||
      item.transaction_fee?.amount || "0"
    );
    const soldDate: string = item.updated_at || item.completed_at || item.created_at || new Date().toISOString();
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
