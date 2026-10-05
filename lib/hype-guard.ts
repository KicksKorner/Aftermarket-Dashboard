// Hype, urgency and promise wording the AI Deal Formatter must not add on its
// own. Lewis posts some deals he's cautious about, and "don't sleep on this
// one!" on those misleads members who buy on his word. A phrase is only
// allowed when his raw notes already use it.
//
// The prompt asks for this too, but a prompt can't guarantee it, so the route
// checks every output: one rewrite request if anything slips through, then
// sentence removal as the last resort.

type Rule = { label: string; re: RegExp };

const RULES: Rule[] = [
  { label: "don't sleep on this", re: /\b(?:don'?t|do not) sleep(?: on (?:this|these|it|them|that)(?: one| deal)?)?\b|\bsleep(?:ing)? on (?:this|these|it|them|that)\b/ },
  { label: "don't miss out", re: /\b(?:don'?t|do not|can'?t|won'?t want to) miss\b|\bmiss out\b|\bnot to be missed\b/ },
  { label: "act fast", re: /\b(?:act|move) (?:fast|now|quick(?:ly)?)\b/ },
  { label: "be quick / hurry", re: /\bbe quick\b|\bhurry\b|\bquick before\b|\bdon'?t hesitate\b|\bwhat are you waiting for\b/ },
  { label: "won't last", re: /\bbefore (?:it'?s|they'?re|they are|it is|stock is) (?:gone|sold out)\b|\bwon'?t last\b|\bwhile (?:stocks?|supplies|it) lasts?\b/ },
  { label: "selling fast", re: /\b(?:selling|going|flying) (?:fast|quick(?:ly)?)\b|\bflying off\b|\bhot ?cakes\b|\b(?:will|going to|gonna|about to) sell out\b/ },
  { label: "last chance", re: /\blast chance\b|\bonce in a lifetime\b|\btime is running out\b|\brunning out\b/ },
  { label: "no-brainer", re: /\bno[- ]?brainer\b/ },
  { label: "easy money", re: /\b(?:easy|free|quick) (?:money|profit|cash|flip|win|sale)s?\b|\bsells? itself\b/ },
  { label: "guaranteed", re: /\bguarantee(?:d|s)?\b/ },
  { label: "risk-free", re: /\bcan'?t (?:go wrong|lose|fail)\b|\b(?:risk[- ]free|zero risk|no risk|low risk|minimal risk)\b|\brisk(?: level)?\W{0,6}(?:low|minimal|none)\b|\bsure (?:thing|bet|fire)\b|\bsafe bet\b/ },
  { label: "must cop", re: /\bmust[- ](?:cop|have|buy|grab|get)\b|\binsta[- ]?cop\b/ },
  { label: "grab it now", re: /\b(?:cop|grab|buy|get|secure) (?:(?:it|them|yours|one|these|this|some) )?(?:now|asap|fast|quick(?:ly)?|immediately|today|while you can)\b/ },
  { label: "run don't walk", re: /\brun,? (?:don'?t|do not) walk\b|\bjump on (?:this|it|these|them)\b|\bget in (?:early|now|quick)\b/ },
  { label: "load up", re: /\bload up\b|\bfill (?:your|ya|yer) boots\b|\bstock up\b|\bbuy (?:them )?all\b|\bclear (?:the )?shel(?:f|ves)\b/ },
  { label: "printing money", re: /\bprinting money\b|\bmoney printer\b|\bcash cow\b/ },
  { label: "huge profit", re: /\b(?:huge|massive|insane|crazy|mad|big|serious) (?:profits?|margins?|returns?|flips?|roi|money|gains?)\b/ },
  { label: "steal / banger", re: /\b(?:absolute )?(?:steal|banger)s?\b|\binsane\b|\bunreal\b|\bbargain of the (?:year|century|day)\b|\byou'?d be (?:mad|crazy|silly)\b/ },
  { label: "high demand", re: /\b(?:high|huge|massive|crazy) demand\b|\bin demand\b|\bhighly sought\b|\bsought[- ]after\b|\bhot (?:item|property|seller)\b/ },
  { label: "limited stock", re: /\blimited (?:stock|supply|quantit(?:y|ies)|time)\b/ },
  { label: "FOMO", re: /\bfomo\b/ },
];

// Lower-case, straight apostrophes, no markdown emphasis, single spaces — so
// "**Don’t  sleep**" and "don't sleep" compare equal.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ");
}

export type HypeHit = { label: string; phrase: string };

// Banned wording in `text` that the raw notes don't already use.
export function findHype(text: string, raw: string): HypeHit[] {
  const t = normalize(text);
  const r = normalize(raw);
  const hits: HypeHit[] = [];
  for (const rule of RULES) {
    if (rule.re.test(r)) continue; // he wrote it himself — allowed
    const m = t.match(rule.re);
    if (m) hits.push({ label: rule.label, phrase: m[0] });
  }
  return hits;
}

function sentences(line: string): string[] {
  return line.match(/[^.!?]+(?:[.!?]+|$)\s*/g) || [line];
}

function isHype(text: string, raw: string): boolean {
  return findHype(text, raw).length > 0;
}

// Last resort: drop every sentence that still carries banned wording. Lines
// left with nothing but emoji or punctuation go too. Returns what was removed.
export function stripHype(embed: { title?: string; description?: string }, raw: string): string[] {
  const removed: string[] = [];

  if (embed.description) {
    const kept: string[] = [];
    for (const line of embed.description.split("\n")) {
      if (!isHype(line, raw)) {
        kept.push(line);
        continue;
      }
      const parts = sentences(line);
      const survivors = parts.filter((p) => !isHype(p, raw));
      parts.filter((p) => isHype(p, raw)).forEach((p) => removed.push(p.replace(/\*\*/g, "").trim()));
      let next = survivors.join("").trim();
      // A bold span split across sentences would leave a stray "**".
      if ((next.match(/\*\*/g) || []).length % 2) next = next.replace(/\*\*/g, "");
      if (/[a-z0-9£]/i.test(next)) kept.push(next);
    }
    embed.description = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  if (embed.title && isHype(embed.title, raw)) {
    const parts = embed.title.split(/\s+[-–—|:]\s+|[!.]+\s*/).filter(Boolean);
    const survivors = parts.filter((p) => !isHype(p, raw));
    removed.push(embed.title);
    if (survivors.length && survivors.join("").trim()) {
      embed.title = survivors.join(" — ").trim();
    } else {
      // The whole title is one hyped clause: cut just the phrases.
      let t = embed.title;
      for (const hit of findHype(t, raw)) {
        const rule = RULES.find((r) => r.label === hit.label);
        if (rule) t = t.replace(new RegExp(rule.re.source, "gi"), "");
      }
      embed.title = t.replace(/\s{2,}/g, " ").replace(/^[\s!,.–—-]+|[\s,–—-]+$/g, "").trim();
    }
  }

  return removed;
}
