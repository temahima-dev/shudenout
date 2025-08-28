import { NextRequest, NextResponse } from 'next/server';
import { todayTomorrowJST } from '@/lib/date';

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
  isSameDayAvailable: boolean; // 当日空室フラグ
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
}): Promise<RakutenVacantHotelResponse> {
  const rakutenApiKey = process.env.RAKUTEN_APPLICATION_ID;
  
  if (!rakutenApiKey) {
    throw new Error('Rakuten API key not configured');
  }

  const searchParams = new URLSearchParams({
    applicationId: rakutenApiKey,
    checkinDate: params.checkinDate,
    checkoutDate: params.checkoutDate,
    adultNum: params.adultNum.toString(),
    roomNum: params.roomNum.toString(),
    responseType: 'small',
    datumType: '1', // WGS84度単位
    sort: '+roomCharge', // 安い順
    hits: '30',
    page: '1'
  });

  // 位置情報が指定されている場合
  if (params.lat && params.lng) {
    searchParams.set('latitude', params.lat.toString());
    searchParams.set('longitude', params.lng.toString());
    searchParams.set('searchRadius', (params.searchRadius || 2).toString());
  }

  // 価格フィルタ
  if (params.minCharge) {
    searchParams.set('minCharge', params.minCharge.toString());
  }
  if (params.maxCharge) {
    searchParams.set('maxCharge', params.maxCharge.toString());
  }

  const apiUrl = `https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426?${searchParams.toString()}`;
  
  console.log('🔍 Rakuten VacantHotelSearch API Request:', apiUrl);

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'ShudenOutApp/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Rakuten API error: ${response.status}`);
  }

  return response.json();
}

// 楽天レスポンスをHotel型に変換
function transformRakutenHotel(rakutenHotel: any, area: string = 'その他'): Hotel {
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

  return {
    id: hotelInfo.hotelNo.toString(),
    name: hotelInfo.hotelName,
    price: hotelInfo.hotelMinCharge,
    rating: hotelInfo.reviewAverage > 0 ? hotelInfo.reviewAverage : undefined,
    imageUrl: hotelInfo.hotelImageUrl || hotelInfo.hotelThumbnailUrl || '/placeholder-hotel.jpg',
    affiliateUrl: hotelInfo.dpPlanListUrl || hotelInfo.planListUrl || hotelInfo.hotelInformationUrl,
    area,
    nearest: hotelInfo.nearestStation || hotelInfo.access.split('、')[0] || 'その他',
    amenities,
    latitude: hotelInfo.latitude,
    longitude: hotelInfo.longitude,
    isSameDayAvailable: true // VacantHotelSearchの結果は空室ありのホテル
  };
}

// フォールバック用のサンプルデータ生成
function generateFallbackData(area: string, count: number = 10): Hotel[] {
  const sampleHotels: Hotel[] = [];
  
  for (let i = 1; i <= count; i++) {
    sampleHotels.push({
      id: `fallback-${area}-${i}`,
      name: `${area}エリア ビジネスホテル ${i}`,
      price: 4000 + Math.floor(Math.random() * 6000),
      rating: 3.5 + Math.random() * 1.5,
      imageUrl: '/placeholder-hotel.jpg',
      affiliateUrl: 'https://travel.rakuten.co.jp/',
      area,
      nearest: `${area}駅`,
      amenities: ['WiFi', 'シャワー', '2人可'],
      isSameDayAvailable: false // フォールバックデータは空室未確認
    });
  }
  
  return sampleHotels;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 常に当日→明日の日付を使用
    const { today, tomorrow } = todayTomorrowJST();
    
    // パラメータ取得
    const area = searchParams.get('area') || 'all';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radiusKm = parseFloat(searchParams.get('radiusKm') || '2.0');
    const minCharge = searchParams.get('minCharge') ? parseInt(searchParams.get('minCharge')!) : undefined;
    const maxCharge = searchParams.get('maxCharge') ? parseInt(searchParams.get('maxCharge')!) : undefined;
    const adultNum = parseInt(searchParams.get('adultNum') || '2');
    const amenities = searchParams.get('amenities')?.split(',').filter(Boolean) || [];

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
      // 全て選択時は新宿を中心に広範囲検索
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

    try {
      // 楽天VacantHotelSearch API呼び出し
      const rakutenResponse = await fetchVacantHotels({
        checkinDate: today,
        checkoutDate: tomorrow,
        adultNum,
        roomNum: 1,
        lat: searchLat,
        lng: searchLng,
        searchRadius: radiusKm,
        minCharge,
        maxCharge
      });

      if (rakutenResponse.hotels && rakutenResponse.hotels.length > 0) {
        console.log(`✅ VacantHotelSearch API成功: ${rakutenResponse.hotels.length}件`);
        
        hotels = rakutenResponse.hotels.map(hotelData => 
          transformRakutenHotel(hotelData, areaName)
        );
        isVacantData = true;
      } else {
        console.log('⚠️ VacantHotelSearch API: 該当するホテルが見つかりませんでした');
        throw new Error('No vacant hotels found');
      }

    } catch (apiError) {
      console.warn('❌ VacantHotelSearch API呼び出し失敗:', apiError);
      
      // 空室確認できない場合は空の配列を返す（フォールバックしない）
      hotels = [];
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
      isSample: false,
      fallback: false,
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
          : 'データ取得中にエラーが発生しました'
    };

    console.log(`🎯 検索完了: ${hotels.length}件のホテル (空室データ: ${isVacantData})`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Hotel search error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        items: [],
        fallback: true
      },
      { status: 500 }
    );
  }
}
