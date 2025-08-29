import { NextRequest, NextResponse } from 'next/server';
import { todayTomorrowJST } from '@/lib/date';
import { generateRakutenHotelLink, generateSampleHotelLink, validateRakutenLink } from '@/lib/providers/rakuten';

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

// 中心点ずらし検索付きVacantHotelSearch API呼び出し
async function fetchVacantHotelsWithCenterShifting(params: {
  checkinDate: string;
  checkoutDate: string;
  adultNum: number;
  roomNum: number;
  lat: number;
  lng: number;
  searchRadius: number; // 常に≤3km
  minCharge?: number;
  maxCharge?: number;
}, isInspectMode: boolean = false): Promise<{
  hotels: any[];
  success: boolean;
  error?: string;
  statusCode?: number;
  totalPointsSearched: number;
  allNotFound?: boolean;
  upstreamArray?: Array<{
    lat: number;
    lng: number;
    radius: number;
    status: number;
    statusText: string;
    elapsedMs: number;
    bodySnippet: string;
    isNotFound?: boolean;
    hotelCount?: number;
  }>;
}> {
  // 東京の緯度で 1km ≈ lat:0.009, lng:0.0127
  const latPerKm = 0.009;
  const lngPerKm = 0.0127;
  
  // 中心点のオフセット（km単位）
  const offsetsKm = [
    [0, 0],      // 元の中心点
    [0, 2],      // 北に2km
    [0, -2],     // 南に2km
    [2, 0],      // 東に2km
    [-2, 0],     // 西に2km
    [2, 2],      // 北東に2km
    [2, -2],     // 南東に2km
    [-2, 2],     // 北西に2km
    [-2, -2]     // 南西に2km
  ];
  
  const upstreamArray: Array<any> = [];
  const allHotels: any[] = [];
  const hotelNoSet = new Set<string>(); // 重複排除用
  
  console.log(`🔍 Starting VacantHotelSearch with center shifting (${offsetsKm.length} points, radius: ${params.searchRadius}km)`);

  for (let i = 0; i < offsetsKm.length; i++) {
    const [offsetLat, offsetLng] = offsetsKm[i];
    const searchLat = params.lat + (offsetLat * latPerKm);
    const searchLng = params.lng + (offsetLng * lngPerKm);
    
    console.log(`🎯 Point ${i + 1}/${offsetsKm.length}: lat=${searchLat.toFixed(6)}, lng=${searchLng.toFixed(6)} (offset: ${offsetLat}km, ${offsetLng}km)`);
    
    const result = await fetchVacantHotelsSingleRadius({
      ...params,
      lat: searchLat,
      lng: searchLng
    }, isInspectMode);

    // debug用にupstream記録
    if (isInspectMode && result.upstream) {
      upstreamArray.push({
        lat: searchLat,
        lng: searchLng,
        radius: result.upstream.radius,
        status: result.upstream.status,
        statusText: result.upstream.statusText,
        elapsedMs: result.upstream.elapsedMs,
        bodySnippet: result.upstream.bodySnippet,
        isNotFound: result.isNotFound,
        hotelCount: result.success && result.data.hotels ? result.data.hotels.length : 0
      });
    }

    // 成功した場合はホテルを収集
    if (result.success && result.data.hotels && result.data.hotels.length > 0) {
      console.log(`✅ Found ${result.data.hotels.length} hotels at point ${i + 1} (${offsetLat}km, ${offsetLng}km)`);
      
      // 重複排除しながら追加
      for (const hotel of result.data.hotels) {
        const hotelNo = hotel.hotelNo || hotel.hotelBasicInfo?.hotelNo;
        if (hotelNo && !hotelNoSet.has(hotelNo)) {
          hotelNoSet.add(hotelNo);
          allHotels.push(hotel);
        }
      }
    } else if (result.success && (!result.data.hotels || result.data.hotels.length === 0)) {
      console.log(`ℹ️ API success but 0 hotels at point ${i + 1}`);
    } else if (result.isNotFound) {
      console.log(`📍 Not found at point ${i + 1}, continuing to next point...`);
    } else if (result.statusCode === 400) {
      console.warn(`⚠️ Parameter error at point ${i + 1} (status: 400), continuing...`);
    } else if (result.statusCode === 429 || (result.statusCode && result.statusCode >= 500)) {
      console.error(`❌ API error (${result.statusCode}) at point ${i + 1}, but continuing...`);
    } else {
      console.error(`❌ Other error (${result.statusCode}) at point ${i + 1}: ${result.error}`);
    }
  }

  console.log(`🎯 Center shifting search completed: ${allHotels.length} unique hotels found from ${offsetsKm.length} points`);

  return {
    hotels: allHotels,
    success: allHotels.length > 0,
    totalPointsSearched: offsetsKm.length,
    allNotFound: allHotels.length === 0,
    upstreamArray: isInspectMode ? upstreamArray : undefined
  };
}

