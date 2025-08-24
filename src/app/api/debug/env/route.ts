import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // 本番での環境変数デバッグ（機密情報をマスク）
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
  
  return NextResponse.json({
    hasAppId: Boolean(APP_ID),
    hasAffId: Boolean(AFF_ID),
    appIdLength: APP_ID?.length || 0,
    affIdLength: AFF_ID?.length || 0,
    appIdMasked: APP_ID ? `${APP_ID.substring(0, 3)}...${APP_ID.substring(APP_ID.length - 2)}` : 'undefined',
    affIdMasked: AFF_ID ? `${AFF_ID.substring(0, 8)}...${AFF_ID.substring(AFF_ID.length - 8)}` : 'undefined',
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    timestamp: new Date().toISOString()
  }, {
    headers: { 
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      'Content-Type': 'application/json'
    }
  });
}
