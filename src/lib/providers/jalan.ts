import { type Hotel } from "@/app/data/hotels";

type NormalizedHotel = Hotel;

interface JalanParams {
  area?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  hits?: number;
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

interface JalanHotel {
  HotelName: string;
  SmallArea: string;
  NearStation: string;
  HotelMinCharge: number;
  PictureUrl: string;
  SalesformUrl: string;
  CustomerEvaluationAverage?: number;
  X?: number;
  Y?: number;
}

const AREA_MAP: Record<string, string> = {
  shinjuku: "新宿",
  shibuya: "渋谷", 
  ueno: "上野",
  shinbashi: "新橋",
  ikebukuro: "池袋",
  roppongi: "六本木"
};

// 簡易XMLパーサー（じゃらんAPI専用）
function parseJalanXML(xmlText: string): JalanHotel[] {
  const hotels: JalanHotel[] = [];
  
  try {
    // <Hotel>タグを抽出
    const hotelMatches = xmlText.match(/<Hotel[^>]*>[\s\S]*?<\/Hotel>/g);
    
    if (!hotelMatches) {
      console.log('No hotel matches found in XML');
      return [];
    }
    
    hotelMatches.forEach((hotelXml) => {
      const hotel: Partial<JalanHotel> = {};
      
      // 各フィールドを抽出
      const extractValue = (fieldName: string): string => {
        const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\/${fieldName}>`, 'i');
        const match = hotelXml.match(regex);
        return match ? match[1] : '';
      };
      
      hotel.HotelName = extractValue('HotelName');
      hotel.SmallArea = extractValue('SmallArea');
      hotel.NearStation = extractValue('NearStation');
      hotel.HotelMinCharge = parseInt(extractValue('HotelMinCharge')) || 0;
      hotel.PictureUrl = extractValue('PictureUrl');
      hotel.SalesformUrl = extractValue('SalesformUrl');
      hotel.CustomerEvaluationAverage = parseFloat(extractValue('CustomerEvaluationAverage')) || undefined;
      hotel.X = parseFloat(extractValue('X')) || undefined;
      hotel.Y = parseFloat(extractValue('Y')) || undefined;
      
      if (hotel.HotelName) {
        hotels.push(hotel as JalanHotel);
      }
    });
    
    console.log(`Parsed ${hotels.length} hotels from XML`);
    return hotels;
  } catch (error) {
    console.error('XML parsing error:', error);
    return [];
  }
}

// 座標からエリア名を推定
function getAreaNameFromCoordinates(lat: number, lng: number): string | null {
  const areas = [
    { name: "新宿", lat: 35.6896, lng: 139.6917 },
    { name: "渋谷", lat: 35.6580, lng: 139.7016 },
    { name: "上野", lat: 35.7141, lng: 139.7774 },
    { name: "新橋", lat: 35.6662, lng: 139.7580 },
    { name: "池袋", lat: 35.7295, lng: 139.7109 },
    { name: "六本木", lat: 35.6627, lng: 139.7314 }
  ];

  let closestArea = null;
  let minDistance = Infinity;

  for (const area of areas) {
    const distance = Math.sqrt(
      Math.pow(lat - area.lat, 2) + Math.pow(lng - area.lng, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area.name;
    }
  }

  // 0.05度（約5km）以内なら該当エリア、それ以外は東京全体
  return minDistance < 0.05 ? closestArea : "東京";
}

export async function searchJalan(params: JalanParams): Promise<NormalizedHotel[]> {
  // APIキー未設定なら空配列
  console.log('Jalan API Key exists:', !!process.env.JALAN_API_KEY);
  console.log('Jalan API Key length:', process.env.JALAN_API_KEY?.length || 0);
  
  if (!process.env.JALAN_API_KEY) {
    console.log('Jalan API key not set, skipping');
    return [];
  }

  try {
    const searchParams = new URLSearchParams({
      key: process.env.JALAN_API_KEY,
      xml_ptn: '1', // XMLパターン1（基本情報）
      count: Math.min(params.hits || 30, 50).toString(), // じゃらんAPILiteの上限は50
      start: (((params.page || 1) - 1) * (params.hits || 30) + 1).toString(),
      order: '1' // 料金昇順
    });

    // 東京都のプレフィックスコード（都道府県コード）を使用
    searchParams.set('pref', '130000'); // 東京都
    
    // 新宿エリアコードを試す（例として）
    searchParams.set('l_area', '137100'); // 東京23区
    searchParams.set('s_area', '137102'); // 新宿・代々木
    
    // 価格範囲
    if (params.priceMin) {
      searchParams.set('price_min', params.priceMin.toString());
    }
    if (params.priceMax) {
      searchParams.set('price_max', params.priceMax.toString());
    }

    // まず標準のエンドポイントを試す
    const url = `http://jws.jalan.net/APILite/HotelSearch/V1/?${searchParams}`;
    console.log('Jalan API URL:', url);
    console.log('Jalan API SearchParams:', Object.fromEntries(searchParams));
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'User-Agent': 'ShudenOut/1.0'
      }
    });

    if (!response.ok) {
      console.log('Jalan API HTTP error:', response.status, response.statusText);
      return [];
    }

    const xmlText = await response.text();
    console.log('Jalan API response status:', response.status);
    console.log('Jalan API XML response:', xmlText.substring(0, 500), '...');
    
    // XMLをパースする（簡易的なパーサー）
    const hotels = parseJalanXML(xmlText);
    console.log('Jalan Hotels found:', hotels.length);
    console.log('Parsed hotels data:', hotels.slice(0, 2));

    return hotels.map((hotel: JalanHotel, index: number): NormalizedHotel => ({
      id: `jalan_${hotel.HotelName}_${index}`,
      name: hotel.HotelName,
      area: hotel.SmallArea || "東京",
      nearest: hotel.NearStation || "",
      price: hotel.HotelMinCharge || 0,
      imageUrl: hotel.PictureUrl || "",
      affiliateUrl: hotel.SalesformUrl || "",
      rating: hotel.CustomerEvaluationAverage || undefined,
      amenities: [],
      latitude: hotel.Y || undefined,
      longitude: hotel.X || undefined
    }));
  } catch (error) {
    console.error('Jalan API error:', error);
    return [];
  }
}
