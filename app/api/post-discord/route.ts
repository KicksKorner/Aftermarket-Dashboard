import { NextRequest, NextResponse } from "next/server";

type DealPayload = {
  destination?: string;
  destinationLabel?: string;
  description: string;
  shortDescription?: string;
  price: string | number;
  was?: string;
  dealLink: string;
  imageUrl?: string;
  priority?: string;
  category?: string;
  badge?: string;
  expiry?: string;
  dotd?: boolean;
  productTitle?: string;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: number; emoji: string }> = {
  instant_cop:      { label: "⚡ INSTANT COP",      color: 0xef4444, emoji: "⚡" },
  profitable:       { label: "💰 PROFITABLE",        color: 0x22c55e, emoji: "💰" },
  personal_bargain: { label: "🛒 PERSONAL BARGAIN",  color: 0x3b82f6, emoji: "🛒" },
};

function formatPrice(price: string | number) {
  const num = Number(price || 0);
  return `£${num.toFixed(2)}`;
}

function calcSavePct(price: string | number, was: string): string {
  const p = parseFloat(String(price)), w = parseFloat(was);
  if (!p || !w || w <= p) return "";
  return ` (-${Math.round((1 - p / w) * 100)}%)`;
}

async function postToDiscord(deal: DealPayload) {
  const webhook = process.env.DISCORD_WEBHOOK_AMAZON;
  if (!webhook) throw new Error("Missing Discord webhook");

  const priorityCfg = PRIORITY_CONFIG[deal.priority || "instant_cop"] ?? PRIORITY_CONFIG.instant_cop;
  const title = deal.destination === "sneakers" ? "Percy Bargains Alert 🚨" : "Amazon STEAL! Alert 🚨";
  const footer = deal.destination === "sneakers" ? "Bargain Sniper UK • Sneakers" : "Bargain Sniper UK • Deals";

  const wasPart = deal.was ? ` ~~£${deal.was}~~` : "";
  const savePart = deal.was ? calcSavePct(deal.price, deal.was).replace(" (", " • Save ").replace(")", "") : "";

  const discordDescription = deal.productTitle
    ? deal.shortDescription
      ? `**${deal.productTitle}**\n${deal.shortDescription}`
      : deal.productTitle
    : deal.description;

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Price", value: `${formatPrice(deal.price)}${wasPart}${savePart}`, inline: true },
    ...(deal.category ? [{ name: "Category", value: deal.category, inline: true }] : []),
    ...(deal.badge ? [{ name: "Badge", value: deal.badge, inline: true }] : []),
    { name: "Deal Link", value: `[View Deal](${deal.dealLink})`, inline: false },
  ];

  const embed: Record<string, unknown> = {
    title,
    description: discordDescription,
    color: priorityCfg.color,
    fields,
    footer: { text: footer },
  };

  if (deal.imageUrl) embed.image = { url: deal.imageUrl };

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(await res.text() || "Discord post failed");
  return { ok: true };
}

async function postToTelegram(deal: DealPayload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set.");

  const priorityCfg = PRIORITY_CONFIG[deal.priority || "instant_cop"] ?? PRIORITY_CONFIG.instant_cop;
  const emoji = priorityCfg.emoji;

  const isValidUrl = (url: string) => {
    try { new URL(url); return url.startsWith("http"); } catch { return false; }
  };

  const wasPriceLine = deal.was
    ? `<s>£${deal.was}</s>${calcSavePct(deal.price, deal.was)}`
    : "";

  const lines = [
    `${emoji} <b>${deal.productTitle || deal.description}</b>`,
    deal.shortDescription ? deal.shortDescription : "",
    ``,
    `💷 <b>${formatPrice(deal.price)}</b>${wasPriceLine ? `  ${wasPriceLine}` : ""}`,
    deal.destinationLabel ? `📂 ${deal.destinationLabel}` : "",
    deal.category ? `🏷️ ${deal.category}` : "",
    ``,
    `👉 <a href="${deal.dealLink}">View Deal</a>`,
    ``,
    `<i>Bargain Sniper UK</i>`,
  ].filter(Boolean).join("\n");

  const useImage = deal.imageUrl && isValidUrl(deal.imageUrl);

  if (useImage) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: deal.imageUrl,
        caption: lines,
        parse_mode: "HTML",
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
        parse_mode: "HTML",
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
    id,
    title: deal.productTitle || deal.description,
    description: deal.shortDescription || "",
    link: deal.dealLink,
    image: deal.imageUrl || "",
    price: String(deal.price),
    was: deal.was || "",
    category: deal.category || "",
    badge: deal.badge || "",
    expiry: deal.expiry || "",
    dotd: deal.dotd || false,
    expired: false,
    votes: 0,
    added_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}


