import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rejectionReason, asin, category, supplierName, invoiceDetails } = await req.json();

  if (!rejectionReason?.trim()) {
    return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
  }

  const prompt = `You are an expert Amazon FBA seller and compliance specialist with years of experience successfully ungating restricted categories and brands on Amazon UK.

A seller has received a rejection for their Amazon ungating application and needs your help crafting a professional appeal.

REJECTION DETAILS:
- Rejection Reason: ${rejectionReason}
${asin ? `- ASIN/Product: ${asin}` : ""}
${category ? `- Category/Brand: ${category}` : ""}
${supplierName ? `- Supplier Used: ${supplierName}` : ""}
${invoiceDetails ? `- Invoice Details Provided: ${invoiceDetails}` : ""}

Please provide:

1. **REJECTION ANALYSIS** — In plain English, explain exactly why Amazon rejected this application and what specific requirement was not met. Be direct and specific.

2. **WHAT AMAZON ACTUALLY WANTS** — A clear bullet-point list of exactly what Amazon needs to see to approve this application. Be very specific about invoice requirements, supplier types, quantities, document formats etc.

3. **PROFESSIONAL APPEAL LETTER** — Write a complete, professional appeal letter the seller can copy and send to Amazon Seller Support. The letter should:
   - Acknowledge the rejection professionally
   - Address the specific reason for rejection directly
   - Explain what steps have been taken to resolve the issue
   - Request reconsideration with confidence
   - Use professional Amazon seller language
   - Be concise but thorough (250-400 words)

4. **DOCUMENT CHECKLIST** — A specific checklist of every document they need to gather before resubmitting, with details on what each document must show (dates, quantities, supplier details, format requirements etc.)

5. **QUICK WIN TIPS** — 2-3 specific actionable tips that significantly increase approval chances for this specific rejection reason.

Format your response clearly with each section headed exactly as numbered above.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Claude API error:", err);
      return NextResponse.json({ error: "Failed to generate appeal. Try again." }, { status: 500 });
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || "";

    // Save to history
    await supabase.from("fba_ungating_history").insert({
      user_id: user.id,
      rejection_reason: rejectionReason,
      asin: asin || null,
      category: category || null,
      supplier_name: supplierName || null,
      generated_appeal: content,
    }).select();

    return NextResponse.json({ ok: true, appeal: content });
  } catch (err) {
    console.error("Ungating assistant error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
