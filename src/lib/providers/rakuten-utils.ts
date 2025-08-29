/**
 * 楽天トラベルAPI用のユーティリティ関数
 * 共通の変換・処理ロジックを集約
 */

import { generateRakutenHotelLink } from './rakuten';

// ホテル型定義
interface Hotel {
  id: string;
  name: string;
  area: string;
  price: number;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  affiliateUrl: string;
  description: string;
  amenities: string[];
  location: {
    address: string;
    latitude: number;
    longitude: number;
  };
  nearest: string;
  isSameDayAvailable: boolean;
  accessInfo: string;
}

/**
 * 楽天VacantHotelSearchレスポンスをHotel型に変換
 */
export function transformRakutenHotel(
  rakutenHotel: any, 
  area: string = 'その他',
  options: { checkinDate: string; checkoutDate: string; adultNum: number }
): Hotel {
  const hotelInfo = rakutenHotel.hotel[0].hotelBasicInfo;
  
  // 設備推定（実際のAPIでは詳細設備情報が限定的）
  const amenities: string[] = [];
  if (hotelInfo.hotelSpecial) {
    if (hotelInfo.hotelSpecial.includes('駐車場')) amenities.push('駐車場');
    if (hotelInfo.hotelSpecial.includes('大浴場')) amenities.push('大浴場');
    if (hotelInfo.hotelSpecial.includes('温泉')) amenities.push('温泉');
    if (hotelInfo.hotelSpecial.includes('WiFi') || hotelInfo.hotelSpecial.includes('無線LAN')) amenities.push('WiFi');
  }

  // 楽天リンクの生成
  const linkResult = generateRakutenHotelLink(hotelInfo, options);
  
  return {
    id: hotelInfo.hotelNo?.toString() || `hotel-${Date.now()}`,
    name: hotelInfo.hotelName || 'ホテル名不明',
    area,
    price: hotelInfo.hotelMinCharge || 0,
    imageUrl: hotelInfo.hotelImageUrl || '/placeholder-hotel.jpg',
    rating: parseFloat(hotelInfo.reviewAverage || '0'),
    reviewCount: parseInt(hotelInfo.reviewCount || '0'),
    affiliateUrl: linkResult.finalUrl,
    description: hotelInfo.hotelSpecial || '',
    amenities,
    location: {
      address: hotelInfo.address1 || '',
      latitude: parseFloat(hotelInfo.latitude || '0'),
      longitude: parseFloat(hotelInfo.longitude || '0')
    },
    nearest: hotelInfo.nearestStation || area,
    isSameDayAvailable: true, // VacantHotelSearchで取得したので当日空室あり
    accessInfo: hotelInfo.access || ''
  };
}

/**
 * 楽天VacantHotelSearchのJSONレスポンスからHotel配列に変換
 */
export function mapVacantJsonToHotels(json: any): Hotel[] {
  if (!json || !json.hotels || !Array.isArray(json.hotels)) {
    return [];
  }
  
  return json.hotels.map((hotelData: any) => transformRakutenHotel(hotelData, 'VacantSearch', {
    checkinDate: '',
    checkoutDate: '',
    adultNum: 2
  }));
}

/**
 * ホテル情報URLからホテルIDを抽出
 */
export function extractHotelId(url: string): string | null {
  try {
    // travel.rakuten.co.jp/HOTEL/{id}/{id}.html のパターン
    const hotelMatch = url.match(/\/HOTEL\/(\d+)\/\d+\.html/);
    if (hotelMatch) {
      return hotelMatch[1];
    }

    // f_no パラメータからの抽出
    const urlObj = new URL(url);
    const fNo = urlObj.searchParams.get('f_no');
    if (fNo) {
      return fNo;
    }

    // その他のパターンでIDを抽出
    const idMatch = url.match(/[?&](?:hotel_no|id|hotelno)=(\d+)/i);
    if (idMatch) {
      return idMatch[1];
    }

    return null;
  } catch (error) {
    console.warn('Failed to extract hotel ID from URL:', url, error);
    return null;
  }
}

/**
 * URLが画像APIかどうかを判定
 */
export function isImageApiUrl(url: string): boolean {
  return url.includes('/img/') || url.includes('image') || url.includes('.jpg') || url.includes('.png');
}

/**
 * URLをホテル詳細URLに正規化
 */
export function normalizeToHotelDetailUrl(url: string, hotelId?: string): string {
  // すでにホテル詳細URLの場合はそのまま
  if (url.includes('travel.rakuten.co.jp/HOTEL/') && url.includes('.html')) {
    return url;
  }

  // hotelIdが提供されている場合は詳細URLを生成
  if (hotelId) {
    return `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
  }

  // URLからIDを抽出して詳細URLを生成
  const extractedId = extractHotelId(url);
  if (extractedId) {
    return `https://travel.rakuten.co.jp/HOTEL/${extractedId}/${extractedId}.html`;
  }

  // 正規化できない場合は元のURLを返す
  return url;
}

/**
 * SimpleHotelSearchのJSONレスポンスから候補ホテルNo配列に変換
 */
export function mapHotelSearchJsonToCandidates(json: any): string[] {
  if (!json || !json.hotels || !Array.isArray(json.hotels)) {
    return [];
  }
  
  const hotelNos: string[] = [];
  for (const hotel of json.hotels) {
    const hotelNo = hotel.hotel?.[0]?.hotelBasicInfo?.hotelNo;
    if (hotelNo) {
      hotelNos.push(hotelNo.toString());
    }
  }
  
  return hotelNos;
}
