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

interface RakutenVacantHotelResponse {
  hotels?: Array<{
    hotel: Array<{
      hotelBasicInfo: {
        hotelNo: number;
        hotelName: string;
        hotelInformationUrl: string;
        planListUrl: string;
        dpPlanListUrl: string;
        reviewAverage: number;
        userReview: string;
        hotelImageUrl: string;
        hotelThumbnailUrl: string;
        latitude: number;
        longitude: number;
        postalCode: string;
        address1: string;
        address2: string;
        telephoneNo: string;
        faxNo: string;
        access: string;
        nearestStation: string;
        hotelSpecial: string;
        hotelMinCharge: number;
        roomImageUrl?: string;
      };
    }>;
  }>;
  error?: string;
  error_description?: string;
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

// ユーティリティ関数
function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn('JSON parse failed:', error);
    return {};
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function jitter(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function jsonResponse(data: any, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

// 単一半径でのVacantHotelSearch API呼び出し
async function fetchVacantHotelsSingleRadius(params: {
  checkinDate: string;
  checkoutDate: string;
  adultNum: number;
  roomNum: number;
  lat: number;
  lng: number;
  searchRadius: number;
  minCharge?: number;
  maxCharge?: number;
}, isInspectMode: boolean = false, retryCount: number = 0): Promise<{ 
  data: RakutenVacantHotelResponse; 
  success: boolean; 
  error?: string;
  statusCode?: number;
  isNotFound?: boolean; // 404(not_found)の場合true
  upstream?: {
    url: string;
    status: number;
    statusText: string;
    elapsedMs: number;
    bodySnippet: string;
    paramsUsed: Record<string, string>;
    radius: number;
  };
}> {
  // 関数内で環境変数を参照
  const rakutenAppId = process.env.RAKUTEN_APP_ID;
  
  if (!rakutenAppId) {
    return {
      data: {},
      success: false,
      error: 'Rakuten APP_ID not configured'
    };
  }

  // パラメータ構築（厳密な標準化）
  const searchParams = new URLSearchParams({
    applicationId: rakutenAppId,
    checkinDate: params.checkinDate, // JST形式（yyyy-MM-dd）
    checkoutDate: params.checkoutDate, // JST形式（yyyy-MM-dd）
    adultNum: Math.max(1, Math.min(9, params.adultNum)).toString(), // 1-9人の範囲
    roomNum: Math.max(1, Math.min(10, params.roomNum)).toString(), // 1-10室の範囲
    responseType: 'small',
    datumType: '1', // WGS84度単位（必須）
    sort: '+roomCharge', // 安い順
    hits: '30',
    page: '1',
    // 緯度経度検索（必須）
    latitude: params.lat.toString(),
    longitude: params.lng.toString(),
    searchRadius: Math.max(1, Math.min(10, params.searchRadius)).toString() // 1-10kmの範囲
  });

  // 価格フィルタ
  if (params.minCharge && params.minCharge > 0) {
    searchParams.set('minCharge', params.minCharge.toString());
  }
  if (params.maxCharge && params.maxCharge > 0) {
    searchParams.set('maxCharge', params.maxCharge.toString());
  }

  const apiUrl = `https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426?${searchParams.toString()}`;
  const paramsUsed = Object.fromEntries(searchParams.entries());
  
  console.log('🔍 Rakuten VacantHotelSearch API Request:', {
    url: apiUrl.replace(rakutenAppId, 'APP_ID_HIDDEN'),
    params: paramsUsed
  });

  const startTime = Date.now();

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'ShudenOutApp/1.0',
        'Cache-Control': 'no-store'
      },
      cache: 'no-store' // キャッシュなし
    });

    const elapsedMs = Date.now() - startTime;
    const responseText = await response.text();
    
    const upstream = isInspectMode ? {
      url: apiUrl.replace(rakutenAppId, 'APP_ID_HIDDEN'),
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      bodySnippet: responseText.slice(0, 300) + (responseText.length > 300 ? '...' : ''),
      paramsUsed,
      radius: params.searchRadius
    } : undefined;

    // リトライ対象のエラー判定
    const shouldRetry = (response.status === 429 || response.status >= 500) && retryCount === 0;
    
    if (!response.ok) {
      // 404の場合は特別に処理（not_foundとして扱う）
      if (response.status === 404) {
        let isNotFound = false;
        try {
          const data = JSON.parse(responseText);
          if (data.error === 'not_found' || data.error_description?.includes('not found')) {
            isNotFound = true;
          }
        } catch (parseError) {
          // JSONパースできない場合も404として扱う
          isNotFound = true;
        }

        return {
          data: {},
          success: false,
          error: `HTTP 404: Not Found`,
          statusCode: response.status,
          isNotFound,
          upstream
        };
      }

      if (shouldRetry) {
        console.warn(`🔄 Retrying VacantHotelSearch API (status: ${response.status}, radius: ${params.searchRadius}km)`);
        // 300-600msのジッタ付きリトライ
        const jitterDelay = 300 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
        return fetchVacantHotelsSingleRadius(params, isInspectMode, retryCount + 1);
      }

      return {
        data: {},
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        statusCode: response.status,
        upstream
      };
    }

