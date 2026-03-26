import { NextRequest, NextResponse } from "next/server";

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

interface AmaPayload {
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
  partnershipInfo?: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.AMA_DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "AMA_DISCORD_WEBHOOK_URL is not set in .env.local" },
      { status: 500 }
    );
  }

  try {
    const body: AmaPayload = await req.json();

    const {
      title,
      date,
      time,
      link1Label,
      link1Url,
      link2Label,
      link2Url,
      retail,
      resell,
      profit,
      whyFlips,
      riskRating = 3,
      returnsInfo,
      studentDiscount,
      cashback,
      partnershipInfo,
    } = body;

    if (!title) {
      return NextResponse.json(
        { ok: false, error: "title is required" },
        { status: 400 }
      );
    }

    // Build embed fields
    const fields: { name: string; value: string; inline?: boolean }[] = [];

    // Time & Date
    if (date || time) {
      const dateStr = date ? formatDate(date) : "";
      const timeStr = time ? `${time} GMT` : "";
      fields.push({
        name: "🕐  TIME & DATE",
        value: [dateStr, timeStr].filter(Boolean).join(" — ") || "TBC",
      });
    }

    // Links
    const linkLines: string[] = [];
    if (link1Label && link1Url) linkLines.push(`ℹ️  [${link1Label}](${link1Url})`);
    else if (link1Label) linkLines.push(`ℹ️  ${link1Label}`);
    if (link2Label && link2Url) linkLines.push(`📋  [${link2Label}](${link2Url})`);
    else if (link2Label) linkLines.push(`📋  ${link2Label}`);
    if (linkLines.length) {
      fields.push({ name: "🔗  LINKS", value: linkLines.join("\n") });
    }

    // Pricing
    const pricingLines: string[] = [];
    if (retail) pricingLines.push(`🏷️  Retail: **${retail}**`);
    if (resell) pricingLines.push(`📈  Resell: **${resell}**`);
    if (profit) pricingLines.push(`✅  Profit: **${profit}** Before Fees Per Unit`);
    if (pricingLines.length) {
      fields.push({ name: "💰  PRICING", value: pricingLines.join("\n") });
    }

    // Divider
    fields.push({ name: "\u200B", value: "──────────────────────" });

    // Why This Flips
    if (whyFlips) {
      fields.push({
        name: "📊  WHY THIS FLIPS",
        value: whyFlips,
      });
    }

    // Divider
    fields.push({ name: "\u200B", value: "──────────────────────" });

    // Risk & Returns
    const riskLines: string[] = [
      `Risk Rating: **${RISK_LABELS[riskRating]}**`,
    ];
    if (returnsInfo) riskLines.push(`\n${returnsInfo}`);
    fields.push({ name: "⚠️  RISK & RETURNS", value: riskLines.join("\n") });

    // Student Discounts / Cashback
    const discountLines: string[] = [];
    if (studentDiscount) discountLines.push(`🎒  Student: ${studentDiscount}`);
    if (cashback) discountLines.push(`💳  Cashback: ${cashback}`);
    if (discountLines.length) {
      fields.push({ name: "\u200B", value: "──────────────────────" });
      fields.push({
        name: "🎓  STUDENT DISCOUNTS / CASHBACK",
        value: discountLines.join("\n"),
      });
    }

    // Partnership Info
    if (partnershipInfo) {
      fields.push({ name: "\u200B", value: "──────────────────────" });
      fields.push({ name: "🤝  PARTNERSHIP INFO", value: partnershipInfo });
    }

    const embed = {
      title: `⚙️  ${title}`,
      color: RISK_COLOURS[riskRating] ?? 0x3b82f6,
      fields,
      footer: {
        text: "ResellRadar® | Your Edge in Reselling",
        // Replace this with your logo URL:
        // icon_url: "https://yourdomain.com/logo.png",
      },
      timestamp: new Date().toISOString(),
    };

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      return NextResponse.json(
        { ok: false, error: `Discord rejected the webhook: ${errorText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