async function postToFacebook(deal: DealPayload) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !accessToken) throw new Error("FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set.");

  const wasPart = deal.was ? ` Was £${deal.was}${calcSavePct(deal.price, deal.was)}` : "";
  const titleLine = `🔥 ${deal.productTitle || deal.description} 🔥`;
  const lines = [
    titleLine,
    "──────────────────",
    deal.shortDescription || "",
    "",
    `💷 ${formatPrice(deal.price)}${wasPart}`,
    deal.category ? `🏷️ ${deal.category}` : "",
    "",
    `👉 ${deal.dealLink}`,
    "",
    "Bargain Sniper UK",
    "#Ad",
  ].filter(Boolean).join("\n");

  const isValidUrl = (url: string) => { try { new URL(url); return url.startsWith("http"); } catch { return false; } };
  const useImage = deal.imageUrl && isValidUrl(deal.imageUrl);

  if (useImage) {
    const form = new FormData();
    form.append("caption", lines);
    form.append("url", deal.imageUrl!);
    form.append("access_token", accessToken);
    const res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, { method: "POST", body: form });
    if (res.ok) return { ok: true };
    const err = await res.text();
    console.error("Facebook photo error:", err);
    // Fall through to text post
  }

  const res = await fetch(`https://graph.facebook.com/v25.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: lines, access_token: accessToken }),
  });
  if (!res.ok) throw new Error(await res.text() || "Facebook post failed");
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const destination = (formData.get("destination") as string) || "amazon";
    const destinationLabel = destination === "amazon" ? "Amazon" : "Sneakers";
    const description = formData.get("description") as string;
    const productTitle = (formData.get("productTitle") as string) || "";
    const shortDescription = (formData.get("shortDescription") as string) || "";
    const price = formData.get("price") as string;
    const was = (formData.get("was") as string) || "";
    const link = formData.get("link") as string;
    const imageUrl = (formData.get("imageUrl") as string) || "";
    const category = (formData.get("category") as string) || "";
    const badge = (formData.get("badge") as string) || "";
    const expiry = (formData.get("expiry") as string) || "";
    const dotd = formData.get("dotd") === "true";
    const sendDiscord = formData.get("postToDiscord") !== "false";
    const sendTelegram = formData.get("postToTelegram") !== "false";
    const sendWebsite = formData.get("postToWebsite") === "true";
    const sendFacebook = formData.get("postToFacebook") === "true";
    const priority = (formData.get("priority") as string) || "instant_cop";

    if (!description || !price || !link) {
      return NextResponse.json({ ok: false, error: "description, price and link are required" }, { status: 400 });
    }

    const deal: DealPayload = {
      destination, destinationLabel, description,
      productTitle, shortDescription,
      price, was, dealLink: link, imageUrl,
      category, badge, expiry, dotd, priority,
    };

    const results: Record<string, unknown> = {};
    const errors: Record<string, unknown> = {};

    if (sendDiscord) {
      try { results.discord = await postToDiscord(deal); }
      catch (e: any) { errors.discord = e?.message || "Discord post failed"; }
    }

    if (sendTelegram) {
      try { results.telegram = await postToTelegram(deal); }
      catch (e: any) { errors.telegram = e?.message || "Telegram post failed"; }
    }

    if (sendWebsite) {
      try { results.website = await saveDealToSupabase(deal); }
      catch (e: any) { errors.website = e?.message || "Website post failed"; }
    }

    if (sendFacebook) {
      try { results.facebook = await postToFacebook(deal); }
      catch (e: any) { errors.facebook = e?.message || "Facebook post failed"; }
    }

    return NextResponse.json({ ok: Object.keys(errors).length === 0, results, errors });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Server error" }, { status: 500 });
  }
}
