import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

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

type WebhookTarget = "kicks-flips" | "flips" | "sneakers-clothing";

function getWebhookUrl(target: WebhookTarget): string | undefined {
  switch (target) {
    case "kicks-flips":
      return process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL;
    case "flips":
      return process.env.FLIPS_DISCORD_WEBHOOK_URL;
    case "sneakers-clothing":
      return process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL;
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
  studentDiscount?: string;
  cashback?: string;
  imageUrl?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function buildEmbed(payload: AmaPayload) {
  const {
    title, date, time,
    link1Label, link1Url, link2Label, link2Url,
    retail, resell, profit,
    whyFlips, riskRating = 3, returnsInfo,
    studentDiscount, cashback,
    imageUrl,
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
  if (retail) pricingLines.push(`🏷️  Retail: **${retail}**`);
  if (resell) pricingLines.push(`📈  Resell: **${resell}**`);
  if (profit) pricingLines.push(`✅  Profit: **${profit}** Before Fees Per Unit`);
  if (pricingLines.length) fields.push({ name: "💰  PRICING", value: pricingLines.join("\n") });

  fields.push({ name: "\u200B", value: "──────────────────────" });

  if (whyFlips) fields.push({ name: "📊  WHY THIS FLIPS", value: whyFlips });

  fields.push({ name: "\u200B", value: "──────────────────────" });

  const riskLines = [`Risk Rating: **${RISK_LABELS[riskRating]}**`];
  if (returnsInfo) riskLines.push(`\n${returnsInfo}`);
  fields.push({ name: "⚠️  RISK & RETURNS", value: riskLines.join("\n") });

  const discountLines: string[] = [];
  if (studentDiscount) discountLines.push(`🎒  Student: ${studentDiscount}`);
  if (cashback) discountLines.push(`💳  Cashback: ${cashback}`);
  if (discountLines.length) {
    fields.push({ name: "\u200B", value: "──────────────────────" });
    fields.push({ name: "🎓  STUDENT DISCOUNTS / CASHBACK", value: discountLines.join("\n") });
  }

  // Only attach image if it's a real public URL (not base64 — Discord doesn't support base64 embeds)
  const isPublicUrl = imageUrl && imageUrl.startsWith("http");

  return {
    embeds: [
      {
        title: `⚙️  ${title}`,
        color: RISK_COLOURS[riskRating] ?? 0x3b82f6,
        fields,
        image: isPublicUrl ? { url: imageUrl } : undefined,
        footer: {
          text: "Aftermarket Arbitrage | 2026",
          // icon_url: process.env.AA_LOGO_URL,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: AmaPayload = await req.json();

    if (!body.title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }
    if (!body.webhookTarget) {
      return NextResponse.json({ ok: false, error: "webhookTarget is required" }, { status: 400 });
    }

    const webhookUrl = getWebhookUrl(body.webhookTarget);
    if (!webhookUrl) {
      const envKey = {
        "kicks-flips": "KICKS_FLIPS_DISCORD_WEBHOOK_URL",
        "flips": "FLIPS_DISCORD_WEBHOOK_URL",
        "sneakers-clothing": "SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL",
      }[body.webhookTarget];
      return NextResponse.json(
        { ok: false, error: `${envKey} is not set in .env.local` },
        { status: 500 }
      );
    }

    // If a base64 image was provided (uploaded from device), we need to send it
    // as a file attachment instead of an embed image URL
    const isBase64 = body.imageUrl?.startsWith("data:");

    if (isBase64 && body.imageUrl) {
      // Extract base64 data and mime type
      const matches = body.imageUrl.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, "base64");
        const ext = mimeType.split("/")[1] || "jpg";
        const filename = `drop-image.${ext}`;

        const { FormData, Blob } = await import("node:buffer") as any;
        const formData = new FormData();

        const embedPayload = buildEmbed({ ...body, imageUrl: undefined });
        // Point embed image to the attachment
        if (embedPayload.embeds[0]) {
          (embedPayload.embeds[0] as any).image = { url: `attachment://${filename}` };
        }

        formData.append("payload_json", JSON.stringify(embedPayload));
        formData.append("files[0]", new Blob([buffer], { type: mimeType }), filename);

        await axios.post(webhookUrl, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        // Fallback: send without image
        await axios.post(webhookUrl, buildEmbed({ ...body, imageUrl: undefined }));
      }
    } else {
      await axios.post(webhookUrl, buildEmbed(body));
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.response?.data || error?.message || "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
