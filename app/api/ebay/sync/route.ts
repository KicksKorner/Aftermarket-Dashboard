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
    const credentials = Buffer.from(
      `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString("base64");
    const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: conn.refresh_token,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
      await supabase
        .from("ebay_connections")
        .update({ access_token: data.access_token, token_expires_at: newExpiry })
        .eq("user_id", userId);
      return data.access_token;
    }
    return null;
  }
  return conn.access_token;
}

function mapOrderStatus(
  fulfillmentStatus: string,
  paymentStatus: string,
  cancelStatus?: string
): string {
  if (cancelStatus && cancelStatus !== "NONE_REQUESTED") return "CANCELLED";
  if (paymentStatus === "FAILED" || paymentStatus === "REFUNDED") return "REFUNDED";
  switch (fulfillmentStatus) {
    case "FULFILLED": return "COMPLETED";
    case "IN_PROGRESS": return "SHIPPED";
    case "NOT_STARTED": return "PAID";
    default: return fulfillmentStatus ?? "PAID";
  }
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(supabase, user.id);
  if (!token) {
    return NextResponse.json(
      { error: "eBay token expired or revoked. Please reconnect your eBay account.", broken: true },
      { status: 401 }
    );
  }

  // ── Fetch orders from last 90 days ────────────────────────────────────────
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
    if (res.status === 401) {
      return NextResponse.json(
        { error: "eBay connection broken. Please reconnect.", broken: true },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch eBay orders", status: res.status },
      { status: 500 }
    );
  }

  const data = await res.json();
  const orders = data.orders || [];
  console.log(`eBay sync: ${orders.length} orders fetched`);

  // ── Build all line items from eBay response first ─────────────────────────
  type LineItemRecord = {
    ebayOrderId: string;
    title: string;
    quantity: number;
    salePricePerUnit: number;
    soldDate: string;
    orderStatus: string;
    lineFees: number;
    linePostage: number;
  };

  const allLineItems: LineItemRecord[] = [];

  for (const order of orders) {
    const orderId = order.orderId;
    const lineItems = order.lineItems || [];

    const fulfillmentStatus: string =
      order.orderFulfillmentStatus || order.fulfillmentStatus || "NOT_STARTED";
    const paymentStatus: string =
      order.paymentSummary?.payments?.[0]?.paymentStatus ||
      order.orderPaymentStatus || "PAID";
    const cancelStatus: string =
      order.cancelStatus?.cancelState || order.cancelState || "NONE_REQUESTED";
    const orderStatus = mapOrderStatus(fulfillmentStatus, paymentStatus, cancelStatus);

    const pricingSummary = order.pricingSummary || {};
    const totalFees =
      parseFloat(pricingSummary.totalFee?.value || "0") +
      parseFloat(pricingSummary.finalValueFee?.value || "0");
    const postage = parseFloat(pricingSummary.deliveryCost?.value || "0");
    const lineCount = lineItems.length || 1;

    for (const lineItem of lineItems) {
      const title: string = lineItem.title || "eBay Item";
      const quantity = lineItem.quantity || 1;
      const lineItemCostTotal = parseFloat(lineItem.lineItemCost?.value || "0");
      const salePricePerUnit = quantity > 1 ? lineItemCostTotal / quantity : lineItemCostTotal;
      const soldDate =
        order.creationDate?.split("T")[0] ||
        new Date().toISOString().split("T")[0];
      const legacyItemId = lineItem.legacyItemId || "";
      const ebayOrderId = `${orderId}-${lineItem.lineItemId || legacyItemId}`;
      if (!ebayOrderId) continue;

      allLineItems.push({
        ebayOrderId,
        title,
        quantity,
        salePricePerUnit,
        soldDate,
        orderStatus,
        lineFees: lineCount > 1 ? totalFees / lineCount : totalFees,
        linePostage: lineCount > 1 ? postage / lineCount : postage,
      });
    }
  }

  if (allLineItems.length === 0) {
    return NextResponse.json({ synced: 0, matched: 0, updated: 0, message: "No orders found." });
  }

  // ── BATCH: fetch all existing ebay_order_ids in one query ─────────────────
  const allOrderIds = allLineItems.map(l => l.ebayOrderId);
  const { data: existingRows } = await supabase
    .from("ebay_sales")
    .select("id, ebay_order_id")
    .eq("user_id", user.id)
    .in("ebay_order_id", allOrderIds);

  const existingMap = new Map<string, string>(
    (existingRows || []).map((r: any) => [r.ebay_order_id, r.id])
  );

  // ── BATCH: fetch inventory items once ────────────────────────────────────
  const { data: inventoryItems } = await supabase
    .from("inventory_items")
    .select("id, item_name, quantity_remaining")
    .eq("user_id", user.id);

  // ── Process each line item ────────────────────────────────────────────────
  const toInsert: any[] = [];
  const toUpdate: Array<{ id: string; order_status: string; platform_fees: number; postage_cost: number; sale_price: number }> = [];
  const inventorySalesToInsert: any[] = [];
  const inventoryUpdates: Array<{ id: string; quantity_remaining: number; status: string; sold_price: number; sold_date: string }> = [];

  let matched = 0;

  for (const item of allLineItems) {
    const existingId = existingMap.get(item.ebayOrderId);

    if (existingId) {
      // Queue update — no extra DB call needed
      toUpdate.push({
        id: existingId,
        order_status: item.orderStatus,
        platform_fees: item.lineFees,
        postage_cost: item.linePostage,
        sale_price: item.salePricePerUnit,
      });
      continue;
    }

    // New order — try to auto-match inventory
    let matchedInventoryId: string | null = null;
    let autoMatched = false;

    if (inventoryItems) {
      const titleLower = item.title.toLowerCase();
      const match = inventoryItems.find((inv: any) => {
        const name = (inv.item_name || "").toLowerCase();
        return (
          titleLower.includes(name) ||
          name.includes(titleLower) ||
          name
            .split(" ")
            .filter((w: string) => w.length > 4)
            .every((w: string) => titleLower.includes(w))
        );
      });

      if (match && Number(match.quantity_remaining) > 0) {
        matchedInventoryId = match.id;
        autoMatched = true;
        const newRemaining = Math.max(0, Number(match.quantity_remaining) - item.quantity);

        inventorySalesToInsert.push({
          user_id: user.id,
          inventory_item_id: match.id,
          item_name: match.item_name,
          quantity_sold: item.quantity,
          sold_price: item.salePricePerUnit,
          fees: item.lineFees,
          shipping: item.linePostage,
          sold_date: item.soldDate,
        });

        inventoryUpdates.push({
          id: match.id,
          quantity_remaining: newRemaining,
          status: newRemaining === 0 ? "sold" : "in_stock",
          sold_price: item.salePricePerUnit,
          sold_date: item.soldDate,
        });

        // Decrement so subsequent matches don't over-allocate
        match.quantity_remaining = newRemaining;
        matched++;
      }
    }

    toInsert.push({
      user_id: user.id,
      ebay_order_id: item.ebayOrderId,
      item_title: item.title,
      quantity_sold: item.quantity,
      sale_price: item.salePricePerUnit,
      sold_date: item.soldDate,
      auto_matched: autoMatched,
      matched_inventory_id: matchedInventoryId,
      order_status: item.orderStatus,
      platform_fees: item.lineFees,
      postage_cost: item.linePostage,
      return_reason: null,
      return_status: null,
      refund_amount: null,
      has_open_case: false,
    });
  }

  // ── BATCH writes ──────────────────────────────────────────────────────────

  // Insert new sales in one batch
  if (toInsert.length > 0) {
    await supabase.from("ebay_sales").insert(toInsert);
  }

  // Update existing sales in chunks of 50 to avoid query size limits
  const CHUNK = 50;
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK);
    // Use upsert with the id to update each row
    await supabase.from("ebay_sales").upsert(
      chunk.map(u => ({
        id: u.id,
        order_status: u.order_status,
        platform_fees: u.platform_fees,
        postage_cost: u.postage_cost,
        sale_price: u.sale_price,
      }))
    );
  }

  // Insert inventory sales in one batch
  if (inventorySalesToInsert.length > 0) {
    await supabase.from("inventory_sales").insert(inventorySalesToInsert);
  }

  // Update inventory items individually (small number expected)
  for (const upd of inventoryUpdates) {
    await supabase
      .from("inventory_items")
      .update({
        quantity_remaining: upd.quantity_remaining,
        status: upd.status,
        sold_price: upd.sold_price,
        sold_date: upd.sold_date,
      })
      .eq("id", upd.id);
  }

  const synced = toInsert.length;
  const updated = toUpdate.length;

  console.log(`eBay sync complete: ${synced} new, ${updated} updated, ${matched} matched`);

  return NextResponse.json({
    synced,
    matched,
    updated,
    message: `Synced ${synced} new order${synced !== 1 ? "s" : ""}. ${matched} matched to inventory. ${updated} existing records updated.`,
  });
}
