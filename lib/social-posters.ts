import axios from "axios";
import { TwitterApi } from "twitter-api-v2";

export type DealPayload = {
  destination?: string;
  destinationLabel?: string;
  description: string;
  price: string | number;
  dealLink: string;
  imageUrl?: string;
  postToDiscord?: boolean;
  postToX?: boolean;
  postToFacebook?: boolean;
  priority?: string;
};

const PRIORITY_CONFIG: Record<string, { label: string; color: number }> = {
  instant_cop:      { label: "⚡ INSTANT COP",      color: 0xef4444 },
  profitable:       { label: "💰 PROFITABLE",        color: 0x22c55e },
  personal_bargain: { label: "🛒 PERSONAL BARGAIN",  color: 0x3b82f6 },
};

function formatPrice(price: string | number) {
  const num = Number(price || 0);
  return `£${num.toFixed(2)}`;
}

function getDiscordWebhook(destination?: string) {
  switch ((destination || "").toLowerCase()) {
    case "amazon":
    default:
      return process.env.DISCORD_WEBHOOK_AMAZON;
  }
}

function makeDiscordPayload(deal: DealPayload) {
  const priority = PRIORITY_CONFIG[deal.priority || "instant_cop"] ?? PRIORITY_CONFIG.instant_cop;
  return {
    embeds: [
      {
        title: `${deal.destinationLabel || "Deal"} STEAL! Alert 🚨`,
        description: deal.description,
        url: deal.dealLink,
        color: priority.color,
        fields: [
          {
            name: "Priority",
            value: priority.label,
            inline: false,
          },
          {
            name: "Price",
            value: formatPrice(deal.price),
            inline: true,
          },
        ],
        image: deal.imageUrl ? { url: deal.imageUrl } : undefined,
        footer: {
          text: `Bargain Sniper UK • ${deal.destinationLabel || "Deals"}`,
        },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "View Deal",
            url: deal.dealLink,
          },
        ],
      },
    ],
  };
}

function makeXText(deal: DealPayload) {
  const price = formatPrice(deal.price);
  const description = (deal.description || "").trim();
  const link = (deal.dealLink || "").trim();

  let text = `🚨 ${description}\n${price}\n${link}`;

  if (text.length > 280) {
    const reserve = price.length + link.length + 6;
    const maxDesc = 280 - reserve;
    const shortDesc =
      description.length > maxDesc
        ? description.slice(0, Math.max(0, maxDesc - 1)).trim() + "…"
        : description;

    text = `🚨 ${shortDesc}\n${price}\n${link}`;
  }

  return text;
}

function makeFacebookMessage(deal: DealPayload) {
  return [
    `🚨 ${deal.destinationLabel || "Deal"} Alert`,
    "",
    deal.description,
    `Price: ${formatPrice(deal.price)}`,
    "",
    `Grab it here: ${deal.dealLink}`,
  ].join("\n");
}

export async function postToDiscord(deal: DealPayload) {
  const webhookUrl = getDiscordWebhook(deal.destination);

  if (!webhookUrl) {
    throw new Error("Missing Discord webhook");
  }

  const payload = makeDiscordPayload(deal);
  await axios.post(webhookUrl, payload);
  return { ok: true };
}

export async function postToX(deal: DealPayload) {
  const client = new TwitterApi({
    appKey: process.env.X_APP_KEY || "",
    appSecret: process.env.X_APP_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  });

  const text = makeXText(deal);
  const response = await client.v2.tweet({ text });

  return {
    ok: true,
    tweetId: response?.data?.id || null,
  };
}

export async function postToFacebook(deal: DealPayload) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const version = process.env.FACEBOOK_GRAPH_VERSION || "v23.0";

  if (!pageId || !accessToken) {
    throw new Error("Missing Facebook page credentials");
  }

  const endpoint = `https://graph.facebook.com/${version}/${pageId}/feed`;

  const payload = new URLSearchParams({
    message: makeFacebookMessage(deal),
    link: deal.dealLink,
    access_token: accessToken,
  });

  const response = await axios.post(endpoint, payload, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  return {
    ok: true,
    postId: response?.data?.id || null,
  };
}