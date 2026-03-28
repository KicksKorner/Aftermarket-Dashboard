import { NextRequest, NextResponse } from "next/server";

const MEMBER_ROLE_ID = "726446805667020892";

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
    case "kicks-flips":       return process.env.KICKS_FLIPS_DISCORD_WEBHOOK_URL;
    case "flips":             return process.env.FLIPS_DISCORD_WEBHOOK_URL;
    case "sneakers-clothing": return process.env.SNEAKERS_CLOTHING_DISCORD_WEBHOOK_URL;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      webhookTarget,
      title,
      date = "",
      time = "",
      link1Label = "",
      link1Url = "",
      link2Label = "",
      link2Url = "",
      retail = "",
      resell = "",
      profit = "",
      roi = "",
      whyFlips = "",
      riskRating = 3,
      returnsInfo = "",
      discountCode = "",
      cashback = "",
      imageUrl = "",
    } = body;

    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }

    const webhookUrl = getWebhookUrl(webhookTarget as WebhookTarget);
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, error: "Webhook URL not configured for this channel" }, { status: 500 });
    }

    // Build fields
    const fields: { name: string; value: string }[] = [];

    if (date || time) {
      const parts: string[] = [];
      if (date) parts.push(formatDate(date));
      if (time) parts.push(time + " GMT");
      fields.push({ name: "🕐  TIME & DATE", value: parts.join(" — ") });
    }

    const linkLines: string[] = [];
    if (link1Label && link1Url) linkLines.push("ℹ️  [" + link1Label + "](" + link1Url + ")");
    else if (link1Label) linkLines.push("ℹ️  " + link1Label);
    if (link2Label && link2Url) linkLines.push("📋  [" + link2Label + "](" + link2Url + ")");
    else if (link2Label) linkLines.push("📋  " + link2Label);
    if (linkLines.length > 0) fields.push({ name: "🔗  LINKS", value: linkLines.join("\n") });

    const pricingLines: string[] = [];
    if (retail) pricingLines.push("🏷️  Retail: **" + retail + "**");
    if (resell) pricingLines.push("📈  Resell: **" + resell + "**");
    if (profit) pricingLines.push("✅  Profit: **" + profit + "** Before Fees Per Unit" + (roi ? " *(" + roi + " ROI)*" : ""));
    if (pricingLines.length > 0) fields.push({ name: "💰  PRICING", value: pricingLines.join("\n") });

    fields.push({ name: "\u200B", value: "──────────────────────" });
    if (whyFlips) fields.push({ name: "📊  WHY THIS FLIPS", value: whyFlips });
    fields.push({ name: "\u200B", value: "──────────────────────" });

    const riskValue = returnsInfo
      ? "Risk Rating: **" + RISK_LABELS[riskRating] + "**\n\n" + returnsInfo
      : "Risk Rating: **" + RISK_LABELS[riskRating] + "**";
    fields.push({ name: "⚠️  RISK & RETURNS", value: riskValue });

    const discountLines: string[] = [];
    if (discountCode) discountLines.push("🏷️  Discount Code: " + discountCode);
    if (cashback) discountLines.push("💳  Cashback: " + cashback);
    if (discountLines.length > 0) {
      fields.push({ name: "\u200B", value: "──────────────────────" });
      fields.push({ name: "🎓  DISCOUNTS / CASHBACK", value: discountLines.join("\n") });
    }

    const embed: Record<string, unknown> = {
      title: "⚙️  " + title,
      color: RISK_COLOURS[riskRating] || 0x3b82f6,
      fields,
      footer: { text: "Aftermarket Arbitrage | 2026" },
      timestamp: new Date().toISOString(),
    };

    if (imageUrl && imageUrl.startsWith("http")) {
      embed.image = { url: imageUrl };
    }

    const payload = {
      content: "<@&" + MEMBER_ROLE_ID + ">",
      embeds: [embed],
    };

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!discordRes.ok) {
      const errText = await discordRes.text();
      return NextResponse.json({ ok: false, error: "Discord error: " + errText }, { status: 502 });
    }

    // Save reminder (non-blocking)
    if (date && time) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const dropAt = new Date(date + "T" + time + ":00");
        const remindAt = new Date(dropAt.getTime() - 60 * 60 * 1000);
        if (remindAt > new Date()) {
          const channelMap: Record<string, string> = {
            "kicks-flips": "Kicks Flips",
            "flips": "Flips",
            "sneakers-clothing": "Sneakers & Clothing",
          };
          await supabase.from("drop_reminders").insert({
            title,
            channel: channelMap[webhookTarget] || webhookTarget,
            drop_at: dropAt.toISOString(),
            remind_at: remindAt.toISOString(),
            drop_date_formatted: formatDate(date) + " " + time,
            writeup_url: link1Url || null,
            sent: false,
          });
        }
      } catch (reminderErr) {
        console.error("Reminder save failed (non-fatal):", reminderErr);
      }
    }

    return NextResponse.json({ ok: true });

  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
