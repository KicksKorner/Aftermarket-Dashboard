import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { findHype, stripHype } from "@/lib/hype-guard";

const MEMBER_ROLE_ID = "726446805667020892";

// Channel IDs keep their old names: kicks_flips is shown as "flips", pokemon_flips as "pokemon-info".
const CHANNEL_CONTEXT: Record<string, string> = {
  kicks_flips:         "Profitable flip opportunities for resellers",
  sneaker_streetwear:  "Sneaker and streetwear reselling deals",
  pokemon_flips:       "Pokémon news, restocks, release info and flip opportunities",
  brick_flips:         "LEGO and brick set flip opportunities",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  detailed: `Create a detailed embed with:
- A clear title with a relevant emoji
- Description with sections for: time/date (if given), links (if given), pricing breakdown (retail/resell/profit — only figures from the notes), why it could flip (only reasons the notes give), and risks (what the notes say could go wrong; don't rate the risk yourself)
- Use bold text (**text**) for key numbers
- Use section dividers: ──────────────────────
- Include emoji to match the Discord aesthetic`,

  quick: `Create a short embed:
- Bold title with emoji
- 4-6 lines max in description — just the key facts
- Retail, resell, profit on separate lines (only figures from the notes)
- One line on why it's worth a look, only if the notes say why
- No long sections`,

  restock: `Create an in-store restock alert embed:
- Title like "🛒 [Store] [Product] Restock"
- Description with store locator link if provided
- Individual product blocks with EAN/SKU/PID in code blocks (\`value\`)
- Retail and resale per item (only figures given in the notes)
- Any notes about delivery timings or store behaviour`,

  info: `Create a clean information/update embed. This style is FACTS ONLY:
- Use ONLY what is in the raw input. Do not add prices, resale estimates, profit, opinions, predictions, advice, links or any other detail that isn't there
- Keep every fact: every date, product, price, code, store and number must appear, with the same meaning
- Keep items grouped exactly as given (e.g. which products ship on which date) — never drop, merge or move items
- Keep product and store names as written
- You may fix spelling and grammar, write dates out readably (e.g. "9th Fri Oct" → "Friday 9th October") and use bold, bullet points and line breaks so it's easy to scan
- Do not add a year unless one is given
- Title: short and factual with one relevant emoji (e.g. "📦 PKC Ship Date Update")
- Keep the description short — no intro or outro lines that repeat the facts`,
};

const COLOR_MAP: Record<string, number> = {
  kicks_flips:         5763719,
  sneaker_streetwear:  1752220,
  pokemon_flips:       16766720,
  brick_flips:         15105570,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { raw, channel, style, imageUrl } = await req.json();
  if (!raw?.trim()) return NextResponse.json({ error: "No input provided" }, { status: 400 });

  const channelCtx    = CHANNEL_CONTEXT[channel] || "general reselling deals";
  const styleInstr    = STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.detailed;
  const embedColor    = COLOR_MAP[channel] || 5763719;

  // Members spend their own money on these posts. The old "exciting — act
  // immediately" tone line produced "don't sleep on this one!" on deals Lewis
  // was cautious about, so the wording rules below replace it, and every
  // output is checked against lib/hype-guard.ts afterwards.
  const systemPrompt = `You are a Discord content writer for Aftermarket Arbitrage, a UK reselling community.
Turn raw deal notes into a Discord embed post.

Channel: ${channelCtx}

${styleInstr}

WORDING — members spend their own money on these posts, so they must be accurate:
- Only claim what the raw notes support. Don't invent demand, scarcity, sell-out risk, time pressure, profit certainty or a risk level.
- No hype, urgency or FOMO lines unless the notes themselves use them — e.g. "don't sleep on this", "don't miss out", "act fast", "won't last", "selling fast", "no-brainer", "easy money", "guaranteed", "low risk", "huge profit", "must cop", "absolute steal", "high demand", "limited stock".
- If the notes sound cautious or unsure (thin margins, "check sold first", "risky", "not sure"), keep that caution clearly in the post — never soften it.
- Let the numbers speak. Clear, friendly and confident is fine; salesy is not.

FORMAT:
- The description uses Discord markdown (**bold**, *italic*, \`code\`, [link](url)) with real line breaks.
- UK context: £ not $, "retail" not "MSRP", British spelling.
- EANs/SKUs/PIDs go in code blocks.
- Vary the layout and emoji between posts so they don't look templated.

Reply with only a JSON object — no markdown fences, no other text:
{"title": "...", "description": "..."}`;

  const userMessage = { role: "user", content: `Raw notes:\n\n${raw}` };

  const first = await callClaude(systemPrompt, [userMessage]);
  if (!first.ok) return NextResponse.json({ error: first.error }, { status: 500 });
  let embed = parseEmbed(first.text);
  if (!embed) {
    console.error("JSON parse error, raw text:", first.text.substring(0, 500));
    return NextResponse.json({ error: "Could not parse AI response. Try again." }, { status: 500 });
  }

  // Wording Lewis didn't write: ask once for a rewrite without it.
  let rewrote = false;
  const hits = findHype(`${embed.title}\n${embed.description}`, raw);
  if (hits.length) {
    const phrases = [...new Set(hits.map((h) => `"${h.phrase}"`))].join(", ");
    const second = await callClaude(systemPrompt, [
      userMessage,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content:
          `That draft adds wording that isn't in my notes: ${phrases}. Rewrite it without those phrases or anything that means the same ` +
          `(no urgency, hype, scarcity or profit promises unless my notes say so). Keep every fact and the layout. Reply with only the JSON object.`,
      },
    ]);
    const retry = second.ok ? parseEmbed(second.text) : null;
    if (retry) {
      embed = retry;
      rewrote = true;
    }
  }

  // Still there after the rewrite (or the rewrite failed): cut the sentences.
  const removed = stripHype(embed, raw);

  const payload = {
    content: `<@&${MEMBER_ROLE_ID}>`,
    embeds: [{
      title: embed.title.slice(0, 256),
      description: embed.description.slice(0, 4096),
      color: embedColor,
      footer: { text: "Aftermarket Arbitrage | 2026" },
      timestamp: new Date().toISOString(),
      ...(imageUrl ? { image: { url: imageUrl } } : {}),
    }],
  };
  return NextResponse.json({ payload, rewrote, removed });
}

type ClaudeResult = { ok: true; text: string; content: unknown[] } | { ok: false; error: string };

async function callClaude(system: string, messages: { role: string; content: unknown }[]): Promise<ClaudeResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, system, messages }),
  });
  if (!res.ok) {
    console.error("Claude API error:", await res.text());
    return { ok: false, error: "AI formatting failed" };
  }
  const data = await res.json();
  if (data.stop_reason === "refusal") return { ok: false, error: "Claude declined to format this. Try rewording the notes." };
  const content: { type: string; text?: string }[] = data.content || [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text || "").join("");
  return { ok: true, text, content };
}

// The reply should be a bare JSON object, but tolerate fences or a stray line
// around it by taking the outermost {...}.
function parseEmbed(text: string): { title: string; description: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    // Older-format replies wrap the post in embeds[0].
    const e = obj?.embeds?.[0] ?? obj;
    if (typeof e?.title !== "string" || typeof e?.description !== "string") return null;
    return { title: e.title, description: e.description };
  } catch {
    return null;
  }
}
