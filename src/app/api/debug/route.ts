import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const envCheck = {
    // 環境情報
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'local',
    
    // 楽天API関連環境変数
    hasRakutenAppId: !!process.env.NEXT_PUBLIC_RAKUTEN_APP_ID,
    rakutenAppIdLength: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID?.length || 0,
    rakutenAppIdFirst4: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID?.substring(0, 4) || 'none',
    
    hasRakutenBaseUrl: !!process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL,
    rakutenBaseUrl: process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL || 'not set',
    
    hasRakutenAffiliateId: !!process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID,
    
    // 全ての NEXT_PUBLIC_ 環境変数
    nextPublicVars: Object.keys(process.env)
      .filter(key => key.startsWith('NEXT_PUBLIC_'))
      .reduce((acc, key) => {
        acc[key] = process.env[key]?.substring(0, 10) + '...';
        return acc;
      }, {} as Record<string, string>)
  };

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: envCheck
  }, { status: 200 });
}
