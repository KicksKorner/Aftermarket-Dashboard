import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    chatId: process.env.TELEGRAM_CHAT_ID,
    tokenStart: process.env.TELEGRAM_BOT_TOKEN?.substring(0, 15),
  });
}