import { NextRequest, NextResponse } from "next/server";
import {
  postToDiscord,
  postToFacebook,
  postToX,
  type DealPayload,
} from "@/lib/social-posters";

async function saveDealToSupabase(deal: DealPayload) {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const id = "d_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  const { error } = await supabase.from("deals").insert({
    id, title: deal.description, description: "",
    link: deal.dealLink, image: deal.imageUrl || "",
    price: String(deal.price), was: "",
    category: deal.destinationLabel || deal.destination || "Amazon",
    badge: "", expiry: "", dotd: false, expired: false, votes: 0,
    added_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const destination = (formData.get("destination") as string) || "amazon";
    const destinationLabel = destination === "amazon" ? "Amazon" : "Sneakers";
    const description = formData.get("description") as string;
    const price = formData.get("price") as string;
    const link = formData.get("link") as string;
    const imageUrl = (formData.get("imageUrl") as string) || "";
    const sendDiscord = formData.get("postToDiscord") !== "false";
    const sendX = formData.get("postToX") !== "false";
    const sendFacebook = formData.get("postToFacebook") === "true";
    const sendWebsite = formData.get("postToWebsite") === "true";
    const priority = (formData.get("priority") as string) || "instant_cop";

    if (!description || !price || !link) {
      return NextResponse.json({ ok: false, error: "description, price and link are required" }, { status: 400 });
    }

    const deal: DealPayload = { destination, destinationLabel, description, price, dealLink: link, imageUrl, priority };
    const results: Record<string, unknown> = { discord: null, x: null, facebook: null, website: null };
    const errors: Record<string, unknown> = {};

    if (sendDiscord) { try { results.discord = await postToDiscord(deal); } catch (e: any) { errors.discord = e?.response?.data || e?.message || "Discord post failed"; } }
    if (sendX) { try { results.x = await postToX(deal); } catch (e: any) { errors.x = e?.response?.data || e?.message || "X post failed"; } }
    if (sendFacebook) { try { results.facebook = await postToFacebook(deal); } catch (e: any) { errors.facebook = e?.response?.data || e?.message || "Facebook post failed"; } }
    if (sendWebsite) { try { results.website = await saveDealToSupabase(deal); } catch (e: any) { errors.website = e?.message || "Website post failed"; } }

    return NextResponse.json({ ok: Object.keys(errors).length === 0, results, errors });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Server error" }, { status: 500 });
  }
}
