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
    case "kicks-flips":       return process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL;
    case "flips":             return process.env.FLIPS_DISCORD_WEBHOOK_URL;
    case "sneakers-clothing": return process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function buildEmbed(fields: Record<string, string>, riskRating: number) {
  const embedFields: { name: string; value: string }[] = [];

  if (fields.date || fields.time) {
    embedFields.push({
      name: "🕐  TIME & DATE",
      value: [fields.date ? formatDate(fields.date) : "", fields.time ? fields.time + " GMT" : ""].filter(Boolean).join(" — "),
    });
  }

  const linkLines: string[] = [];
  if (fields.link1Label && fields.link1Url) linkLines.push(`ℹ️  [${fields.link1Label}](${fields.link1Url})`);
  else if (fields.link1Label) linkLines.push(`ℹ️  ${fields.link1Label}`);
  if (fields.link2Label && fields.link2Url) linkLines.push(`📋  [${fields.link2Label}](${fields.link2Url})`);
  else if (fields.link2Label) linkLines.push(`📋  ${fields.link2Label}`);
  if (linkLines.length) embedFields.push({ name: "🔗  LINKS", value: linkLines.join("\n") });

  const pricingLines: string[] = [];
  if (fields.retail)  pricingLines.push(`🏷️  Retail: **${fields.retail}**`);
  if (fields.resell)  pricingLines.push(`📈  Resell: **${fields.resell}**`);
  if (fields.profit)  pricingLines.push(`✅  Profit: **${fields.profit}** Before Fees Per Unit${fields.roi ? ` *(${fields.roi} ROI)*` : ""}`);
  if (pricingLines.length) embedFields.push({ name: "💰  PRICING", value: pricingLines.join("\n") });

  embedFields.push({ name: "\u200B", value: "──────────────────────" });
  if (fields.whyFlips) embedFields.push({ name: "📊  WHY THIS FLIPS", value: fields.whyFlips });
  embedFields.push({ name: "\u200B", value: "──────────────────────" });

  const riskLines = [`Risk Rating: **${RISK_LABELS[riskRating]}**`];
  if (fields.returnsInfo) riskLines.push("\n" + fields.returnsInfo);
  embedFields.push({ name: "⚠️  RISK & RETURNS", value: riskLines.join("\n") });

  const discountLines: string[] = [];
  if (fields.discountCode) discountLines.push(`🏷️  Discount Code: ${fields.discountCode}`);
  if (fields.cashback)     discountLines.push(`💳  Cashback: ${fields.cashback}`);
  if (discountLines.length) {
    embedFields.push({ name: "\u200B", value: "──────────────────────" });
    embedFields.push({ name: "🎓  DISCOUNTS / CASHBACK", value: discountLines.join("\n") });
  }

  return {
    content: `<@&${MEMBER_ROLE_ID}>`,
    embeds: [{
      title: `⚙️  ${fields.title}`,
      color: RISK_COLOURS[riskRating] ?? 0x3b82f6,
      fields: embedFields,
      footer: { text: "Aftermarket Arbitrage | 2026" },
      timestamp: new Date().toISOString(),
    }],
  };
}

async function saveReminder(fields: Record<string, string>, riskRating: number) {
  if (!fields.date || !fields.time) return;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const dropAt   = new Date(`${fields.date}T${fields.time}:00`);
    const remindAt = new Date(dropAt.getTime() - 60 * 60 * 1000);
    if (remindAt <= new Date()) return;
    await supabase.from("drop_reminders").insert({
      title:               fields.title,
      channel:             CHANNEL_LABELS[fields.webhookTarget as WebhookTarget] ?? fields.webhookTarget,
      drop_at:             dropAt.toISOString(),
      remind_at:           remindAt.toISOString(),
      drop_date_formatted: `${formatDate(fields.date)} ${fields.time}`,
      writeup_url:         fields.link1Url || null,
      sent:                false,
    });
  } catch (err) {
    console.error("Failed to save reminder:", err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const get = (key: string) => (formData.get(key) as string) ?? "";

    const webhookTarget = get("webhookTarget") as WebhookTarget;
    const title = get("title");

    if (!title)         return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    if (!webhookTarget) return NextResponse.json({ ok: false, error: "webhookTarget is required" }, { status: 400 });

    const webhookUrl = getWebhookUrl(webhookTarget);
    if (!webhookUrl) {
      const envKey = {
        "kicks-flips":        "KICKS_FLIPS_DISCORD_WEBHOOK_URL",
        "flips":              "FLIPS_DISCORD_WEBHOOK_URL",
        "sneakers-clothing":  "SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL",
      }[webhookTarget];
      return NextResponse.json({ ok: false, error: `${envKey} is not set in .env.local` }, { status: 500 });
    }

    const riskRating = parseInt(get("riskRating")) || 3;
    const imageUrlRaw = get("imageUrl");
    const imageFile = formData.get("imageFile") as File | null;

    const fields = {
      webhookTarget,
      title,
      date:         get("date"),
      time:         get("time"),
      link1Label:   get("link1Label"),
      link1Url:     get("link1Url"),
      link2Label:   get("link2Label"),
      link2Url:     get("link2Url"),
      retail:       get("retail"),
      resell:       get("resell"),
      profit:       get("profit"),
      roi:          get("roi"),
      whyFlips:     get("whyFlips"),
      returnsInfo:  get("returnsInfo"),
      discountCode: get("discountCode"),
      cashback:     get("cashback"),
    };

    const embed = buildEmbed(fields, riskRating);

    // Handle image
    if (imageFile && imageFile.size > 0) {
      // Send as multipart using native FormData (works on Netlify edge)
      const fd = new FormData();
      const imageEmbed = {
        ...embed,
        embeds: [{ ...embed.embeds[0], image: { url: `attachment://${imageFile.name}` } }],
      };
      fd.append("payload_json", JSON.stringify(imageEmbed));
      fd.append("files[0]", imageFile, imageFile.name);
      const discordRes = await fetch(webhookUrl, { method: "POST", body: fd });
      if (!discordRes.ok) {
        const err = await discordRes.text();
        return NextResponse.json({ ok: false, error: `Discord error: ${err}` }, { status: 502 });
      }
    } else if (imageUrlRaw && imageUrlRaw.startsWith("http")) {
      const imageEmbed = { ...embed, embeds: [{ ...embed.embeds[0], image: { url: imageUrlRaw } }] };
      await axios.post(webhookUrl, imageEmbed);
    } else {
      await axios.post(webhookUrl, embed);
    }

    // Save reminder (non-blocking)
    await saveReminder(fields, riskRating);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.response?.data || error?.message || "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
