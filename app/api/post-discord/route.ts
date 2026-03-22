import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { TwitterApi } from "twitter-api-v2";

function formatPrice(price: string | number) {
  const num = Number(price || 0);
  return `£${num.toFixed(2)}`;
}

function makeXText(description: string, price: string, link: string) {
  let text = `🚨 ${description}\n£${price}\n${link}`;

  if (text.length > 280) {
    text = text.slice(0, 277) + "...";
  }

  return text;
}

function makeFacebookMessage(description: string, price: string, link: string) {
  return `🚨 Deal Alert

${description}
Price: £${price}

Grab it here: ${link}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      destination = "amazon",
      description,
      price,
      link,
      imageUrl,
      postToDiscord = true,
      postToX = true,
      postToFacebook = false,
    } = body;

    if (!description || !price || !link) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const results: any = {};
    const errors: any = {};

    // ======================
    // DISCORD
    // ======================
    if (postToDiscord) {
      try {
        const webhook = process.env.DISCORD_WEBHOOK_AMAZON;

        await axios.post(webhook!, {
          embeds: [
            {
              title: "Amazon STEAL! Alert 🚨",
              description,
              url: link,
              color: 3447003,
              fields: [
                {
                  name: "Price",
                  value: formatPrice(price),
                  inline: true,
                },
              ],
              image: imageUrl ? { url: imageUrl } : undefined,
              footer: {
                text: "Bargain Sniper UK • Deals",
              },
            },
          ],
        });

        results.discord = true;
      } catch (err: any) {
        errors.discord = err.message;
      }
    }

    // ======================
    // X (Twitter)
    // ======================
    if (postToX) {
      try {
        const client = new TwitterApi({
          appKey: process.env.X_APP_KEY!,
          appSecret: process.env.X_APP_SECRET!,
          accessToken: process.env.X_ACCESS_TOKEN!,
          accessSecret: process.env.X_ACCESS_SECRET!,
        });

        const text = makeXText(description, price, link);

        const tweet = await client.v2.tweet(text);

        results.x = tweet.data;
      } catch (err: any) {
        errors.x = err.message;
      }
    }

    // ======================
    // FACEBOOK
    // ======================
    if (postToFacebook) {
      try {
        const pageId = process.env.FACEBOOK_PAGE_ID;
        const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

        const message = makeFacebookMessage(description, price, link);

        const response = await axios.post(
          `https://graph.facebook.com/v23.0/${pageId}/feed`,
          new URLSearchParams({
            message,
            link,
            access_token: token!,
          }),
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        results.facebook = response.data;
      } catch (err: any) {
        errors.facebook = err.message;
      }
    }

    return NextResponse.json({
      ok: Object.keys(errors).length === 0,
      results,
      errors,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}