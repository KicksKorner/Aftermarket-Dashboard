// Every Amazon link in a Deal Formatter post is rebuilt as a clean
// amazon.co.uk/dp/ASIN link — whatever tag the pasted link had — and a bare
// link is shown as a short "Buy on Amazon" link instead of the URL.
// The preview staff see is cleaned but untagged: Lewis's Associates tag goes
// on only in /api/admin/send-deal, on the server, as the post leaves for
// Discord, so the tag never reaches anyone's browser.

export const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || "bargainsniper-21";

// No "As an Amazon Associate…" line: Lewis checked with Amazon that posts to
// his private server don't need it (2026-11-04). Public posts would.

const LINK_TEXT = "Buy on Amazon";

const AMAZON_HOST = /^(?:www\.|smile\.|m\.)?amazon\.co\.uk$/i;
const SHORT_HOST = /^(?:amzn\.to|amzn\.eu|a\.co)$/i;
const ASIN_IN_PATH = /\/(?:dp|gp\/product|gp\/aw\/d|product|exec\/obidos\/ASIN)\/([A-Z0-9]{10})(?:[/?#]|$)/i;

// A markdown link, a <bracketed> link or a bare link, in that order.
const LINK = /\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)|<(https?:\/\/[^\s>]+)>|(https?:\/\/[^\s<>()[\]]+)/gi;

// Affiliate and tracking parameters dropped from non-product Amazon links, so
// no one else's ID rides along.
const TRACKING_PARAMS = ["tag", "ascsubtag", "linkCode", "linkId", "ref_", "creative", "creativeASIN", "camp", "psc", "th"];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// A bare link in a sentence often ends in punctuation that isn't part of it.
function splitTrailing(url: string): { url: string; tail: string } {
  const m = url.match(/[.,!?;:'"]+$/);
  return m ? { url: url.slice(0, -m[0].length), tail: m[0] } : { url, tail: "" };
}

function amazonUrl(raw: string, resolved: Map<string, string>, withTag: boolean): string | null {
  let url: URL;
  try {
    url = new URL(resolved.get(raw) ?? raw);
  } catch {
    return null;
  }
  if (!AMAZON_HOST.test(url.hostname)) return null;

  const asin = url.pathname.match(ASIN_IN_PATH)?.[1]?.toUpperCase();
  if (asin) {
    const clean = `https://www.amazon.co.uk/dp/${asin}`;
    return withTag ? `${clean}?tag=${encodeURIComponent(AMAZON_TAG)}` : clean;
  }

  // Not a product page (a search, a storefront): keep it, minus anyone's tag.
  for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
  if (withTag) url.searchParams.set("tag", AMAZON_TAG);
  url.hostname = "www.amazon.co.uk";
  return url.toString();
}

function amazonText(text: string, resolved: Map<string, string>, withTag: boolean): string {
  return text.replace(LINK, (whole, label: string | undefined, mdUrl: string | undefined, angleUrl: string | undefined, bareUrl: string | undefined) => {
    if (mdUrl) {
      const url = amazonUrl(mdUrl, resolved, withTag);
      return url ? `[${label}](${url})` : whole;
    }
    const { url: link, tail } = angleUrl ? { url: angleUrl, tail: "" } : splitTrailing(bareUrl ?? "");
    const url = amazonUrl(link, resolved, withTag);
    return url ? `[${LINK_TEXT}](${url})${tail}` : whole;
  });
}

// amzn.to / amzn.eu / a.co links hide the product (and someone's tag) behind a
// redirect; follow it to get the ASIN. One that can't be resolved is left as is.
async function followToAmazon(start: string): Promise<string | null> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(4000) });
      const location = res.headers.get("location");
      if (!location) return null;
      url = new URL(location, url).toString();
      if (AMAZON_HOST.test(hostOf(url))) return url;
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveShortLinks(texts: string[]): Promise<Map<string, string>> {
  const shorts = new Set<string>();
  for (const text of texts) {
    for (const m of text.matchAll(LINK)) {
      const raw = m[2] ?? m[3] ?? splitTrailing(m[4] ?? "").url;
      if (raw && SHORT_HOST.test(hostOf(raw))) shorts.add(raw);
    }
  }
  const resolved = new Map<string, string>();
  await Promise.all(
    [...shorts].map(async (s) => {
      const target = await followToAmazon(s);
      if (target) resolved.set(s, target);
    }),
  );
  return resolved;
}

type Embed = {
  title?: string;
  description?: string;
  url?: string;
  footer?: { text?: string };
  fields?: { name?: string; value?: string }[];
  [key: string]: unknown;
};

export type PostPayload = { content?: string; embeds?: Embed[]; [key: string]: unknown };

// A copy of the post with its Amazon links cleaned, and tagged when withTag
// is set (send-deal only; the preview is built without it).
export async function amazonPayload<T extends PostPayload>(payload: T, { withTag }: { withTag: boolean }): Promise<T> {
  const out: T = JSON.parse(JSON.stringify(payload));
  const embeds = out.embeds ?? [];
  const texts = embeds.flatMap((e) => [e.description ?? "", e.url ?? "", ...(e.fields ?? []).map((f) => f.value ?? "")]);
  const resolved = await resolveShortLinks(texts);

  for (const e of embeds) {
    if (e.description) e.description = amazonText(e.description, resolved, withTag);
    for (const f of e.fields ?? []) if (f.value) f.value = amazonText(f.value, resolved, withTag);
    if (e.url) e.url = amazonUrl(e.url, resolved, withTag) ?? e.url;
  }

  return out;
}
