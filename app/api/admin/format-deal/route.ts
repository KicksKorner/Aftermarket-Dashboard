import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const MEMBER_ROLE_ID = "726446805667020892";

const CHANNEL_CONTEXT: Record<string, string> = {
  flips_update:        "General flip updates and restocks for resellers",
  flips:               "Profitable flip opportunities for resellers",
  kicks_flips:         "Sneaker and trainer flip opportunities",
  member_flips:        "Member-exclusive flip deals",
  pokemon_flips:       "Pokémon card and product flip opportunities",
  sneaker_streetwear:  "Sneaker and streetwear reselling deals",
  pokemon_investments: "Long-term Pokémon investment opportunities",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  detailed: `Create a detailed embed with:
- A punchy title with relevant emoji
- Description with sections for: time/date (if given), links (if given), pricing breakdown (retail/resell/profit), why this flips, risk and returns
- Use bold text (**text**) for key numbers
- Use section dividers: ──────────────────────
- Include emoji throughout to match the Discord aesthetic shown in examples
- Footer: "Aftermarket Arbitrage | 2026"`,

  quick: `Create a short, punchy embed:
- Bold title with emoji
- 4-6 lines max in description — just the key facts
- Retail, resell, profit on separate lines
- One line on why it's worth it
- No long sections, keep it snappy
- Footer: "Aftermarket Arbitrage | 2026"`,

  restock: `Create an in-store restock alert embed:
- Title like "🛒 [Store] [Product] Restock"
- Description with store locator link if provided
- Individual product blocks with EAN/SKU/PID in code blocks (\`value\`)
- Retail and estimated resale per item
- Any notes about delivery timings or store behaviour
- Footer: "Aftermarket Arbitrage | 2026"`,

  investment: `Create a long-term investment analysis embed:
- Title suggesting this is an investment hold
- Description covering: why this has long-term value, print run/rarity notes, historical price trends if mentioned
- Sections for: current retail, estimated future value, timeframe, risk rating
- Professional but accessible tone
- Footer: "Aftermarket Arbitrage | 2026"`,
};

const COLOR_MAP: Record<string, number> = {
  flips_update:        8704934,
  flips:               5763719,
  kicks_flips:         3447003,
  member_flips:        10181046,
  pokemon_flips:       16766720,
  sneaker_streetwear:  1752220,
  pokemon_investments: 5793266,
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

  const systemPrompt = `You are a Discord content writer for Aftermarket Arbitrage, a UK reselling community.
Your job is to convert raw deal information into a polished Discord webhook JSON payload.

Channel: ${channelCtx}

${styleInstr}

CRITICAL RULES:
- Return ONLY valid raw JSON — no markdown fences, no explanation, just the JSON object
- Always include "content": "<@&${MEMBER_ROLE_ID}>" to ping members
- Use embed color: ${embedColor}
- The embed description uses Discord markdown (**, *, \`code\`, [link](url), \\n for newlines)
- Make it look and feel like a professional reselling community post
- Vary your wording, emoji placement and structure each time — never produce identical outputs
- For UK context: use £ not $, say "retail" not "MSRP", use British spelling
- If EANs/SKUs/PIDs are provided, format them in code blocks
- Keep it authentic and exciting — members should want to act on this immediately

Response format:
{
  "content": "<@&${MEMBER_ROLE_ID}>",
  "embeds": [{
    "title": "...",
    "description": "...",
    "color": ${embedColor},
    "footer": { "text": "Aftermarket Arbitrage | 2026" },
    "timestamp": "${new Date().toISOString()}"
  }]
}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: `Format this into a Discord embed:\n\n${raw}${imageUrl ? `\n\nImage URL to include in the embed image field: ${imageUrl}` : ""}`,
      }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Claude API error:", errText);
    return NextResponse.json({ error: "AI formatting failed" }, { status: 500 });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const payload = JSON.parse(cleaned);
    return NextResponse.json({ payload });
  } catch {
    console.error("JSON parse error, raw text:", text.substring(0, 500));
    return NextResponse.json({ error: "Could not parse AI response. Try again." }, { status: 500 });
  }
}
