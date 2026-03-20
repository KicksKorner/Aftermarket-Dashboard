import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { description, price, link, imageUrl } = await req.json();

    if (!description || !price || !link) {
      return NextResponse.json(
        { error: "Description, price and link are required." },
        { status: 400 }
      );
    }

    const embed: Record<string, any> = {
      title: "STEAL! 🚨",
      description: `${description}\n\n[View Deal](${link})`,
      color: 0x2563eb,
      fields: [
        {
          name: "Price",
          value: `£${price}`,
          inline: true,
        },
      ],
      footer: {
        text: "Bargain Sniper UK",
      },
    };

    if (imageUrl) {
      embed.image = {
        url: imageUrl,
      };
    }

    const discordRes = await fetch(process.env.DISCORD_WEBHOOK_URL as string, {
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