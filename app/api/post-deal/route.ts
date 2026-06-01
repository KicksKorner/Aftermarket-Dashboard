import { NextRequest, NextResponse } from "next/server";
import { postToDiscord, type DealPayload } from "@/lib/social-posters";

async function postToTelegram(deal: DealPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set in environment variables.");

  const priorityEmoji: Record<string, string> = {
    instant_cop: "⚡",
    profitable: "💰",
    personal_bargain: "🛒",
  };
  const emoji = priorityEmoji[deal.priority || "instant_cop"] || "🔥";

  // Build message text (Telegram MarkdownV2 needs escaping)
  const escape = (text: string) => text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");

  const lines = [
    `${emoji} *${escape(deal.description)}*`,
    ``,
    `💷 *£${escape(deal.price)}*`,
    deal.destinationLabel ? `📂 ${escape(deal.destinationLabel)}` : "",
    ``,
    `👉 [View Deal](${deal.dealLink})`,
    ``,
    `_Bargain Sniper UK_`,
  ].filter(Boolean).join("\n");

  // If there's an image URL, send as photo with caption — otherwise send as text
  if (deal.imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: deal.imageUrl,
        caption: lines,
        parse_mode: "MarkdownV2",
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || "Telegram sendPhoto failed");
    return data;
  } else {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: false,
      }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description || "Telegram sendMessage failed");
    return data;
  }
}

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
    const sendTelegram = formData.get("postToTelegram") !== "false";
    const sendWebsite = formData.get("postToWebsite") === "true";
    const priority = (formData.get("priority") as string) || "instant_cop";

    if (!description || !price || !link) {
      return NextResponse.json({ ok: false, error: "description, price and link are required" }, { status: 400 });
    }

    const deal: DealPayload = {
      destination, destinationLabel, description,
      price, dealLink: link, imageUrl, priority,
    };

    const results: Record<string, unknown> = { discord: null, telegram: null, website: null };
    const errors: Record<string, unknown> = {};

    if (sendDiscord) {
      try { results.discord = await postToDiscord(deal); }
      catch (e: any) { errors.discord = e?.response?.data || e?.message || "Discord post failed"; }
    }

    if (sendTelegram) {
      try { results.telegram = await postToTelegram(deal); }
      catch (e: any) { errors.telegram = e?.message || "Telegram post failed"; }
    }

    if (sendWebsite) {
      try { results.website = await saveDealToSupabase(deal); }
      catch (e: any) { errors.website = e?.message || "Website post failed"; }
    }

    return NextResponse.json({ ok: Object.keys(errors).length === 0, results, errors });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Server error" }, { status: 500 });
  }
}
