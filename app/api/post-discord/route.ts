import { NextResponse } from "next/server";

type Destination = "amazon" | "sneakers";

export async function POST(req: Request) {
  try {
    const { description, price, link, imageUrl, destination } = await req.json();

    if (!description || !price || !link || !destination) {
      return NextResponse.json(
        { error: "Description, price, link and destination are required." },
        { status: 400 }
      );
    }

    let parsedLink: URL;

    try {
      parsedLink = new URL(link);
    } catch {
      return NextResponse.json(
        { error: "Please enter a valid full URL, including https://"},
        { status: 400 }
      );
    }

    const webhookConfigs: Record<
      Destination,
      {
        webhook: string | undefined;
        title: string;
        color: number;
        footer: string;
        buttonText: string;
      }
    > = {
      amazon: {
        webhook: process.env.DISCORD_WEBHOOK_AMAZON,
        title: "Amazon STEAL! Alert 🚨",
        color: 0x2563eb,
        footer: "Bargain Sniper UK • Amazon Deals",
        buttonText: "View Deal",
      },
      sneakers: {
        webhook: process.env.DISCORD_WEBHOOK_SNEAKERS,
        title: "Percy Bargains Alert 🚨",
        color: 0x22c55e,
        footer: "Bargain Sniper UK • Sneakers",
        buttonText: "View Deal",
      },
    };

    if (destination !== "amazon" && destination !== "sneakers") {
      return NextResponse.json(
        { error: "Invalid destination selected." },
        { status: 400 }
      );
    }

    const config = webhookConfigs[destination];

    if (!config.webhook) {
      return NextResponse.json(
        { error: "Selected webhook is not configured." },
        { status: 500 }
      );
    }

    const embed: Record<string, unknown> = {
      title: config.title,
      description: `${description}\n\n[${config.buttonText}](${parsedLink.toString()})`,
      color: config.color,
      fields: [
        {
          name: "Price",
          value: `£${price}`,
          inline: true,
        },
      ],
      footer: {
        text: config.footer,
      },
    };

    if (imageUrl) {
      embed.image = { url: imageUrl };
    }

    const discordRes = await fetch(config.webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!discordRes.ok) {
      const errorText = await discordRes.text();
      return NextResponse.json(
        { error: `Discord webhook failed: ${errorText}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Server error while posting to Discord." },
      { status: 500 }
    );
  }
}