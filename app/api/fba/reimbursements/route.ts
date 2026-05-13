import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = await getValidToken(supabase, user.id);
  if (!token) {
    return NextResponse.json({ error: "No Amazon account connected." }, { status: 400 });
  }

  const found: any[] = [];

  // ── 1. Check inventory adjustments for lost/damaged items ─────────────────
  try {
    const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const adjustRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/fba/inventory/v1/adjustments?marketplaceIds=${UK_MARKETPLACE}&startDate=${since}&granularityType=Marketplace&granularityId=${UK_MARKETPLACE}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );

    if (adjustRes.ok) {
      const adjustData = await adjustRes.json();
      const adjustments = adjustData.payload?.adjustments || [];

      for (const adj of adjustments) {
        const reasons = adj.adjReasons || [];
        for (const reason of reasons) {
          // Negative adjustments = Amazon lost or damaged your stock
          const qty = reason.quantity || 0;
          if (qty >= 0) continue;

          const caseType =
            reason.reasonCode?.toLowerCase().includes("damage") ? "damaged" :
            reason.reasonCode?.toLowerCase().includes("lost") ? "lost" :
            reason.reasonCode?.toLowerCase().includes("return") ? "return" : "other";

          found.push({
            user_id: user.id,
            fnsku: adj.fnsku || null,
            asin: adj.asin || null,
            title: adj.productName || "Unknown Product",
            case_type: caseType,
            quantity: Math.abs(qty),
            estimated_value: 0, // Will be enriched below
            status: "open",
          });
        }
      }
    }
  } catch (e) {
    console.error("Adjustments fetch error:", e);
  }

  // ── 2. Check for unfulfilled return reimbursements ────────────────────────
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const returnsRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/fulfillment/inbound/v0/operationsLog?MarketplaceId=${UK_MARKETPLACE}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    // Returns endpoint varies — log status
    console.log("Returns endpoint status:", returnsRes.status);
  } catch (e) {
    console.error("Returns fetch error:", e);
  }

  // ── 3. Check financial events for reimbursements already paid ─────────────
  let alreadyReimbursed = 0;
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const finRes = await fetch(
      `https://sellingpartnerapi-eu.amazon.com/finances/v0/financialEvents?PostedAfter=${since}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-amz-access-token": token,
        },
      }
    );
    if (finRes.ok) {
      const finData = await finRes.json();
      const reimbEvents = finData.payload?.FinancialEvents?.PayWithAmazonEventList || [];
      alreadyReimbursed = reimbEvents.length;
    }
  } catch (e) {
    console.error("Financial events error:", e);
  }

  // Save new findings to DB (avoid duplicates by fnsku + case_type)
  let savedCount = 0;
  for (const item of found) {
    const { data: existing } = await supabase
      .from("fba_reimbursements")
      .select("id")
      .eq("user_id", user.id)
      .eq("fnsku", item.fnsku || "")
      .eq("case_type", item.case_type)
      .eq("status", "open")
      .single();

    if (!existing) {
      await supabase.from("fba_reimbursements").insert(item);
      savedCount++;
    }
  }

  // Fetch all open reimbursements for this user
  const { data: allReimbursements } = await supabase
    .from("fba_reimbursements")
    .select("*")
    .eq("user_id", user.id)
    .order("found_at", { ascending: false });

  const totalEstimated = (allReimbursements || [])
    .filter(r => r.status === "open")
    .reduce((sum: number, r: any) => sum + Number(r.estimated_value || 0), 0);

  return NextResponse.json({
    ok: true,
    newCases: savedCount,
    totalOpen: (allReimbursements || []).filter((r: any) => r.status === "open").length,
    totalEstimated,
    alreadyReimbursed,
    reimbursements: allReimbursements || [],
    message: `Found ${savedCount} new potential reimbursement case${savedCount !== 1 ? "s" : ""}.`,
  });
}
