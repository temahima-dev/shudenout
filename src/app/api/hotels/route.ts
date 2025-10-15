import { NextRequest, NextResponse } from 'next/server';
import { todayTomorrowJST } from '@/lib/date';
import { generateRakutenHotelLink, generateSampleHotelLink, validateRakutenLink, fetchCandidates, checkVacancy } from '@/lib/providers/rakuten';
import { transformRakutenHotel, mapVacantJsonToHotels } from '@/lib/providers/rakuten-utils';

// Force dynamic rendering and use Node.js runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ホテル型定義
interface Hotel {
  id: string;
  name: string;
  price: number;
  rating?: number;
  imageUrl: string;
  affiliateUrl: string;
  area: string;
  nearest: string;
  amenities: string[];
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  walkingTimeMinutes?: number;
  isSameDayAvailable: boolean;
}



// エリア座標マッピング（標準化された緯度経度検索用）
const AREA_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  'shinjuku': { lat: 35.690921, lng: 139.700258, name: '新宿' },
  'shibuya': { lat: 35.6580, lng: 139.7016, name: '渋谷' },
  'ueno': { lat: 35.7141, lng: 139.7774, name: '上野' },
  'shinbashi': { lat: 35.6662, lng: 139.7580, name: '新橋' },
  'ikebukuro': { lat: 35.7295, lng: 139.7109, name: '池袋' },
  'roppongi': { lat: 35.6627, lng: 139.7314, name: '六本木' }
};

// デフォルト検索中心（新宿駅）
const DEFAULT_SEARCH_CENTER = { lat: 35.690921, lng: 139.700258, name: '新宿駅周辺' };



function jsonResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}









