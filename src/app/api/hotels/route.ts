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

// エリア座標マッピング
const AREA_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  'shinjuku': { lat: 35.6896, lng: 139.6917, name: '新宿' },
  'shibuya': { lat: 35.6580, lng: 139.7016, name: '渋谷' },
  'ueno': { lat: 35.7141, lng: 139.7774, name: '上野' },
  'shinbashi': { lat: 35.6662, lng: 139.7580, name: '新橋' },
  'ikebukuro': { lat: 35.7295, lng: 139.7109, name: '池袋' },
  'roppongi': { lat: 35.6627, lng: 139.7314, name: '六本木' }
};

// 楽天Travel VacantHotelSearch API 呼び出し
async function fetchVacantHotels(params: {
  checkinDate: string;
  checkoutDate: string;
  adultNum: number;
  roomNum: number;
  lat?: number;
  lng?: number;
  searchRadius?: number;
  minCharge?: number;
  maxCharge?: number;
}, isInspectMode: boolean = false): Promise<{ 
  data: RakutenVacantHotelResponse; 
  success: boolean; 
  error?: string;
  upstream?: {
    url: string;
    status: number;
    statusText: string;
    elapsedMs: number;
    bodySnippet: string;
    paramsUsed: Record<string, string>;
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

  // パラメータ構築（必須パラメータを強制）
  const searchParams = new URLSearchParams({
    applicationId: rakutenAppId,
    checkinDate: params.checkinDate, // JST形式（yyyy-MM-dd）
    checkoutDate: params.checkoutDate, // JST形式（yyyy-MM-dd）
    adultNum: Math.max(1, params.adultNum || 2).toString(), // 最低1人、デフォルト2人
    roomNum: Math.max(1, params.roomNum || 1).toString(), // 最低1室、デフォルト1室
    responseType: 'small',
    datumType: '1', // WGS84度単位（必須）
    sort: '+roomCharge', // 安い順
    hits: '30',
    page: '1'
  });

  // 位置情報が指定されている場合（必須パラメータ追加）
  if (params.lat && params.lng) {
    searchParams.set('latitude', params.lat.toString());
    searchParams.set('longitude', params.lng.toString());
    searchParams.set('searchRadius', Math.max(1, params.searchRadius || 3).toString()); // 最低1km
  }

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
    
    let data: RakutenVacantHotelResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`JSON Parse Error: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    const upstream = isInspectMode ? {
      url: apiUrl.replace(rakutenAppId, 'APP_ID_HIDDEN'),
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      bodySnippet: responseText.slice(0, 300) + (responseText.length > 300 ? '...' : ''),
      paramsUsed
    } : undefined;

    if (!response.ok) {
      return {
        data: {},
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        upstream
      };
    }
    
    if (data.error) {
      return {
        data: {},
        success: false,
        error: `Rakuten API Error: ${data.error} - ${data.error_description}`,
        upstream
      };
    }

    return {
      data,
      success: true,
      upstream
    };

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error('❌ VacantHotelSearch API Error:', error);
    
    const upstream = isInspectMode ? {
      url: apiUrl.replace(rakutenAppId, 'APP_ID_HIDDEN'),
      status: 0,
      statusText: 'Network Error',
      elapsedMs,
      bodySnippet: error instanceof Error ? error.message : String(error),
      paramsUsed
    } : undefined;
    
    return {
      data: {},
      success: false,
      error: error instanceof Error ? error.message : String(error),
      upstream
    };
  }
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
    hasAffiliate: linkResult.debug.hasAffiliate
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

// フォールバック用のサンプルデータ生成
function generateFallbackHotels(
  area: string, 
  count: number = 3,
  options?: { checkinDate: string; checkoutDate: string; adultNum: number }
): Hotel[] {
  const fallbackHotels: Hotel[] = [];
  
  for (let i = 1; i <= count; i++) {
    const hotelId = `99999${i.toString().padStart(2, '0')}`;
    
    // サンプルリンクを生成
    let affiliateUrl = 'https://travel.rakuten.co.jp/';
    if (options) {
      affiliateUrl = generateSampleHotelLink(hotelId, `${area} フォールバックホテル ${i}`, options);
    }
    
    fallbackHotels.push({
      id: hotelId,
      name: `${area} フォールバックホテル ${i}`,
      price: 4000 + Math.floor(Math.random() * 4000),
      rating: 3.8 + Math.random() * 1.0,
      imageUrl: '/placeholder-hotel.jpg',
      affiliateUrl,
      area,
      nearest: `${area}駅`,
      amenities: ['WiFi', 'シャワー', '2人可'],
      isSameDayAvailable: true
    });
  }
  
  return fallbackHotels;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 常に当日→明日の日付を使用（JST）
    const { today, tomorrow } = todayTomorrowJST();
    
    // パラメータ取得
    const area = searchParams.get('area') || 'all';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radiusKm = parseFloat(searchParams.get('radiusKm') || '3.0');
    const minCharge = searchParams.get('minCharge') ? parseInt(searchParams.get('minCharge')!) : undefined;
    const maxCharge = searchParams.get('maxCharge') ? parseInt(searchParams.get('maxCharge')!) : undefined;
    const adultNum = parseInt(searchParams.get('adultNum') || '2');
    const amenities = searchParams.get('amenities')?.split(',').filter(Boolean) || [];
    const isInspectMode = searchParams.get('inspect') === '1';

    let searchLat: number | undefined;
    let searchLng: number | undefined;
    let areaName = 'その他';

    // 座標の決定（現在地 > エリア指定の優先順位）
    if (lat && lng) {
      searchLat = parseFloat(lat);
      searchLng = parseFloat(lng);
      areaName = '現在地周辺';
    } else if (area !== 'all' && AREA_COORDINATES[area]) {
      const coords = AREA_COORDINATES[area];
      searchLat = coords.lat;
      searchLng = coords.lng;
      areaName = coords.name;
    } else if (area === 'all') {
      // 全て選択時は新宿を中心に検索
      searchLat = AREA_COORDINATES.shinjuku.lat;
      searchLng = AREA_COORDINATES.shinjuku.lng;
      areaName = '東京都内';
    }

    console.log('🏨 Hotel Search Request:', {
      area,
      areaName,
      searchLat,
      searchLng,
      radiusKm,
      checkinDate: today,
      checkoutDate: tomorrow,
      adultNum,
      minCharge,
      maxCharge,
      amenities
    });

    let hotels: Hotel[] = [];
    let isVacantData = false;
    let apiSuccess = false;
    let apiError: string | undefined;
    let upstreamDebug: any = undefined;

    // 楽天VacantHotelSearch API呼び出し
    const result = await fetchVacantHotels({
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
    upstreamDebug = result.upstream;

    if (result.success && result.data.hotels && result.data.hotels.length > 0) {
      console.log(`✅ VacantHotelSearch API成功: ${result.data.hotels.length}件`);
      
      hotels = result.data.hotels.map(hotelData => 
        transformRakutenHotel(hotelData, areaName, {
          checkinDate: today,
          checkoutDate: tomorrow,
          adultNum
        })
      );
      isVacantData = true;
    } else {
      console.log('⚠️ VacantHotelSearch API: 空室ホテルが見つからないか、APIエラー');
      
      // 失敗時のみフォールバックデータを使用
      hotels = generateFallbackHotels(areaName, 3, {
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum
      });
      isVacantData = false;
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
      isSample: !isVacantData,
      fallback: !isVacantData,
      searchParams: {
        area: areaName,
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum,
        isVacantSearch: isVacantData
      },
      message: isVacantData 
        ? `${hotels.length}件の空室ありホテルが見つかりました` 
        : hotels.length === 0 
          ? '申し訳ございません。現在、空室が確認できるホテルがありません。しばらく経ってから再度お試しください。'
          : 'APIエラーのためサンプルデータを表示しています',
      debug: process.env.NODE_ENV === 'development' ? {
        hasAppId: !!process.env.RAKUTEN_APP_ID,
        success: apiSuccess,
        error: apiError,
        apiEndpoint: 'VacantHotelSearch/20170426',
        sampleHotelLinks: hotels.slice(0, 2).map(hotel => ({
          id: hotel.id,
          name: hotel.name,
          affiliateUrl: hotel.affiliateUrl,
          finalHrefSample: hotel.affiliateUrl
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
        items: generateFallbackHotels('東京都内', 2, {
          checkinDate: todayTomorrowJST().today,
          checkoutDate: todayTomorrowJST().tomorrow,
          adultNum: 2
        }),
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