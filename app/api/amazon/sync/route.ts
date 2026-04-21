import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function refreshAccessToken(conn: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}) {
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
  return res.json();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get connection
  const { data: conn } = await supabase
    .from("amazon_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!conn) return NextResponse.json({ error: "No Amazon account connected" }, { status: 400 });

  // Refresh token if expired
  let accessToken = conn.access_token;
  if (!accessToken || new Date(conn.token_expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(conn);
    if (!refreshed?.access_token) {
      return NextResponse.json({
        error: "Failed to refresh token. Please reconnect your Amazon account.",
      }, { status: 401 });
    }
    accessToken = refreshed.access_token;
    await supabase.from("amazon_connections").update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
    }).eq("user_id", user.id);
  }

  const marketplaceId = conn.marketplace_id || "A1F83G8C2ARO7P";
  const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch orders from Amazon SP-API
  const ordersRes = await fetch(
    `https://sellingpartnerapi-eu.amazon.com/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=${dateFrom}&OrderStatuses=Shipped,Unshipped,PartiallyShipped`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-amz-access-token": accessToken,
        "Content-Type": "application/json",
      },
    }
  );

  if (!ordersRes.ok) {
    const errText = await ordersRes.text();
    console.error("Amazon orders fetch failed:", errText);
    return NextResponse.json({
      error: "Failed to fetch Amazon orders. Please check your credentials and try again.",
    }, { status: 500 });
  }

  const ordersData = await ordersRes.json();
  const orders = ordersData.payload?.Orders || [];

  // Get existing inventory for matching
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, quantity_remaining")
    .eq("user_id", user.id);

  let synced = 0;
  let matched = 0;

  for (const order of orders) {
    const orderId = order.AmazonOrderId;
    if (!orderId) continue;

    // Fetch order items
    const itemsRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/orders/v0/orders/${orderId}/orderItems`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-amz-access-token": accessToken,
        },
      }
    );

    if (!itemsRes.ok) continue;
    const itemsData = await itemsRes.json();
    const orderItems = itemsData.payload?.OrderItems || [];

    for (const item of orderItems) {
      const lineId = `${orderId}-${item.OrderItemId}`;
      const title: string = item.Title || "Amazon Item";
      const asin: string = item.ASIN || "";
      const qty: number = Number(item.QuantityOrdered) || 1;
      const price: number = parseFloat(item.ItemPrice?.Amount || "0");
      const fees: number = parseFloat(item.ItemTax?.Amount || "0");
      const soldDate: string = order.PurchaseDate || new Date().toISOString();

      // Skip if already synced
      const { data: existing } = await supabase
        .from("amazon_sales")
        .select("id")
        .eq("user_id", user.id)
        .eq("amazon_order_id", lineId)
        .single();

      if (existing) continue;

      // Try to match to inventory
      let matchedItemId: string | null = null;
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
          matchedItemId = match.id;
          autoMatched = true;
          const newRemaining = Math.max(0, Number(match.quantity_remaining) - qty);
          const soldDateStr = new Date(soldDate).toISOString().split("T")[0];

          await supabase.from("inventory_sales").insert({
            user_id: user.id,
            inventory_item_id: match.id,
            item_name: match.item_name,
            quantity_sold: qty,
            sold_price: price,
            fees: fees,
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

      await supabase.from("amazon_sales").insert({
        user_id: user.id,
        amazon_order_id: lineId,
        item_title: title,
        asin: asin || null,
        quantity_sold: qty,
        sale_price: price,
        amazon_fees: fees,
        sold_date: soldDate,
        matched_inventory_id: matchedItemId,
        auto_matched: autoMatched,
      });

      synced++;
    }
  }

  return NextResponse.json({
    synced,
    matched,
    message: `${synced} orders synced, ${matched} matched to inventory`,
  });
}