// 楽天レスポンスをHotel型に変換
function transformRakutenHotel(
  rakutenHotel: any, 
  area: string = 'その他',
  options: { checkinDate: string; checkoutDate: string; adultNum: number }
): Hotel {
  const hotelInfo = rakutenHotel.hotel[0].hotelBasicInfo;
  
  // 設備推定（実際のAPIでは詳細設備情報が限定的）
  const amenities: string[] = [];
  if (hotelInfo.hotelSpecial) {
    if (hotelInfo.hotelSpecial.includes('Wi-Fi') || hotelInfo.hotelSpecial.includes('wifi')) {
      amenities.push('WiFi');
    }
    if (hotelInfo.hotelSpecial.includes('シャワー') || hotelInfo.hotelSpecial.includes('バス')) {
      amenities.push('シャワー');
    }
  }
  amenities.push('2人可'); // 空室検索結果なので基本的に利用可能

  // 適切なホテルリンクを生成
  const linkResult = generateRakutenHotelLink(hotelInfo, {
    checkinDate: options.checkinDate,
    checkoutDate: options.checkoutDate,
    adultNum: options.adultNum,
    roomNum: 1
  });

  // リンクの有効性を検証
  const validation = validateRakutenLink(linkResult.finalUrl);
  
  console.log(`🔗 Hotel ${hotelInfo.hotelNo} (${hotelInfo.hotelName}) link:`, {
    source: linkResult.source,
    status: linkResult.debug.status,
    sourceUrl: linkResult.debug.sourceUrl,
    finalUrl: linkResult.finalUrl,
    validation: validation.isValid ? '✅ Valid' : `❌ ${validation.reason}`,
    usedSource: linkResult.debug.usedSource,
    hasAffiliate: linkResult.debug.hasAffiliate,
    hasTrailingSlash: linkResult.debug.hasTrailingSlash,
    isDoubleEncoded: linkResult.debug.isDoubleEncoded
  });

  return {
    id: hotelInfo.hotelNo.toString(),
    name: hotelInfo.hotelName,
    price: hotelInfo.hotelMinCharge,
    rating: hotelInfo.reviewAverage > 0 ? hotelInfo.reviewAverage : undefined,
    imageUrl: hotelInfo.hotelImageUrl || hotelInfo.hotelThumbnailUrl || '/placeholder-hotel.jpg',
    affiliateUrl: linkResult.finalUrl,
    area,
    nearest: hotelInfo.nearestStation || hotelInfo.access.split('、')[0] || 'その他',
    amenities,
    latitude: hotelInfo.latitude,
    longitude: hotelInfo.longitude,
    isSameDayAvailable: true // VacantHotelSearchの結果は空室ありのホテル
  };
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
      // 楽天VacantHotelSearch API呼び出し（中心点ずらし付き）
      console.log('🔍 Calling VacantHotelSearch API with center shifting...');
      
      const result = await fetchVacantHotelsWithCenterShifting({
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum,
        roomNum: 1,
        lat: searchLat,
        lng: searchLng,
        searchRadius: radiusKm,
        minCharge,
        maxCharge
      }, isInspectMode);

      apiSuccess = result.success;
      apiError = result.error;
      apiStatusCode = result.statusCode;
      upstreamDebug = result.upstreamArray; // 配列に変更

      if (result.success && result.hotels && result.hotels.length > 0) {
        console.log(`✅ VacantHotelSearch API成功: ${result.hotels.length}件（${result.totalPointsSearched}ポイント検索）`);
        
        hotels = result.hotels.map(hotelData => 
          transformRakutenHotel(hotelData, areaName, {
            checkinDate: today,
            checkoutDate: tomorrow,
            adultNum
          })
        );
        isVacantData = true;
        responseMessage = `${hotels.length}件の空室ありホテルが見つかりました（${result.totalPointsSearched}ポイント検索、半径${radiusKm}km）`;
      } else if (result.allNotFound) {
        // 全ポイントで404またはエラーの場合
        console.log(`📍 All ${result.totalPointsSearched} points returned no hotels`);
        hotels = [];
        isVacantData = false; // 404なので正確なVacantデータではない
        responseMessage = '本日の空室は見つかりません（検索範囲を変えてお試しください）。';
      } else {
        // その他のエラー
        console.error(`❌ VacantHotelSearch API失敗: ${apiError} (status: ${apiStatusCode})`);
        hotels = []; // 本番では常に空配列
        isVacantData = false;
        
        if (apiStatusCode === 429) {
          responseMessage = '現在混雑しています。少し時間をおいて再度お試しください。';
        } else if (apiStatusCode === 400 || apiStatusCode === 403) {
          responseMessage = '検索条件に問題があります。条件を変更して再度お試しください。';
        } else if (apiStatusCode && apiStatusCode >= 500) {
          responseMessage = 'ホテル検索サービスが一時的に利用できません。しばらく経ってから再度お試しください。';
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
          searchMethod: 'center_shifting',
          totalPointsSearched: result?.totalPointsSearched || 'unknown'
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
        upstream: upstreamDebug
      } : undefined
    };

    console.log(`🎯 検索完了: ${hotels.length}件のホテル (空室データ: ${isVacantData})`);

    const jsonResponse = NextResponse.json(response);
    jsonResponse.headers.set('Cache-Control', 'no-store');
    return jsonResponse;

  } catch (error) {
    console.error('❌ Hotel search error:', error);
    
    const errorResponse = NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        items: [], // 本番では常に空配列（エラー時でもサンプル返却禁止）
        fallback: true,
        debug: process.env.NODE_ENV === 'development' ? {
          hasAppId: !!process.env.RAKUTEN_APP_ID,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          apiEndpoint: 'VacantHotelSearch/20170426'
        } : undefined
      },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  }
}