    let data: RakutenVacantHotelResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        data: {},
        success: false,
        error: `JSON Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        statusCode: response.status,
        upstream
      };
    }
    
    if (data.error) {
      return {
        data: {},
        success: false,
        error: `Rakuten API Error: ${data.error} - ${data.error_description}`,
        statusCode: response.status,
        upstream
      };
    }

    return {
      data,
      success: true,
      statusCode: response.status,
      upstream
    };

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error('❌ VacantHotelSearch API Network Error:', error);
    
    // ネットワークエラーのリトライ
    if (retryCount === 0) {
      console.warn(`🔄 Retrying VacantHotelSearch API (network error, radius: ${params.searchRadius}km)`);
      const jitterDelay = 300 + Math.random() * 300;
      await new Promise(resolve => setTimeout(resolve, jitterDelay));
      return fetchVacantHotelsSingleRadius(params, isInspectMode, retryCount + 1);
    }
    
    const upstream = isInspectMode ? {
      url: apiUrl.replace(rakutenAppId, 'APP_ID_HIDDEN'),
      status: 0,
      statusText: 'Network Error',
      elapsedMs,
      bodySnippet: error instanceof Error ? error.message : String(error),
      paramsUsed,
      radius: params.searchRadius
    } : undefined;
    
    return {
      data: {},
      success: false,
      error: error instanceof Error ? error.message : String(error),
      statusCode: 0,
      upstream
    };
  }
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
    const radius = searchParams.get('radius') || searchParams.get('radiusKm') || '3';
    const radiusKm = Math.max(1, Math.min(3, parseFloat(radius))); // 3km上限に制限 // 1-10kmに制限
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
    const rakutenAppId = process.env.RAKUTEN_APP_ID;
    
    if (!rakutenAppId) {
      console.error('❌ RAKUTEN_APP_ID not configured');
      apiSuccess = false;
      apiError = 'RAKUTEN_APP_ID not configured';
      isVacantData = false;
      responseMessage = process.env.NODE_ENV === 'production' 
        ? 'ホテル検索サービスが一時的に利用できません。しばらく経ってから再度お試しください。'
        : 'RAKUTEN_APP_ID not configured (development mode)';
      
      // 本番環境では常に空配列
      hotels = generateFallbackHotels(areaName, 2, {
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum
      });
    } else {
      // 二段階パイプライン: 候補取得 → 空室判定
      console.log('🔍 Starting two-stage pipeline: candidates → vacancy check...');
      
      try {
        let candidateCount = 0;
        let chunks: any[] = [];
        
        // Stage 1: 施設候補取得
        const candidateNos = await fetchCandidates({
          lat: searchLat,
          lng: searchLng,
          radius: radiusKm,
          areaCode: area !== 'all' ? area : undefined,
          rakutenAppId
        });

        candidateCount = candidateNos.length;
        
        if (candidateCount === 0) {
          console.log('📍 No hotel candidates found in target area');
          hotels = [];
          isVacantData = false;
          apiSuccess = false;
          apiError = 'No candidates found';
          upstreamDebug = [];
          responseMessage = '対象エリアで施設が見つかりません。エリアを変えてお試しください。';
        } else {
          // Stage 2: 空室判定
          const vacancyResult = await checkVacancy(candidateNos, {
            checkinDate: today,
            checkoutDate: tomorrow,
            adultNum,
            roomNum: 1,
            rakutenAppId
          }, isInspectMode);

          chunks = vacancyResult.chunks;
          
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
            apiSuccess = true; // 候補はあったが空室なしは正常
            responseMessage = '本日の空室は見つかりません。エリアを変えてお試しください。';
          }
          
          upstreamDebug = isInspectMode ? {
            pipeline: 'two_stage',
            candidateCount,
            chunks,
            paramsUsed: {
              lat: searchLat,
              lng: searchLng,
              datumType: 1,
              radius: radiusKm,
              checkinDate: today,
              checkoutDate: tomorrow,
              adultNum,
              roomNum: 1
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
        
        if (error instanceof Error && error.message.includes('RAKUTEN_APP_ID')) {
          responseMessage = process.env.NODE_ENV === 'production' 
            ? 'ホテル検索サービスが一時的に利用できません。しばらく経ってから再度お試しください。'
            : 'RAKUTEN_APP_ID not configured (development mode)';
        } else {
          responseMessage = 'ホテル検索でエラーが発生しました。ネットワーク接続を確認し、再度お試しください。';
        }
      }
    }

    // 設備フィルタを適用
    if (amenities.length > 0) {
      hotels = hotels.filter(hotel =>
        amenities.every(amenity => hotel.amenities.includes(amenity))
      );
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
        hasAppId: !!process.env.RAKUTEN_APP_ID,
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
          chunksProcessed: upstreamDebug?.chunks?.length || 'unknown'
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
          hasAppId: !!process.env.RAKUTEN_APP_ID,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          apiEndpoint: 'VacantHotelSearch/20170426'
        } : undefined
      },
      500
    );
  }
}