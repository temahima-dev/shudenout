import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasRakutenAppId: !!process.env.RAKUTEN_APP_ID,
    hasRakutenAffiliateId: !!process.env.RAKUTEN_AFFILIATE_ID,
    hasJalanApiKey: !!process.env.JALAN_API_KEY,
    jalanApiKeyLength: process.env.JALAN_API_KEY?.length || 0,
    environment: process.env.NODE_ENV,
  });
}
