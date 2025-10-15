import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'success',
      message: 'API test successful',
      timestamp: new Date().toISOString(),
      hasRakutenKey: !!process.env.NEXT_PUBLIC_RAKUTEN_APP_ID,
      appId: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID || "undefined",
      baseUrl: process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL || "undefined",
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV || "local"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
