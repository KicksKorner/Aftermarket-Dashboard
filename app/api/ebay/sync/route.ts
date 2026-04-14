import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function refreshEbayToken(refreshToken: string) {
  const clientId = process.env.EBAY_CLIENT_ID!;
  const clientSecret = process.env.EBAY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: [
        "https://api.ebay.com/oauth/api_scope",
        "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
        "https://api.ebay.com/oauth/api_scope/sell.finances",
      ].join(" "),
    }),
  });

  if (!res.ok) return null;
  return res.json();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!conn) return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });

  let accessToken = conn.access_token;

  if (new Date(conn.token_expires_at) <= new Date()) {
    const refreshed = await refreshEbayToken(conn.refresh_token);
    if (!refreshed) return NextResponse.json({ error: "Token refresh failed" }, { status: 401 });

    accessToken = refreshed.access_token;
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase.from("ebay_connections").update({
      access_token: accessToken,
      token_expires_at: newExpiry,
    }).eq("user_id", user.id);
  }

  const dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const ordersRes = await fetch(
    `https://api.ebay.com/sell/fulfillment/v1/order?filter=lastmodifieddate:[${dateFrom}..],orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!ordersRes.ok) {
    console.error("eBay orders fetch failed:", await ordersRes.text());
    return NextResponse.json({ error: "Failed to fetch eBay orders" }, { status: 500 });
  }

  const ordersData = await ordersRes.json();
  const orders = ordersData.orders || [];

  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, quantity_remaining")
    .eq("user_id", user.id);

  let synced = 0;
  let matched = 0;

  for (const order of orders) {
    for (const lineItem of order.lineItems || []) {
      const orderId = `${order.orderId}-${lineItem.lineItemId}`;
      const title: string = lineItem.title || "eBay Item";
      const qty: number = lineItem.quantity || 1;
      const price: number = parseFloat(lineItem.lineItemCost?.value || "0");
      const soldDate: string = order.creationDate || new Date().toISOString();

      const { data: existing } = await supabase
        .from("ebay_sales")
        .select("id")
        .eq("user_id", user.id)
        .eq("ebay_order_id", orderId)
        .single();

      if (existing) continue;

      let matchedItemId: string | null = null;
      let autoMatched = false;

      if (inventoryItems) {
        const titleLower = title.toLowerCase();
        const match = inventoryItems.find((item) => {
          const name = (item.item_name || "").toLowerCase();
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
          const nowStr = new Date(soldDate).toISOString().split("T")[0];

          await supabase.from("inventory_sales").insert({
            user_id: user.id,
            inventory_item_id: match.id,
            item_name: match.item_name,
            quantity_sold: qty,
            sold_price: price,
            fees: 0,
            shipping: 0,
            sold_date: nowStr,
          });

          await supabase.from("inventory_items").update({
            quantity_remaining: newRemaining,
            status: newRemaining === 0 ? "sold" : "in_stock",
            sold_price: price,
            sold_date: nowStr,
          }).eq("id", match.id);

          matched++;
        }
      }

      await supabase.from("ebay_sales").insert({
        user_id: user.id,
        ebay_order_id: orderId,
        item_title: title,
        quantity_sold: qty,
        sale_price: price,
        sold_date: soldDate,
        matched_inventory_id: matchedItemId,
        auto_matched: autoMatched,
      });

      synced++;
    }
  }

  return NextResponse.json({ synced, matched, message: `${synced} orders synced, ${matched} matched to inventory` });
}