// API失敗時のサンプルデータ生成（本番では完全排除）
function generateFallbackHotels(
  area: string, 
  count: number = 2,
  options?: { checkinDate: string; checkoutDate: string; adultNum: number }
): Hotel[] {
  // 本番環境では常に空配列を返す（サンプルデータ完全禁止）
  if (process.env.NODE_ENV === 'production') {
    console.log('🚫 Production mode: Fallback hotels completely disabled');
    return [];
  }
  
  // 開発環境でも通常は空配列（明示的に開発データが必要な場合のみ）
  if (!process.env.ENABLE_DEV_FALLBACK) {
    console.log('ℹ️ Development mode: Fallback hotels disabled (set ENABLE_DEV_FALLBACK=true to enable)');
    return [];
  }
  
  const fallbackHotels: Hotel[] = [];
  
  for (let i = 1; i <= count; i++) {
    const hotelId = `DEV99${i.toString().padStart(3, '0')}`;
    
    // サンプルリンクを生成
    let affiliateUrl = 'https://travel.rakuten.co.jp/';
    if (options) {
      affiliateUrl = generateSampleHotelLink(hotelId, `[DEV] ${area} テストホテル ${i}`, options);
    }
    
    fallbackHotels.push({
      id: hotelId,
      name: `[DEV] ${area} テストホテル ${i}`,
      price: 3000 + Math.floor(Math.random() * 5000),
      rating: 3.5 + Math.random() * 1.5,
      imageUrl: '/placeholder-hotel.jpg',
      affiliateUrl,
      area,
      nearest: `${area}駅`,
      amenities: ['WiFi', 'シャワー', '2人可'],
      isSameDayAvailable: false // テストデータは空室確認済みではない
    });
  }
  
  return fallbackHotels;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 常に当日→明日の日付を使用（JST）
    const { today, tomorrow } = todayTomorrowJST();
    
    // パラメータ取得（標準化）
    const area = searchParams.get('area') || 'all';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    // 半径は常に3.0km固定（URLパラメータは無視）
    const radiusKm = 3.0;
    const minCharge = searchParams.get('minCharge') ? parseInt(searchParams.get('minCharge')!) : undefined;
    const maxCharge = searchParams.get('maxCharge') ? parseInt(searchParams.get('maxCharge')!) : undefined;
    const adultNum = Math.max(1, Math.min(9, parseInt(searchParams.get('adultNum') || '2')));
    const amenities = searchParams.get('amenities')?.split(',').filter(Boolean) || [];
    const isInspectMode = searchParams.get('inspect') === '1';

    // 座標の決定（必ず緯度経度検索）
    let searchLat: number;
    let searchLng: number;
    let areaName: string;

    if (lat && lng) {
      // ユーザー指定の座標を使用
      searchLat = parseFloat(lat);
      searchLng = parseFloat(lng);
      areaName = '指定座標周辺';
    } else if (area !== 'all' && AREA_COORDINATES[area]) {
      // エリア名から事前定義座標を使用
      const coords = AREA_COORDINATES[area];
      searchLat = coords.lat;
      searchLng = coords.lng;
      areaName = coords.name;
    } else {
      // デフォルト：新宿駅を中心に検索
      searchLat = DEFAULT_SEARCH_CENTER.lat;
      searchLng = DEFAULT_SEARCH_CENTER.lng;
      areaName = DEFAULT_SEARCH_CENTER.name;
    }

    console.log('🏨 Standardized Hotel Search Request:', {
      originalArea: area,
      resolvedAreaName: areaName,
      coordinates: { lat: searchLat, lng: searchLng },
      searchRadius: radiusKm,
      dates: { checkinDate: today, checkoutDate: tomorrow },
      guests: { adultNum, roomNum: 1 },
      priceRange: { minCharge, maxCharge },
      amenities,
      isInspectMode
    });

    let hotels: Hotel[] = [];
    let isVacantData = false;
    let apiSuccess = false;
    let apiError: string | undefined;
    let apiStatusCode: number | undefined;
    let upstreamDebug: any = undefined;
    let responseMessage: string;

    // 楽天APP_IDが設定されているかチェック
    const rakutenAppId = process.env.NEXT_PUBLIC_RAKUTEN_APP_ID;
    
    if (!rakutenAppId) {
      console.error('❌ NEXT_PUBLIC_RAKUTEN_APP_ID not configured');
      apiSuccess = false;
      apiError = 'NEXT_PUBLIC_RAKUTEN_APP_ID not configured';
      isVacantData = false;
      responseMessage = process.env.NODE_ENV === 'production' 
        ? 'ホテル検索サービスが一時的に利用できません。しばらく経ってから再度お試しください。'
        : 'NEXT_PUBLIC_RAKUTEN_APP_ID not configured (development mode)';
      
      // 本番環境では常に空配列
      hotels = generateFallbackHotels(areaName, 2, {
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum
      });
    } else {
      // 二段階パイプライン: 候補取得 → 空室判定（デバッグ強化版）
      console.log('🔍 Starting two-stage pipeline: candidates → vacancy check...');
      
      try {
        let candidateDebugInfo: any = {};
        let vacancyDebugInfo: any = {};
        
        // Stage 1: 施設候補取得（堅牢化版）
        const candidatesResult = await fetchCandidates({
          lat: searchLat,
          lng: searchLng,
          radius: radiusKm,
          areaCode: area !== 'all' ? area : undefined,
          rakutenAppId
        }, isInspectMode);

        const candidateNos = candidatesResult.candidateNos;
        const candidateCount = candidateNos.length;
        candidateDebugInfo = candidatesResult.debugInfo;
        
        if (candidateCount === 0) {
          console.log('📍 No hotel candidates found in target area');
          hotels = [];
          isVacantData = false;
          
          // APIエラーと候補0件を区別する
          const apiStatus = candidateDebugInfo.attempts?.[0]?.status || 0;
          if (apiStatus >= 400 || apiStatus === 0) {
            apiSuccess = false;
            apiError = `Candidate API error (status: ${apiStatus})`;
            responseMessage = 'ホテル検索APIでエラーが発生しました。ネットワーク接続を確認し、再度お試しください。';
          } else {
            apiSuccess = true; // API成功だが候補0件
            apiError = undefined;
            responseMessage = '対象エリアで施設が見つかりませんでした。エリアを変えてお試しください。';
          }
          
          upstreamDebug = isInspectMode ? {
            pipeline: 'two_stage',
            candidateSource: candidateDebugInfo.source,
            candidateParams: {
              url: candidateDebugInfo.url,
              paramsUsed: candidateDebugInfo.paramsUsed,
              elapsedMs: candidateDebugInfo.totalElapsedMs,
              status: apiStatus,
              bodySnippetHead: candidateDebugInfo.attempts?.[0]?.bodySnippetHead || 'no data'
            },
            candidateCount: 0,
            vacancy: {
              chunkSize: 15,
              chunks: []
            }
          } : [];
        } else {
          // Stage 2: 空室判定（堅牢化版）
          const vacancyResult = await checkVacancy(candidateNos, {
            checkinDate: today,
            checkoutDate: tomorrow,
            adultNum,
            roomNum: 1,
            rakutenAppId
          }, isInspectMode);

          vacancyDebugInfo = vacancyResult.chunks;
          
          if (vacancyResult.vacantHotels.length > 0) {
            console.log(`✅ Two-stage pipeline success: ${vacancyResult.vacantHotels.length} vacant hotels from ${candidateCount} candidates`);
            
            hotels = vacancyResult.vacantHotels.map(hotelData => 
              transformRakutenHotel(hotelData, areaName, {
                checkinDate: today,
                checkoutDate: tomorrow,
                adultNum
              })
            );
            isVacantData = true;
            apiSuccess = true;
            responseMessage = `${hotels.length}件の空室ありホテルが見つかりました（候補${candidateCount}件から確認）`;
          } else {
            console.log(`📍 No vacant hotels found from ${candidateCount} candidates`);
            hotels = [];
            isVacantData = false;
            apiSuccess = true; // 候補はあったが空室なしは正常な結果
            responseMessage = '本日の空室は見つかりません。エリアを変えてお試しください。';
          }
          
          upstreamDebug = isInspectMode ? {
            pipeline: 'two_stage',
            candidateSource: candidateDebugInfo.source,
            candidateParams: {
              url: candidateDebugInfo.url,
              paramsUsed: candidateDebugInfo.paramsUsed,
              elapsedMs: candidateDebugInfo.totalElapsedMs,
              status: candidateDebugInfo.attempts?.[0]?.status || 'unknown',
              bodySnippetHead: candidateDebugInfo.attempts?.[0]?.bodySnippetHead || 'no data'
            },
            candidateCount,
            vacancy: {
              chunkSize: 15,
              chunks: vacancyDebugInfo.map((chunk: any) => ({
                from: chunk.from,
                to: chunk.to,
                status: chunk.status,
                elapsedMs: chunk.elapsedMs,
                bodySnippetHead: chunk.bodySnippetHead || 'no data',
                foundCount: chunk.foundCount || 0
              }))
            }
          } : [];
        }
      } catch (error) {
        // 致命的エラー
        console.error('❌ Two-stage pipeline error:', error);
        apiSuccess = false;
        apiError = error instanceof Error ? error.message : String(error);
        hotels = [];
        isVacantData = false;
        upstreamDebug = [];
        
        if (error instanceof Error && error.message.includes('NEXT_PUBLIC_RAKUTEN_APP_ID')) {
          responseMessage = process.env.NODE_ENV === 'production' 
            ? 'ホテル検索サービスが一時的に利用できません。しばらく経ってから再度お試しください。'
            : 'NEXT_PUBLIC_RAKUTEN_APP_ID not configured (development mode)';
        } else {
          responseMessage = 'ホテル検索でエラーが発生しました。ネットワーク接続を確認し、再度お試しください。';
        }
      }
    }

    // 設備フィルタを適用（inspect=1時はスキップ可能）
    const skipFilters = isInspectMode && searchParams.get('skip_filters') === '1';
    
    if (!skipFilters && amenities.length > 0) {
      const beforeFilterCount = hotels.length;
      hotels = hotels.filter(hotel =>
        amenities.every(amenity => hotel.amenities.includes(amenity))
      );
      console.log(`🔍 Applied amenity filters: ${beforeFilterCount} → ${hotels.length} hotels`);
    } else if (skipFilters && amenities.length > 0) {
      console.log(`🔍 Skipping amenity filters (debug mode): ${amenities.join(', ')}`);
    }

    // 価格でソート（安い順）
    hotels.sort((a, b) => a.price - b.price);

    const response = {
      items: hotels,
      paging: {
        total: hotels.length,
        page: 1,
        totalPages: 1,
        hasNext: false
      },
      isSample: !isVacantData && hotels.length > 0, // サンプルは実際にデータがある場合のみtrue
      fallback: !isVacantData,
      searchParams: {
        area: areaName,
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum,
        isVacantSearch: true // 常にVacantHotelSearch使用を明示
      },
      message: responseMessage,
              debug: isInspectMode ? {
          hasAppId: !!process.env.NEXT_PUBLIC_RAKUTEN_APP_ID,
          success: apiSuccess,
          error: apiError,
          statusCode: apiStatusCode,
          apiEndpoint: 'VacantHotelSearch/20170426',
          finalSearchParams: {
            lat: searchLat,
            lng: searchLng,
            radius: radiusKm,
            datumType: 1,
            checkinDate: today,
            checkoutDate: tomorrow,
            adultNum,
            roomNum: 1,
            originalArea: area,
            resolvedAreaName: areaName,
            searchMethod: 'two_stage_pipeline',
            candidateCount: upstreamDebug?.candidateCount || 'unknown',
            chunksProcessed: upstreamDebug?.vacancy?.chunks?.length || 'unknown',
            filtersSkipped: skipFilters,
            requestedAmenities: amenities
          },
          sampleHotelLinks: hotels.slice(0, 2).map(hotel => ({
            id: hotel.id,
            name: hotel.name,
            affiliateUrl: hotel.affiliateUrl,
            finalHrefSample: hotel.affiliateUrl,
            linkAnalysis: {
              isAffiliateLink: hotel.affiliateUrl.includes('hb.afl.rakuten.co.jp'),
              hasTrailingSlash: hotel.affiliateUrl.includes('hgc/') && hotel.affiliateUrl.includes('/?pc='),
              isHotelDetailUrl: hotel.affiliateUrl.includes('travel.rakuten.co.jp/HOTEL/') || 
                               (hotel.affiliateUrl.includes('pc=') && 
                                decodeURIComponent(hotel.affiliateUrl.split('pc=')[1] || '').includes('travel.rakuten.co.jp/HOTEL/')),
              pcDecoded: hotel.affiliateUrl.includes('pc=') ? 
                        decodeURIComponent(hotel.affiliateUrl.split('pc=')[1] || '').split('&')[0] : 
                        'not_affiliate_link'
            }
          })),
          upstream: Array.isArray(upstreamDebug) ? upstreamDebug : (upstreamDebug ? [upstreamDebug] : [])
        } : undefined
    };

    console.log(`🎯 検索完了: ${hotels.length}件のホテル (空室データ: ${isVacantData})`);

          return jsonResponse(response);

  } catch (error) {
    console.error('❌ Hotel search error:', error);
    
    return jsonResponse(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        items: [], // 本番では常に空配列（エラー時でもサンプル返却禁止）
        isSample: false,
        fallback: false,
        debug: process.env.NODE_ENV === 'development' ? {
          hasAppId: !!process.env.NEXT_PUBLIC_RAKUTEN_APP_ID,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          apiEndpoint: 'VacantHotelSearch/20170426'
        } : undefined
      },
      500
    );
  }
}