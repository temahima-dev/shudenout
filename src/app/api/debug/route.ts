import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    env: {
      NEXT_PUBLIC_RAKUTEN_APP_ID: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID || "undefined",
      NEXT_PUBLIC_RAKUTEN_BASE_URL: process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL || "undefined",
    },
  });
}
