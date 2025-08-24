import 'server-only';
import { Hotel } from "@/app/data/hotels";

// APIベースURL
const BASE_URL = "https://app.rakuten.co.jp/services/api/Travel";
const SIMPLE_SEARCH_URL = `${BASE_URL}/SimpleHotelSearch/20170426`;
const VACANT_SEARCH_URL = `${BASE_URL}/VacantHotelSearch/20170426`;
const DETAIL_SEARCH_URL = `${BASE_URL}/HotelDetailSearch/20170426`;

interface SearchParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  page?: number;
  hits?: number;
  checkinDate?: string;
  checkoutDate?: string;
  adultNum?: number;
  roomNum?: number;
  minCharge?: number;
  maxCharge?: number;
  largeClassCode?: string;
  middleClassCode?: string;
  smallClassCode?: string;
  detailClassCode?: string;
  sort?: "standard" | "+roomCharge" | "-roomCharge";
}

interface RakutenHotel {
  hotelNo: number;
  hotelName: string;
  hotelInformationUrl: string;
  planListUrl: string;
  dpPlanListUrl: string;
  reviewUrl: string;
  hotelKanaName: string;
  hotelSpecial: string;
  hotelMinCharge: number;
  latitude: number;
  longitude: number;
  postalCode: string;
  address1: string;
  address2: string;
  telephoneNo: string;
  faxNo: string;
  access: string;
  parkingInformation: string;
  nearestStation: string;
  hotelImageUrl: string;
  hotelThumbnailUrl: string;
  roomImageUrl: string;
  roomThumbnailUrl: string;
  hotelMapImageUrl: string;
  reviewCount: number;
  reviewAverage: number;
  userReview: string;
}

interface RakutenResponse {
  pagingInfo: {
    recordCount: number;
    pageCount: number;
    page: number;
    first: number;
    last: number;
  };
  hotels: Array<Array<{
    hotelBasicInfo: RakutenHotel;
    hotelRatingInfo: {
      serviceAverage: number;
      locationAverage: number;
      roomAverage: number;
      equipmentAverage: number;
      bathAverage: number;
      mealAverage: number;
    };
  }>>;
}

interface SearchResult {
  items: Hotel[];
  paging: {
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
  };
}

