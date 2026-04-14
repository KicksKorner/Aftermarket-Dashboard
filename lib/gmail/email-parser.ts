export type ParsedItem = {
  item_name: string;
  quantity: number;
  unit_price_gbp: number | null;
};

export type ParsedOrder = {
  retailer: string;
  order_number: string | null;
  order_date: string | null;
  order_total_gbp: number | null;
  items: ParsedItem[];
};

const RETAILER_PATTERNS: { name: string; patterns: RegExp[] }[] = [
  { name: "Nike", patterns: [/nike\.com/i, /from.*nike/i, /noreply.*nike/i] },
  { name: "ASOS", patterns: [/asos\.com/i, /from.*asos/i] },
  { name: "JD Sports", patterns: [/jdsports\.co\.uk/i, /jd sports/i] },
  { name: "Footasylum", patterns: [/footasylum\.com/i] },
  { name: "Size?", patterns: [/size\.co\.uk/i] },
  { name: "End Clothing", patterns: [/endclothing\.com/i] },
  { name: "Pokémon Center", patterns: [/pokemoncenter\.com/i, /pokemon.*cent/i] },
  { name: "Amazon", patterns: [/amazon\.co\.uk/i, /amazon\.com/i] },
  { name: "eBay", patterns: [/ebay\.co\.uk/i, /ebay\.com/i] },
  { name: "Palace", patterns: [/palaceskateboards\.com/i, /from.*palace/i, /palace.*order/i] },
  { name: "Supreme", patterns: [/supremenewyork\.com/i] },
  { name: "GOAT", patterns: [/goat\.com/i] },
  { name: "StockX", patterns: [/stockx\.com/i] },
  { name: "Footlocker", patterns: [/footlocker\.co\.uk/i] },
  { name: "Sports Direct", patterns: [/sportsdirect\.com/i] },
  { name: "Zalando", patterns: [/zalando\.co\.uk/i] },
  { name: "Depop", patterns: [/depop\.com/i] },
  { name: "Vinted", patterns: [/vinted\.co\.uk/i, /vinted\.com/i] },
  { name: "Farfetch", patterns: [/farfetch\.com/i] },
  { name: "SSENSE", patterns: [/ssense\.com/i] },
  { name: "Solebox", patterns: [/solebox\.com/i] },
  { name: "Sneakersnstuff", patterns: [/sneakersnstuff\.com/i] },
  { name: "Offspring", patterns: [/offspring\.co\.uk/i] },
  { name: "Flannels", patterns: [/flannels\.com/i] },
  { name: "Harvey Nichols", patterns: [/harveynichols\.com/i] },
  { name: "Selfridges", patterns: [/selfridges\.com/i] },
  { name: "John Lewis", patterns: [/johnlewis\.com/i] },
  { name: "Next", patterns: [/next\.co\.uk/i] },
  { name: "Argos", patterns: [/argos\.co\.uk/i] },
  { name: "Currys", patterns: [/currys\.co\.uk/i] },
  { name: "GAME", patterns: [/game\.co\.uk/i] },
];

// Words that indicate a line is NOT a product name
const JUNK_NAME_PATTERNS = [
  /^(gbp|usd|eur|total|subtotal|shipping|delivery|postage|discount|vat|tax|fee|saving|you saved|promo|code)$/i,
  /^(order|payment|invoice|receipt|thank|dear|hi|hello|regards|team|support|customer)$/i,
  /^[\d\s£$.,%-]+$/, // Pure numbers/currency
  /^[A-Z]{2,4}$/, // Currency codes like GBP, USD
  /^(qty|quantity|price|amount|item|product|description|size|colour|color)$/i,
  /unsubscribe|privacy|copyright|terms|contact|follow|track|view.*online/i,
  /^(free|express|standard|next day|click.*collect)/i,
  /^\s*[-–—]\s*$/, // Just dashes
];

const ORDER_SUBJECT_PATTERNS = [
  /order.*confirm/i,
  /confirm.*order/i,
  /your order/i,
  /order.*placed/i,
  /order.*received/i,
  /purchase.*confirm/i,
  /thank.*for.*order/i,
  /order.*thank/i,
  /order.*success/i,
  /order #/i,
  /order number/i,
  /your.*receipt/i,
  /payment.*confirm/i,
];

export function isOrderEmail(subject: string, _from: string, _body: string): boolean {
  return ORDER_SUBJECT_PATTERNS.some((p) => p.test(subject));
}

