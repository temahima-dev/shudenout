import { NextResponse } from "next/server";

// 本番で一時的に設置、後で削除
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const APP_ID = process.env.RAKUTEN_APP_ID;
    const hasAppId = Boolean(APP_ID);
    
    if (!hasAppId) {
      return NextResponse.json({
        ok: false,
        status: 0,
        hasAppId: false,
        runtime: 'node',
        region: process.env.VERCEL_REGION ?? null,
        urlSample: 'APP_ID not found',
        bodySample: 'No API key available',
        ts: new Date().toISOString(),
        error: 'RAKUTEN_APP_ID not set'
      }, {
        headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' }
      });
    }

    // 東京駅近辺で SimpleHotelSearch を実行
    const baseUrl = 'https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426';
    const params = new URLSearchParams({
      applicationId: APP_ID,
      format: 'json',
      formatVersion: '2',
      latitude: '35.681236',
      longitude: '139.767125',
      datumType: '1',
      searchRadius: '1.0',
      hits: '3',
      sort: 'standard'
    });

    const fullUrl = `${baseUrl}?${params.toString()}`;
    
    // URLをマスク（applicationId の先頭3桁+…+末尾2桁）
    const maskedAppId = APP_ID.length > 5 ? 
      `${APP_ID.substring(0, 3)}...${APP_ID.substring(APP_ID.length - 2)}` : 
      '***';
    const urlSample = fullUrl.replace(APP_ID, maskedAppId);

    const response = await fetch(fullUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      cache: "no-store"
    });

    const responseText = await response.text();
    const bodySample = responseText.substring(0, 200);

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      hasAppId: true,
      runtime: 'node',
      region: process.env.VERCEL_REGION ?? null,
      urlSample,
      bodySample,
      ts: new Date().toISOString()
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' }
    });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      status: 0,
      hasAppId: Boolean(process.env.RAKUTEN_APP_ID),
      runtime: 'node',
      region: process.env.VERCEL_REGION ?? null,
      urlSample: 'Error occurred',
      bodySample: 'Fetch failed',
      ts: new Date().toISOString(),
      error: String(error)
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' }
    });
  }
}
