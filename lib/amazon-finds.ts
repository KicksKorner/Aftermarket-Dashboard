// "Amazon Finds" posts: Lewis shares a find from his Flip Finder in one fixed
// layout. Deliberately no AI — the wording is his, the numbers are what he
// typed, and the profit is plain resell minus buy (before fees, which the
// closing line tells members to factor in).

export type AmazonFindInput = {
  name?: string;
  amazon?: string; // an Amazon link (any form) or a bare ASIN
  buy?: string | number;
  resell?: string | number;
  soldUrl?: string;
  emoji?: string;
  notes?: string; // Lewis's own words, posted as-is under "Notes from Kicks"
};

// Same tag the rest of his tooling uses (AMAZON_ASSOCIATE_TAG). A tag already
// on a pasted link — e.g. the Flip Finder's "Copy affiliate link" — wins.
const DEFAULT_TAG = "bargainsniper-21";
const DEFAULT_EMOJI = "🛍️";

const ASIN_IN_URL = /\/(?:dp|gp\/product|gp\/aw\/d|product)\/([A-Z0-9]{10})(?:[/?#]|$)/i;
const BARE_ASIN = /^[A-Z0-9]{10}$/i;

function price(v: string | number | undefined): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const m = String(v ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

const money = (n: number) => `£${n.toFixed(2)}`;

// Rebuilt from just the ASIN plus the tag: only `tag` decides who's credited.
function amazonLink(input: string): { url: string } | { error: string } {
  const s = input.trim();
  const asin = (s.match(ASIN_IN_URL) || [])[1] || (BARE_ASIN.test(s) ? s : null);
  if (!asin) return { error: "Couldn't find the product in that Amazon link — paste the full amazon.co.uk link or the ASIN." };
  let tag = DEFAULT_TAG;
  try {
    tag = new URL(s).searchParams.get("tag") || DEFAULT_TAG;
  } catch {
    // a bare ASIN, not a URL
  }
  return { url: `https://www.amazon.co.uk/dp/${asin.toUpperCase()}?tag=${encodeURIComponent(tag)}` };
}

export function buildAmazonFind(f: AmazonFindInput): { title: string; description: string } | { error: string } {
  const name = String(f.name ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { error: "Add the product name." };

  const link = amazonLink(String(f.amazon ?? ""));
  if ("error" in link) return link;

  const buy = price(f.buy);
  const resell = price(f.resell);
  if (buy == null || buy <= 0) return { error: "Add the buy price." };
  if (resell == null || resell <= 0) return { error: "Add the resell price." };
  if (resell <= buy) return { error: `The resell price (${money(resell)}) needs to be higher than the buy price (${money(buy)}).` };

  const sold = String(f.soldUrl ?? "").trim();
  if (!/^https:\/\/(?:www\.)?ebay\.(?:co\.uk|com)\//i.test(sold)) return { error: "Add the eBay sold-listings link (https://www.ebay.co.uk/...)." };

  // "Around": eBay solds are a range, so a whole-pound figure is as precise
  // as it's honest to be.
  const profit = resell - buy;
  const profitText = profit < 1 ? "under £1" : `around £${Math.floor(profit)}`;

  // Optional notes go in exactly as written: one line sits beside the
  // heading, several start on the line below it.
  const notes = String(f.notes ?? "").replace(/\r\n/g, "\n").trim().slice(0, 1500);
  const notesBlock = !notes ? [] : notes.includes("\n") ? ["📝 **Notes from Kicks:**", notes] : [`📝 **Notes from Kicks:** ${notes}`];

  const emoji = String(f.emoji ?? "").trim() || DEFAULT_EMOJI;
  return {
    title: `${emoji} ${name}`.slice(0, 256),
    description: [
      `🛒 **Retail:** ${money(buy)} – [Amazon](${link.url})`,
      `🏷️ **Resell:** ${money(resell)} – [eBay solds](${sold})`,
      `💷 **Profit:** ${profitText}, *it seems*, based on eBay solds`,
      ...notesBlock,
      "*Check the eBay solds yourself, factor in fees and make your own judgement before buying.*",
    ].join("\n"),
  };
}