export function detectRetailer(subject: string, from: string, body: string): string {
  const text = `${subject} ${from} ${body}`;
  for (const retailer of RETAILER_PATTERNS) {
    if (retailer.patterns.some((p) => p.test(text))) return retailer.name;
  }
  const domainMatch = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (domainMatch) {
    const domain = domainMatch[1]
      .replace(/^(mail\.|email\.|noreply\.|orders\.|hello\.)/, "")
      .replace(/\.(com|co\.uk|net|org|io)$/, "");
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  return "Unknown Retailer";
}

export function extractOrderNumber(subject: string, body: string): string | null {
  const patterns = [
    /order\s*(?:#|number|no\.?|num\.?|ref\.?)\s*:?\s*([A-Z0-9-]{4,25})/i,
    /#\s*([A-Z0-9-]{5,20})/i,
    /(?:order|ref|reference)[:\s]+([A-Z0-9-]{5,20})/i,
  ];
  for (const p of patterns) {
    const m = `${subject} ${body}`.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return null;
}

export function extractOrderTotal(body: string): number | null {
  const patterns = [
    /(?:order total|total|amount charged|grand total|you paid|total paid)[:\s]*£\s*(\d[\d,]*\.?\d*)/i,
    /(?:total)[:\s]+£(\d[\d,]*\.?\d*)/i,
    /£\s*(\d[\d,]*\.\d{2})\s*(?:total|charged|paid)/i,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) return parseFloat(m[1].replace(/,/g, ""));
  }
  return null;
}

export function extractOrderDate(body: string, receivedDate: string): string {
  const patterns = [
    /(?:placed on|order date|date)[:\s]+(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{2,4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  for (const p of patterns) {
    const m = body.match(p);
    if (m) {
      try {
        const d = new Date(m[1]);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      } catch { /* continue */ }
    }
  }
  try {
    return new Date(receivedDate).toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function isJunkName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 4) return true;
  if (trimmed.length > 150) return true;
  return JUNK_NAME_PATTERNS.some((p) => p.test(trimmed));
}

export function extractItems(body: string, orderTotal: number | null, retailer: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const lines = body.split(/\n|\r/).map((l) => l.trim()).filter((l) => l.length > 0);

  // Strategy 1: Look for lines with a price that look like product lines
  for (const line of lines) {
    if (line.length < 4 || line.length > 200) continue;

    // Skip obvious non-product lines
    if (/unsubscribe|privacy|copyright|terms|contact|follow|track.*order|view.*email/i.test(line)) continue;
    if (/^(shipping|delivery|postage|subtotal|total|discount|vat|tax|promo|saving)/i.test(line)) continue;

    const priceMatch = line.match(/£\s*(\d[\d,]*\.?\d*)/);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (price <= 0 || price > 5000) continue;

    // Don't use lines where the price looks like the order total
    if (orderTotal && Math.abs(price - orderTotal) < 0.01) continue;

    // Extract name — everything before the price, cleaned up
    let name = line
      .replace(/£\s*\d[\d,]*\.?\d*/g, "")
      .replace(/\s*x\s*\d+\s*$/, "")
      .replace(/^\s*\d+\s*x\s*/i, "")
      .replace(/\s+/g, " ")
      .trim();

    // Extract quantity
    const qtyMatch = line.match(/\b(\d+)\s*x\b/i) ?? line.match(/^(\d+)\s/);
    const qty = qtyMatch ? Math.min(parseInt(qtyMatch[1]), 99) : 1;

    if (isJunkName(name)) continue;

    items.push({ item_name: name, quantity: qty, unit_price_gbp: price });
  }

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const key = item.item_name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length > 0) return unique.slice(0, 15);

  // Strategy 2: If no items found, return empty so the UI shows "1 item" placeholder
  // that the member can edit — better than creating wrong items
  return [];
}

export function parseEmail(params: {
  subject: string;
  from: string;
  body: string;
  receivedDate: string;
}): ParsedOrder {
  const { subject, from, body, receivedDate } = params;
  const retailer = detectRetailer(subject, from, body);
  const orderNumber = extractOrderNumber(subject, body);
  const orderTotal = extractOrderTotal(body);
  const orderDate = extractOrderDate(body, receivedDate);
  const items = extractItems(body, orderTotal, retailer);

  return { retailer, order_number: orderNumber, order_date: orderDate, order_total_gbp: orderTotal, items };
}
