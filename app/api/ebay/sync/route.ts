import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getValidToken(supabase: any, userId: string) {
  const { data: conn } = await supabase
    .from("ebay_connections")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .single();

  if (!conn) return null;

  const expiresAt = new Date(conn.token_expires_at);
  if (expiresAt <= new Date(Date.now() + 60000)) {
    const credentials = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString("base64");
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
    });
    if (res.ok) {
      const data = await res.json();
      const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await supabase.from("ebay_connections").update({
        access_token: data.access_token,
        token_expires_at: newExpiry,
      }).eq("user_id", userId);
      return data.access_token;
    }
  }
  return conn.access_token;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(supabase, user.id);
  if (!token) return NextResponse.json({ error: "No eBay account connected" }, { status: 400 });

  // Fetch ALL orders from last 90 days — no fulfillment status filter
  // This catches: paid, shipped, and delivered orders
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(
    `https://api.ebay.com/sell/fulfillment/v1/order?filter=lastmodifieddate:[${since}..]&limit=200`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("eBay sync error:", res.status, err);
    return NextResponse.json({ error: "Failed to fetch eBay orders", status: res.status }, { status: 500 });
  }

  const data = await res.json();
  const orders = data.orders || [];
  console.log(`eBay sync: ${orders.length} orders fetched`);

  // Get existing inventory for auto-matching
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, quantity_remaining")
    .eq("user_id", user.id);

  let synced = 0;
  let matched = 0;

  for (const order of orders) {
    const orderId = order.orderId;
    const lineItems = order.lineItems || [];

    for (const lineItem of lineItems) {
      const title: string = lineItem.title || "eBay Item";
      const quantity = lineItem.quantity || 1;
      const salePrice = parseFloat(lineItem.lineItemCost?.value || "0");
      const soldDate = order.creationDate?.split("T")[0] || new Date().toISOString().split("T")[0];
      const legacyItemId = lineItem.legacyItemId || "";
      const ebayOrderId = `${orderId}-${lineItem.lineItemId || legacyItemId}`;

      if (!ebayOrderId) continue;

      // Skip already synced
      const { data: existing } = await supabase
        .from("ebay_sales")
        .select("id")
        .eq("user_id", user.id)
        .eq("ebay_order_id", ebayOrderId)
        .single();

      if (existing) continue;

      // Auto-match inventory
      let matchedInventoryId: string | null = null;
      let autoMatched = false;

      if (inventoryItems) {
        const titleLower = title.toLowerCase();
        const match = inventoryItems.find((inv: any) => {
          const name = (inv.item_name || "").toLowerCase();
          return (
            titleLower.includes(name) ||
            name.includes(titleLower) ||
            name.split(" ").filter((w: string) => w.length > 4)
              .every((w: string) => titleLower.includes(w))
          );
        });

        if (match && Number(match.quantity_remaining) > 0) {
          matchedInventoryId = match.id;
          autoMatched = true;
          const newRemaining = Math.max(0, Number(match.quantity_remaining) - quantity);

          await supabase.from("inventory_sales").insert({
            user_id: user.id,
            inventory_item_id: match.id,
            item_name: match.item_name,
            quantity_sold: quantity,
            sold_price: salePrice,
            fees: 0,
            shipping: 0,
            sold_date: soldDate,
          });

          await supabase.from("inventory_items").update({
            quantity_remaining: newRemaining,
            status: newRemaining === 0 ? "sold" : "in_stock",
            sold_price: salePrice,
            sold_date: soldDate,
          }).eq("id", match.id);

          matched++;
        }
      }

      await supabase.from("ebay_sales").insert({
        user_id: user.id,
        ebay_order_id: ebayOrderId,
        item_title: title,
        quantity_sold: quantity,
        sale_price: salePrice,
        sold_date: soldDate,
        auto_matched: autoMatched,
        matched_inventory_id: matchedInventoryId,
      });

      synced++;
    }
  }

  return NextResponse.json({
    synced,
    matched,
    message: `Synced ${synced} order${synced !== 1 ? "s" : ""}. ${matched} matched to inventory.`,
  });
}
