import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

type ScrapeResult = {
  asin: string;
  title: string;
  image: string;
  price: string;
  wasPrice: string;
  description: string;
  category: string;
  affiliateLink: string;
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function extractAsin(url: URL): string | null {
  const pathMatch = url.pathname.match(/\/(?:dp|gp\/product|product-reviews)\/([A-Z0-9]{10})/i);
  if (pathMatch) return pathMatch[1].toUpperCase();
  const qpAsin = url.searchParams.get("asin") || url.searchParams.get("ASIN");
  if (qpAsin && /^[A-Z0-9]{10}$/i.test(qpAsin)) return qpAsin.toUpperCase();
  return null;
}

function parsePrice(text: string | undefined | null): string {
  if (!text) return "";
  const match = text.replace(/,/g, "").match(/[\d]+\.?\d*/);
  return match ? match[0] : "";
}

function looksBlocked(html: string): boolean {
  return (
    /Enter the characters you see below/i.test(html) ||
    /Sorry, we just need to make sure you're not a robot/i.test(html) ||
    /To discuss automated access to Amazon data/i.test(html) ||
    /captcha/i.test(html) && /amazon/i.test(html) && html.length < 20000
  );
}

function scrapeFields($: cheerio.CheerioAPI): Omit<ScrapeResult, "asin" | "affiliateLink"> {
  const title = $("#productTitle").first().text().trim();

  let image = $("#landingImage").attr("src") || $("#imgTagWrapperId img").attr("src") || "";
  if (!image) {
    const dynamic = $("#landingImage").attr("data-a-dynamic-image") || $("#imgTagWrapperId img").attr("data-a-dynamic-image");
    if (dynamic) {
      try {
        const parsed = JSON.parse(dynamic);
        const firstKey = Object.keys(parsed)[0];
        if (firstKey) image = firstKey;
      } catch {
        // ignore malformed JSON, image stays empty
      }
    }
  }

  const priceSelectors = [
    "#corePriceDisplay_desktop_feature_div .a-price.priceToPay .a-offscreen",
    "#corePrice_feature_div .a-price .a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-price .a-offscreen",
    ".reinventPricePriceToPayMargin .a-offscreen",
    "#tp_price_block_total_price_ww .a-offscreen",
    "#priceblock_dealprice",
    "#priceblock_ourprice",
    ".a-price.apexPriceToPay .a-offscreen",
  ];
  let price = "";
  for (const sel of priceSelectors) {
    const val = parsePrice($(sel).first().text());
    if (val) { price = val; break; }
  }

  const wasSelectors = [
    "#corePriceDisplay_desktop_feature_div .basisPrice .a-offscreen",
    "span[data-a-strike='true'] .a-offscreen",
    ".a-price.a-text-price .a-offscreen",
    "#priceblock_saleprice_original",
  ];
  let wasPrice = "";
  for (const sel of wasSelectors) {
    const val = parsePrice($(sel).first().text());
    if (val && val !== price) { wasPrice = val; break; }
  }

  // Fallback: some layouts (grocery, deals, regional experiments) don't match any
  // known selector — scan the price containers directly for £ amounts in order.
  // (script/style tags are stripped by the caller before this runs, so this can't
  // pick up embedded JSON/CSS price data from other variants.)
  if (!price) {
    const priceArea = $("#corePriceDisplay_desktop_feature_div, #corePrice_feature_div, #apex_desktop, #centerCol").first().text();
    const matches = [...priceArea.matchAll(/£\s?[\d,]+\.\d{2}/g)].map((m) => parsePrice(m[0]));
    const unique = [...new Set(matches.filter(Boolean))];
    if (unique.length) {
      price = unique[0];
      if (!wasPrice && unique.length > 1) wasPrice = unique[1];
    }
  }

  // Subscribe & Save price, if the listing offers one — this is the better deal to
  // advertise, so it takes priority over the standard one-off price when present.
  const snsPrice = parsePrice($("#sns-base-price .a-offscreen").first().text());
  if (snsPrice) {
    if (!wasPrice && price && price !== snsPrice) wasPrice = price;
    price = snsPrice;
  }

  // Multi-buy / voucher promotions (e.g. "Get 3 for the price of 2", "Save 5% on any 4")
  // shown on the listing — used as the short description instead of a generic bullet,
  // since the product itself is already conveyed by the title + image.
  const promoLines: string[] = [];
  $('span[id^="promoMessagepctch"]').each((_, el) => {
    const $el = $(el);
    const hash = ($el.attr("id") || "").replace("promoMessagepctch", "");
    const badgeText = $(`#greenBadgepctch${hash}`).text().trim();
    const msgText = $el.clone().find("a").remove().end().text().trim().replace(/\s+/g, " ").replace(/\s*\|\s*$/, "");
    if (!msgText) return;
    const line = badgeText && badgeText.toLowerCase() !== "savings" ? `${badgeText} ${msgText}` : msgText;
    promoLines.push(line);
  });
  const description = [...new Set(promoLines)].join(" • ");

  const crumbs = $("#wayfinding-breadcrumbs_feature_div ul li a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((text) => text.length > 0);
  const category = crumbs.length ? crumbs[crumbs.length - 1] : "";

  return { title, image, price, wasPrice, description, category };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = (body?.url as string) || "";
    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: "Missing Amazon URL." }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return NextResponse.json({ ok: false, error: "That doesn't look like a valid URL." }, { status: 400 });
    }

    if (!/(^|\.)amazon\.[a-z.]+$/i.test(url.hostname)) {
      return NextResponse.json({ ok: false, error: "That doesn't look like an Amazon URL." }, { status: 400 });
    }

    const asin = extractAsin(url);
    if (!asin) {
      return NextResponse.json({ ok: false, error: "Couldn't find a product ID (ASIN) in that URL." }, { status: 400 });
    }

    const fetchUrl = `https://${url.hostname}/dp/${asin}`;
    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
      redirect: "follow",
    });

    if (res.status === 503 || res.status === 429) {
      return NextResponse.json(
        { ok: false, error: "Amazon blocked this request (rate limited / bot detection). Please fill the fields in manually." },
        { status: 502 }
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Amazon returned an error (${res.status}). Please fill the fields in manually.` },
        { status: 502 }
      );
    }

    const html = await res.text();
    if (looksBlocked(html)) {
      return NextResponse.json(
        { ok: false, error: "Amazon blocked this request (bot detection). Please fill the fields in manually." },
        { status: 502 }
      );
    }

    const $ = cheerio.load(html);
    // Strip script/style so text-based extraction (price fallback scan, promo text)
    // can't pick up embedded JSON state or inline CSS content.
    $("script, style").remove();
    const fields = scrapeFields($);

    if (!fields.title && !fields.price) {
      return NextResponse.json(
        { ok: false, error: "Couldn't read this product page — Amazon's layout may have changed or the request was blocked. Please fill the fields in manually." },
        { status: 502 }
      );
    }

    const tag = process.env.AMAZON_ASSOCIATE_TAG || "";
    const affiliateUrl = new URL(`https://${url.hostname}/dp/${asin}`);
    if (tag) affiliateUrl.searchParams.set("tag", tag);

    const result: ScrapeResult = {
      asin,
      ...fields,
      affiliateLink: affiliateUrl.toString(),
    };

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Server error while scraping." }, { status: 500 });
  }
}
