import { NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    
    if (!targetUrl) {
      return NextResponse.json(
        { error: "url parameter is required" }, 
        { 
          status: 400,
          headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' }
        }
      );
    }

    // リダイレクトチェーンを追跡（最大3段まで）
    const trace: Array<{
      url: string;
      hostname: string;
      status: number;
      location?: string;
    }> = [];

    let currentUrl = decodeURIComponent(targetUrl);
    let maxHops = 3;

    for (let hop = 0; hop < maxHops; hop++) {
      try {
        console.log(`🔍 Trace Hop ${hop + 1}: ${currentUrl}`);
        
        // URLの妥当性チェック
        const urlObj = new URL(currentUrl);
        
        const response = await fetch(currentUrl, {
          method: 'HEAD', // ヘッダーのみ取得
          redirect: 'manual', // リダイレクトを手動処理
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ShuDenOut-LinkTracer/1.0)',
          }
        });

        const entry = {
          url: currentUrl,
          hostname: urlObj.hostname,
          status: response.status,
        };

        // リダイレクトの場合
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('Location');
          if (location) {
            entry.location = location;
            trace.push(entry);
            
            // 次のURLを準備（相対URLの場合は絶対URLに変換）
            currentUrl = new URL(location, currentUrl).toString();
            continue;
          }
        }
        
        // 最終到達先
        trace.push(entry);
        break;
        
      } catch (error) {
        // エラーが発生した場合
        trace.push({
          url: currentUrl,
          hostname: 'unknown',
          status: 0,
          location: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        break;
      }
    }

    const finalDestination = trace[trace.length - 1];
    const isRakutenTravel = finalDestination?.hostname === 'travel.rakuten.co.jp';
    const isRakutenMarketplace = finalDestination?.hostname === 'www.rakuten.co.jp' || finalDestination?.hostname === 'rakuten.co.jp';
    const isAffiliateLink = trace.some(entry => entry.hostname === 'hb.afl.rakuten.co.jp');

    return NextResponse.json(
      {
        inputUrl: decodeURIComponent(targetUrl),
        trace,
        analysis: {
          finalDestination: finalDestination?.hostname,
          isRakutenTravel,
          isRakutenMarketplace,
          isAffiliateLink,
          hopCount: trace.length
        },
        timestamp: new Date().toISOString()
      },
      { 
        headers: { 
          'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error("Trace API error:", error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { 
        status: 500,
        headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' }
      }
    );
  }
}
