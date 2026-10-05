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
- The description uses Discord markdown (**bold**, *italic*, \`code\`, [link](url)). Inside the JSON, write each line break as \\n — the reply must be valid JSON.
- UK context: £ not $, "retail" not "MSRP", British spelling.
- EANs/SKUs/PIDs go in code blocks.
- Vary the layout and emoji between posts so they don't look templated.

Reply with only a JSON object — no markdown fences, no other text:
{"title": "...", "description": "..."}`;

  const userMessage = { role: "user", content: `Raw notes:\n\n${raw}` };

  const startedAt = Date.now();
  const first = await callClaude(systemPrompt, [userMessage]);
  if (!first.ok) return NextResponse.json({ error: first.error, detail: first.detail }, { status: 500 });
  let embed = parseEmbed(first.text);
  if (!embed) {
    console.error("JSON parse error, raw text:", first.text.substring(0, 500));
    // Show what came back, so a screenshot of the error says why.
    return NextResponse.json(
      { error: "Could not parse AI response. Try again.", detail: `${first.engine.model} replied: ${first.text.slice(0, 300) || "(nothing)"}` },
      { status: 500 },
    );
  }

  // Wording Lewis didn't write: ask once for a rewrite without it.
  let rewrote = false;
  const hits = findHype(`${embed.title}\n${embed.description}`, raw);
  // A second model call doubles the wait; if the first was already slow,
  // skip it and let stripHype cut the sentences instead, so the request
  // stays inside the serverless function's time limit.
  const timeForRewrite = Date.now() - startedAt < REWRITE_IF_FIRST_UNDER_MS;
  if (hits.length && timeForRewrite) {
    const phrases = [...new Set(hits.map((h) => `"${h.phrase}"`))].join(", ");
    // Same model as the draft, with its reply echoed back unchanged (thinking
    // blocks included — the current models reject an edited history).
    const second = await callClaude(systemPrompt, [
      userMessage,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content:
          `That draft adds wording that isn't in my notes: ${phrases}. Rewrite it without those phrases or anything that means the same ` +
          `(no urgency, hype, scarcity or profit promises unless my notes say so). Keep every fact and the layout. Reply with only the JSON object.`,
      },
    ], first.engine);
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

// The post is exactly a title and a description; structured outputs make the
// API return valid JSON in that shape, so a reply can't fail to parse. (Quick
// Hit kept failing to parse as free-text JSON on Sonnet 4.6, which doesn't
// support structured outputs — hence the move to Opus 5.5.)
const EMBED_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Embed title, under 256 characters" },
    description: { type: "string", description: "Embed body in Discord markdown" },
  },
  required: ["title", "description"],
  additionalProperties: false,
};

type Engine = { model: string; structured: boolean };

const REWRITE_IF_FIRST_UNDER_MS = 8000;

// Opus 5.5 at low effort: thinking can't be turned off on it, and a short
// formatting job doesn't need more. fallbacks:"default" re-runs a request its
// safety classifiers decline on Anthropic's recommended model, server-side.
const PRIMARY: Engine = { model: "claude-opus-5-5", structured: true };
// The previous setup, kept so the formatter still works if the primary
// request is ever rejected outright (e.g. a parameter the API won't take).
const LEGACY: Engine = { model: "claude-sonnet-4-6", structured: false };

type ClaudeResult =
  | { ok: true; text: string; content: unknown[]; engine: Engine }
  | { ok: false; error: string; detail?: string };

async function callClaude(
  system: string,
  messages: { role: string; content: unknown }[],
  engine: Engine = PRIMARY,
): Promise<ClaudeResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": process.env.ANTHROPIC_API_KEY!,
    "anthropic-version": "2023-06-01",
  };
  const body: Record<string, unknown> = { model: engine.model, system, messages };
  if (engine.structured) {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.max_tokens = 16000; // thinking counts toward this
    body.output_config = { effort: "low", format: { type: "json_schema", schema: EMBED_SCHEMA } };
    body.fallbacks = "default";
  } else {
    body.max_tokens = 2000;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const errText = await res.text();
    console.error(`Claude API error (${engine.model}):`, errText);
    // A rejected request (4xx other than rate limits) on the new setup: try
    // the old one rather than leaving the formatter broken.
    if (engine === PRIMARY && res.status >= 400 && res.status < 500 && res.status !== 429) {
      const legacy = await callClaude(system, messages, LEGACY);
      if (legacy.ok) return legacy;
    }
    return { ok: false, error: "AI formatting failed", detail: `${engine.model} ${res.status}: ${errText.slice(0, 200)}` };
  }

  const data = await res.json();
  if (data.stop_reason === "refusal") return { ok: false, error: "Claude declined to format this. Try rewording the notes." };
  if (data.stop_reason === "max_tokens") return { ok: false, error: "The AI reply was cut off. Try again." };
  const content: { type: string; text?: string }[] = data.content || [];
  const text = content.filter((b) => b.type === "text").map((b) => b.text || "").join("");
  return { ok: true, text, content, engine };
}

// The reply should be a bare JSON object, but tolerate fences or a stray line
// around it by taking the outermost {...}.
function parseEmbed(text: string): { title: string; description: string } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const json = text.slice(start, end + 1);
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    try {
      obj = JSON.parse(escapeControlCharsInStrings(json));
    } catch (err) {
      console.error("Embed JSON unparseable:", (err as Error).message);
      return null;
    }
  }
  // Older-format replies wrap the post in embeds[0].
  const o = obj as { title?: unknown; description?: unknown; embeds?: { title?: unknown; description?: unknown }[] };
  const e = o?.embeds?.[0] ?? o;
  if (typeof e?.title !== "string" || typeof e?.description !== "string") return null;
  return { title: e.title, description: e.description };
}

// Models sometimes put real line breaks inside JSON strings (a Discord post is
// multi-line), which JSON.parse rejects. Escape raw newlines, carriage returns
// and tabs that sit inside string literals; everything else is left alone.
function escapeControlCharsInStrings(json: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      else if (ch === "\n") { out += "\\n"; continue; }
      else if (ch === "\r") { out += "\\r"; continue; }
      else if (ch === "\t") { out += "\\t"; continue; }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}