// 指数バックオフでリトライする関数
async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        cache: "no-store"
      });
      
      if (response.status === 429) {
        if (attempt < maxRetries) {
          // 指数バックオフ: 1秒, 2秒, 4秒
          const delay = Math.pow(2, attempt) * 1000;
          console.warn(`楽天API Rate Limit. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`楽天API Error. Retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }
  
  throw lastError!;
}

// 楽天ホテルデータをアプリのHotel型にマッピング
function mapRakutenToHotel(rakutenHotel: RakutenHotel): Hotel {
  // エリアを住所から抽出
  const area = extractAreaFromAddress(rakutenHotel.address1);
  
  // 設備情報（楽天APIからは詳細取得が必要なため、デフォルト設定）
  const amenities: Array<"シャワー" | "WiFi" | "2人可"> = ["WiFi"];
  
  // 楽天APIから提供されるURL群をデバッグログ出力
  console.log("🔍 楽天API URL Debug:", {
    hotelNo: rakutenHotel.hotelNo,
    hotelName: rakutenHotel.hotelName,
    hotelInformationUrl: rakutenHotel.hotelInformationUrl,
    planListUrl: rakutenHotel.planListUrl,
    dpPlanListUrl: rakutenHotel.dpPlanListUrl
  });

  // 楽天APIのhotelInformationUrlは画像APIなので使用せず、
  // 正しい楽天トラベルのホテル詳細・予約ページURLを生成
  // 一時的にテスト用デフォルトIDを使用（楽天公式のサンプルID）
  const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID || "17b592bd.218bc1d1.17b592be.70a9cb04";
  const travelUrl = `https://travel.rakuten.co.jp/HOTEL/${rakutenHotel.hotelNo}/${rakutenHotel.hotelNo}.html`;
  const affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${AFF_ID}/?pc=${encodeURIComponent(travelUrl)}`;
  
  console.log("✅ 正しい楽天トラベルURL生成:", {
    hotelNo: rakutenHotel.hotelNo,
    directUrl: travelUrl,
    affiliateUrl: affiliateUrl
  });
  
  return {
    id: `rakuten_${rakutenHotel.hotelNo}`,
    name: rakutenHotel.hotelName,
    area,
    nearest: rakutenHotel.nearestStation || "駅情報なし",
    price: rakutenHotel.hotelMinCharge || 5000, // fallback to 5000 if price unavailable
    amenities,
    imageUrl: rakutenHotel.hotelImageUrl || rakutenHotel.hotelThumbnailUrl || "https://picsum.photos/seed/hotel/1200/800",
    affiliateUrl,
    rating: rakutenHotel.reviewAverage > 0 ? rakutenHotel.reviewAverage : undefined,
    latitude: rakutenHotel.latitude,
    longitude: rakutenHotel.longitude,
    // デバッグ用: 楽天APIから提供された元のURL（本番で一時的に使用、後で削除）
    originalUrl: rakutenHotel.hotelInformationUrl,
  };
}

// 住所からエリア（区）を抽出
function extractAreaFromAddress(address: string): string {
  const areaMatches = address.match(/(新宿区|渋谷区|台東区|港区|千代田区|中央区|豊島区|品川区|目黒区|大田区|世田谷区|杉並区|練馬区|板橋区|北区|荒川区|足立区|葛飾区|江戸川区|墨田区|江東区|文京区)/);
  return areaMatches ? areaMatches[1] : "東京都";
}

// パラメータをクランプする関数
function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// 共通のクエリパラメータを生成
function buildCommonParams(): URLSearchParams {
  const APP_ID = process.env.RAKUTEN_APP_ID;
  const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
  
  // 環境変数デバッグログ（本番用、後で削除）
  console.log("🔧 環境変数Debug:", {
    hasAppId: Boolean(APP_ID),
    hasAffId: Boolean(AFF_ID),
    appIdMasked: APP_ID ? `${APP_ID.substring(0, 3)}...${APP_ID.substring(APP_ID.length - 2)}` : 'undefined',
    affIdMasked: AFF_ID ? `${AFF_ID.substring(0, 8)}...${AFF_ID.substring(AFF_ID.length - 8)}` : 'undefined'
  });
  
  if (!APP_ID) {
    throw new Error("RAKUTEN_APP_ID missing in environment variables");
  }
  
  const params = new URLSearchParams({
    applicationId: APP_ID,
    format: "json",
    formatVersion: "2",
    datumType: "1", // WGS84・度
  });
  
  // アフィリエイトIDをAPIリクエストに追加（楽天公式のサンプルIDをフォールバック）
  const finalAffId = AFF_ID || "17b592bd.218bc1d1.17b592be.70a9cb04";
  params.set("affiliateId", finalAffId);
  
  return params;
}

// SimpleHotelSearch API呼び出し
export async function searchHotels(searchParams: SearchParams): Promise<SearchResult> {
  try {
    const params = buildCommonParams();
    
    // ページングパラメータ
    const page = clampValue(searchParams.page || 1, 1, 100);
    const hits = clampValue(searchParams.hits || 10, 1, 30);
    params.set("page", page.toString());
    params.set("hits", hits.toString());
    
    // 位置検索
    if (searchParams.lat && searchParams.lng) {
      params.set("latitude", searchParams.lat.toString());
      params.set("longitude", searchParams.lng.toString());
      
      if (searchParams.radiusKm) {
        const radius = clampValue(searchParams.radiusKm, 0.1, 3.0);
        params.set("searchRadius", radius.toString());
      }
    }
    
    // エリアコード検索
    if (searchParams.largeClassCode) {
      params.set("largeClassCode", searchParams.largeClassCode);
    }
    if (searchParams.middleClassCode) {
      params.set("middleClassCode", searchParams.middleClassCode);
    }
    if (searchParams.smallClassCode) {
      params.set("smallClassCode", searchParams.smallClassCode);
    }
    if (searchParams.detailClassCode) {
      params.set("detailClassCode", searchParams.detailClassCode);
    }
    
    // ソート
    if (searchParams.sort) {
      params.set("sort", searchParams.sort);
    }
    
    const url = `${SIMPLE_SEARCH_URL}?${params.toString()}`;
    console.log("楽天API SimpleHotelSearch URL:", url);
    
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.warn(`楽天API SimpleHotelSearch エラー: ${response.status}`);
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data: RakutenResponse = await response.json();
    
    if (!data.hotels || data.hotels.length === 0) {
      return {
        items: [],
        paging: {
          total: 0,
          page: page,
          totalPages: 0,
          hasNext: false,
        },
      };
    }
    
    const hotels = data.hotels.map((hotelData) => {
      const hotel = hotelData[0].hotelBasicInfo;
      return mapRakutenToHotel(hotel);
    });
    
    return {
      items: hotels,
      paging: {
        total: data.pagingInfo.recordCount,
        page: data.pagingInfo.page,
        totalPages: data.pagingInfo.pageCount,
        hasNext: data.pagingInfo.page < data.pagingInfo.pageCount,
      },
    };
    
  } catch (error) {
    console.error("楽天API SimpleHotelSearch 呼び出しエラー:", error);
    throw error;
  }
}

// VacantHotelSearch API呼び出し（空室検索）
export async function searchVacancy(searchParams: SearchParams): Promise<SearchResult> {
  try {
    const params = buildCommonParams();
    
    // 必須パラメータのチェック
    if (!searchParams.checkinDate || !searchParams.checkoutDate) {
      throw new Error("checkinDate and checkoutDate are required for vacancy search");
    }
    
    // ページングパラメータ
    const page = clampValue(searchParams.page || 1, 1, 100);
    const hits = clampValue(searchParams.hits || 10, 1, 30);
    params.set("page", page.toString());
    params.set("hits", hits.toString());
    
    // 宿泊条件
    params.set("checkinDate", searchParams.checkinDate);
    params.set("checkoutDate", searchParams.checkoutDate);
    params.set("adultNum", (searchParams.adultNum || 1).toString());
    params.set("roomNum", (searchParams.roomNum || 1).toString());
    
    // 価格範囲
    if (searchParams.minCharge) {
      params.set("minCharge", searchParams.minCharge.toString());
    }
    if (searchParams.maxCharge) {
      params.set("maxCharge", searchParams.maxCharge.toString());
    }
    
    // 位置検索
    if (searchParams.lat && searchParams.lng) {
      params.set("latitude", searchParams.lat.toString());
      params.set("longitude", searchParams.lng.toString());
      
      if (searchParams.radiusKm) {
        const radius = clampValue(searchParams.radiusKm, 0.1, 3.0);
        params.set("searchRadius", radius.toString());
      }
    }
    
    // エリアコード検索
    if (searchParams.largeClassCode) {
      params.set("largeClassCode", searchParams.largeClassCode);
    }
    if (searchParams.middleClassCode) {
      params.set("middleClassCode", searchParams.middleClassCode);
    }
    if (searchParams.smallClassCode) {
      params.set("smallClassCode", searchParams.smallClassCode);
    }
    if (searchParams.detailClassCode) {
      params.set("detailClassCode", searchParams.detailClassCode);
    }
    
    const url = `${VACANT_SEARCH_URL}?${params.toString()}`;
    console.log("楽天API VacantHotelSearch URL:", url);
    
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.warn(`楽天API VacantHotelSearch エラー: ${response.status}`);
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data: RakutenResponse = await response.json();
    
    if (!data.hotels || data.hotels.length === 0) {
      return {
        items: [],
        paging: {
          total: 0,
          page: page,
          totalPages: 0,
          hasNext: false,
        },
      };
    }
    
    const hotels = data.hotels.map((hotelData) => {
      const hotel = hotelData[0].hotelBasicInfo;
      return mapRakutenToHotel(hotel);
    });
    
    return {
      items: hotels,
      paging: {
        total: data.pagingInfo.recordCount,
        page: data.pagingInfo.page,
        totalPages: data.pagingInfo.pageCount,
        hasNext: data.pagingInfo.page < data.pagingInfo.pageCount,
      },
    };
    
  } catch (error) {
    console.error("楽天API VacantHotelSearch 呼び出しエラー:", error);
    throw error;
  }
}

// HotelDetailSearch API呼び出し（ホテル詳細取得）
export async function getHotelDetail(hotelNo: number): Promise<Hotel | null> {
  try {
    const params = buildCommonParams();
    params.set("hotelNo", hotelNo.toString());
    
    const url = `${DETAIL_SEARCH_URL}?${params.toString()}`;
    console.log("楽天API HotelDetailSearch URL:", url);
    
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.warn(`楽天API HotelDetailSearch エラー: ${response.status}`);
      return null;
    }
    
    const data: RakutenResponse = await response.json();
    
    if (!data.hotels || data.hotels.length === 0) {
      return null;
    }
    
    const hotel = data.hotels[0].hotel[0];
    return mapRakutenToHotel(hotel);
    
  } catch (error) {
    console.error("楽天API HotelDetailSearch 呼び出しエラー:", error);
    return null;
  }
}

// エラー判定とフォールバック判定
// isSample が true になる条件：APP_ID がない OR fetch 失敗時のみ true
export function shouldUseFallback(): boolean {
  const APP_ID = process.env.RAKUTEN_APP_ID; // 関数内で毎回読む
  return !APP_ID;
}

// 楽天APIが利用可能かチェック
export function isRakutenApiAvailable(): boolean {
  const APP_ID = process.env.RAKUTEN_APP_ID; // 関数内で毎回読む
  return !!APP_ID;
}