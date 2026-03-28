import { NextRequest, NextResponse } from "next/server";

const MEMBER_ROLE_ID = "726446805667020892";

const RISK_LABELS: Record<number, string> = {
  1: "1/5 — Very Low ✅",
  2: "2/5 — Low 🟢",
  3: "3/5 — Medium 🟡",
  4: "4/5 — High 🟠",
  5: "5/5 — Very High 🔴",
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

    const webhookTarget: WebhookTarget = body.webhookTarget;
    const title: string = body.title || "";
    const date: string = body.date || "";
    const time: string = body.time || "";
    const link1Label: string = body.link1Label || "";
    const link1Url: string = body.link1Url || "";
    const link2Label: string = body.link2Label || "";
    const link2Url: string = body.link2Url || "";
    const retail: string = body.retail || "";
    const resell: string = body.resell || "";
    const profit: string = body.profit || "";
    const roi: string = body.roi || "";
    const whyFlips: string = body.whyFlips || "";
    const riskRating: number = parseInt(String(body.riskRating)) || 3;
    const returnsInfo: string = body.returnsInfo || "";
    const discountCode: string = body.discountCode || "";
    const cashback: string = body.cashback || "";
    const imageUrl: string = body.imageUrl || "";

    if (!title) {
      return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
    }

    const webhookUrl = getWebhookUrl(webhookTarget);
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, error: "Webhook URL not configured" }, { status: 500 });
    }

    // Build a plain description string — same approach as deal poster
    const lines: string[] = [];

    if (date || time) {
      lines.push("🕐 **TIME & DATE**");
      const dateParts: string[] = [];
      if (date) dateParts.push(formatDate(date));
      if (time) dateParts.push(time + " GMT");
      lines.push(dateParts.join(" — "));
      lines.push("");
    }

    if (link1Label || link2Label) {
      lines.push("🔗 **LINKS**");
      if (link1Label && link1Url) lines.push("ℹ️ [" + link1Label + "](" + link1Url + ")");
      else if (link1Label) lines.push("ℹ️ " + link1Label);
      if (link2Label && link2Url) lines.push("📋 [" + link2Label + "](" + link2Url + ")");
      else if (link2Label) lines.push("📋 " + link2Label);
      lines.push("");
    }

    if (retail || resell || profit) {
      lines.push("💰 **PRICING**");
      if (retail) lines.push("🏷️ Retail: **" + retail + "**");
      if (resell) lines.push("📈 Resell: **" + resell + "**");
      if (profit) lines.push("✅ Profit: **" + profit + "** Before Fees" + (roi ? " (" + roi + " ROI)" : ""));
      lines.push("");
    }

    if (whyFlips) {
      lines.push("──────────────────────");
      lines.push("📊 **WHY THIS FLIPS**");
      lines.push(whyFlips);
      lines.push("");
    }

    lines.push("──────────────────────");
    lines.push("⚠️ **RISK & RETURNS**");
    lines.push("Risk Rating: **" + (RISK_LABELS[riskRating] || "3/5 — Medium 🟡") + "**");
    if (returnsInfo) lines.push(returnsInfo);

    if (discountCode || cashback) {
      lines.push("");
      lines.push("──────────────────────");
      lines.push("🎓 **DISCOUNTS / CASHBACK**");
      if (discountCode) lines.push("🏷️ Discount Code: " + discountCode);
      if (cashback) lines.push("💳 Cashback: " + cashback);
    }

    const description = lines.join("\n");

    const embedColor = riskRating === 1 ? 3196734
      : riskRating === 2 ? 8704934
      : riskRating === 3 ? 15381256
      : riskRating === 4 ? 16349974
      : 15673924;

    const embed = {
      title: "⚙️  " + title,
      description: description,
      color: embedColor,
      footer: { text: "Aftermarket Arbitrage | 2026" },
      timestamp: new Date().toISOString(),
      ...(imageUrl && imageUrl.startsWith("http") ? { image: { url: imageUrl } } : {}),
    };

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

    // Save reminder non-blocking
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
      } catch (err) {
        console.error("Reminder failed:", err);
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
