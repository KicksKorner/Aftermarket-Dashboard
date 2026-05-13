import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const UK_MARKETPLACE = "A1F83G8C2ARO7P";

async function getValidToken(supabase: any, userId: string) {
  const { data: conn } = await supabase
    .from("amazon_connections")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (!conn) return null;
  let token = conn.access_token;
  if (!token || new Date(conn.token_expires_at) <= new Date()) {
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
    const data = await res.json();
    token = data.access_token;
    await supabase.from("amazon_connections").update({
      access_token: token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    }).eq("user_id", userId);
  }
  return token;
}

// GET — fetch current alert settings + stock levels
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: alerts } = await supabase
    .from("fba_replenishment_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ alerts: alerts || [] });
}

// POST — sync current FBA stock levels and check against thresholds
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action || "sync";

  // ADD or UPDATE alert threshold
  if (action === "upsert") {
    const { asin, title, threshold, notes } = body;
    if (!asin || threshold === undefined) {
      return NextResponse.json({ error: "ASIN and threshold required" }, { status: 400 });
    }
    const { error } = await supabase.from("fba_replenishment_alerts").upsert({
      user_id: user.id,
      asin: asin.trim().toUpperCase(),
      title: title || asin,
      threshold: Number(threshold),
      notes: notes || null,
      is_active: true,
    }, { onConflict: "user_id,asin" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // DELETE alert
  if (action === "delete") {
    const { id } = body;
    await supabase.from("fba_replenishment_alerts").delete().eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  // SYNC — pull live stock levels from Amazon SP-API
  const token = await getValidToken(supabase, user.id);
  if (!token) {
    return NextResponse.json({ error: "No Amazon account connected." }, { status: 400 });
  }

  // Get all active alerts
  const { data: alerts } = await supabase
    .from("fba_replenishment_alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (!alerts?.length) {
    return NextResponse.json({ ok: true, checked: 0, triggered: 0, message: "No alerts configured." });
  }

  // Fetch FBA inventory summary
  let inventoryItems: any[] = [];
  try {
    const invRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/fba/inventory/v1/summaries?details=true&granularityType=Marketplace&granularityId=${UK_MARKETPLACE}&marketplaceIds=${UK_MARKETPLACE}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (invRes.ok) {
      const invData = await invRes.json();
      inventoryItems = invData.payload?.inventorySummaries || [];
    }
  } catch (e) {
    console.error("Inventory fetch error:", e);
  }

  // Build ASIN → stock map
  const stockMap = new Map<string, number>();
  for (const item of inventoryItems) {
    const asin = item.asin;
    const qty = item.inventoryDetails?.fulfillableQuantity ||
      item.totalQuantity || 0;
    stockMap.set(asin, qty);
  }

  let triggered = 0;
  const now = new Date().toISOString();

  for (const alert of alerts) {
    const currentStock = stockMap.get(alert.asin) ?? null;
    const isBelowThreshold = currentStock !== null && currentStock <= alert.threshold;
    const wasAlreadyTriggered = alert.is_triggered;

    await supabase.from("fba_replenishment_alerts").update({
      current_stock: currentStock,
      last_checked_at: now,
      is_triggered: isBelowThreshold,
      triggered_at: isBelowThreshold && !wasAlreadyTriggered ? now : alert.triggered_at,
    }).eq("id", alert.id);

    if (isBelowThreshold) triggered++;
  }

  return NextResponse.json({
    ok: true,
    checked: alerts.length,
    triggered,
    message: `Checked ${alerts.length} ASINs. ${triggered} below reorder threshold.`,
  });
}
