import { NextRequest, NextResponse } from "next/server"
import { buildGradeGuide } from "@/lib/centering"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const result = buildGradeGuide({
      front: body.front,
      back: body.back,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to analyze card." },
      { status: 500 }
    )
  }
}