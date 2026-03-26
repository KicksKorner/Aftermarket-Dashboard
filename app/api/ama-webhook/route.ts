import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const RISK_LABELS: Record<number, string> = {
  1: "1/5 — Very Low ✅",
  2: "2/5 — Low 🟢",
  3: "3/5 — Medium 🟡",
  4: "4/5 — High 🟠",
  5: "5/5 — Very High 🔴",
};

const RISK_COLOURS: Record<number, number> = {
  1: 0x22c55e,
  2: 0x84cc16,
  3: 0xeab308,
  4: 0xf97316,
  5: 0xef4444,
};

const MEMBER_ROLE_ID = "726446805667020892";

type WebhookTarget = "kicks-flips" | "flips" | "sneakers-clothing";

const CHANNEL_LABELS: Record<WebhookTarget, string> = {
  "kicks-flips": "Kicks Flips",
  "flips": "Flips",
  "sneakers-clothing": "Sneakers & Clothing",
};

function getWebhookUrl(target: WebhookTarget): string | undefined {
  switch (target) {
    case "kicks-flips":   return process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL;
    case "flips":         return process.env.FLIPS_DISCORD_WEBHOOK_URL;
    case "sneakers-clothing": return process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL;
  }
}

export interface AmaPayload {
  webhookTarget: WebhookTarget;
  title: string;
  date?: string;
  time?: string;
  link1Label?: string;
  link1Url?: string;
  link2Label?: string;
  link2Url?: string;
  retail?: string;
  resell?: string;
  profit?: string;
  whyFlips?: string;
  riskRating?: number;
  returnsInfo?: string;
  discountCode?: string;
  cashback?: string;
  imageUrl?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function buildEmbed(payload: AmaPayload) {
  const {
    title, date, time,
    link1Label, link1Url, link2Label, link2Url,
    retail, resell, profit,
    whyFlips, riskRating = 3, returnsInfo,
    discountCode, cashback, imageUrl,
  } = payload;

  const fields: { name: string; value: string }[] = [];

  if (date || time) {
    fields.push({
      name: "🕐  TIME & DATE",
      value: [date ? formatDate(date) : "", time ? `${time} GMT` : ""].filter(Boolean).join(" — "),
    });
  }

  const linkLines: string[] = [];
  if (link1Label && link1Url) linkLines.push(`ℹ️  [${link1Label}](${link1Url})`);
  else if (link1Label) linkLines.push(`ℹ️  ${link1Label}`);
  if (link2Label && link2Url) linkLines.push(`📋  [${link2Label}](${link2Url})`);
  else if (link2Label) linkLines.push(`📋  ${link2Label}`);
  if (linkLines.length) fields.push({ name: "🔗  LINKS", value: linkLines.join("\n") });

  const pricingLines: string[] = [];
  if (retail)  pricingLines.push(`🏷️  Retail: **${retail}**`);
  if (resell)  pricingLines.push(`📈  Resell: **${resell}**`);
  if (profit)  pricingLines.push(`✅  Profit: **${profit}** Before Fees Per Unit`);
  if (pricingLines.length) fields.push({ name: "💰  PRICING", value: pricingLines.join("\n") });

  fields.push({ name: "\u200B", value: "──────────────────────" });
  if (whyFlips) fields.push({ name: "📊  WHY THIS FLIPS", value: whyFlips });
  fields.push({ name: "\u200B", value: "──────────────────────" });

  const riskLines = [`Risk Rating: **${RISK_LABELS[riskRating]}**`];
  if (returnsInfo) riskLines.push(`\n${returnsInfo}`);
  fields.push({ name: "⚠️  RISK & RETURNS", value: riskLines.join("\n") });

  const discountLines: string[] = [];
  if (discountCode) discountLines.push(`🏷️  Discount Code: ${discountCode}`);
  if (cashback)     discountLines.push(`💳  Cashback: ${cashback}`);
  if (discountLines.length) {
    fields.push({ name: "\u200B", value: "──────────────────────" });
    fields.push({ name: "🎓  DISCOUNTS / CASHBACK", value: discountLines.join("\n") });
  }

  const isPublicUrl = imageUrl && imageUrl.startsWith("http");

  return {
    // Member ping — sits outside the embed, appears above it in Discord
    content: `<@&${MEMBER_ROLE_ID}>`,
    embeds: [{
      title: `⚙️  ${title}`,
      color: RISK_COLOURS[riskRating] ?? 0x3b82f6,
      fields,
      image: isPublicUrl ? { url: imageUrl } : undefined,
      footer: { text: "Aftermarket Arbitrage | 2026" },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function sendDiscordEmbed(webhookUrl: string, payload: AmaPayload) {
  const isBase64 = payload.imageUrl?.startsWith("data:");

  if (isBase64 && payload.imageUrl) {
    const matches = payload.imageUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");
      const ext = mimeType.split("/")[1] || "jpg";
      const filename = `drop-image.${ext}`;

      const { FormData, Blob } = await import("node:buffer") as any;
      const formData = new FormData();
      const embedPayload = buildEmbed({ ...payload, imageUrl: undefined });
      if (embedPayload.embeds[0]) {
        (embedPayload.embeds[0] as any).image = { url: `attachment://${filename}` };
      }
      formData.append("payload_json", JSON.stringify(embedPayload));
      formData.append("files[0]", new Blob([buffer], { type: mimeType }), filename);
      await axios.post(webhookUrl, formData, { headers: { "Content-Type": "multipart/form-data" } });
      return;
    }
  }

  await axios.post(webhookUrl, buildEmbed(payload));
}

async function saveReminder(payload: AmaPayload) {
  if (!payload.date || !payload.time) return;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dropAt   = new Date(`${payload.date}T${payload.time}:00`);
  const remindAt = new Date(dropAt.getTime() - 60 * 60 * 1000);

  if (remindAt <= new Date()) return;

  await supabase.from("drop_reminders").insert({
    title:               payload.title,
    channel:             CHANNEL_LABELS[payload.webhookTarget],
    drop_at:             dropAt.toISOString(),
    remind_at:           remindAt.toISOString(),
    drop_date_formatted: `${formatDate(payload.date)} ${payload.time}`,
    writeup_url:         payload.link1Url || null,
    sent:                false,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body: AmaPayload = await req.json();

    if (!body.title)         return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    if (!body.webhookTarget) return NextResponse.json({ ok: false, error: "webhookTarget is required" }, { status: 400 });

    const webhookUrl = getWebhookUrl(body.webhookTarget);
    if (!webhookUrl) {
      const envKey = {
        "kicks-flips":        "KICKS_FLIPS_DISCORD_WEBHOOK_URL",
        "flips":              "FLIPS_DISCORD_WEBHOOK_URL",
        "sneakers-clothing":  "SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL",
      }[body.webhookTarget];
      return NextResponse.json({ ok: false, error: `${envKey} is not set in .env.local` }, { status: 500 });
    }

    await sendDiscordEmbed(webhookUrl, body);

    try {
      await saveReminder(body);
    } catch (err) {
      console.error("Failed to schedule reminder:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.response?.data || error?.message || "Server error" }, { status: 500 });
  }
}
