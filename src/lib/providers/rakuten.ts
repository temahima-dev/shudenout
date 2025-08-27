import 'server-only';
import { Hotel } from "@/app/data/hotels";
import { safeHotelLink, createFinalHrefSample } from "@/lib/url";

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
  withDebug?: boolean;
  rawMode?: boolean;
}

interface RakutenHotel {
  hotelNo: number;
  hotelName: string;
  hotelInformationUrl: string;
  planListUrl: string;
  dpPlanListUrl: string;
  reviewUrl: string;
  // 楽天APIから提供される可能性のあるアフィリエイトURL関連フィールド
  hotelAffiliateUrl?: string;
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

// ホテルIDを楽天URLから抽出する
function extractHotelId(url: string, fallbackHotelNo: number): number {
  try {
    const urlObj = new URL(url);
    
    // 1. HOTEL/{id}/{id}.html パターン
    const hotelMatch = urlObj.pathname.match(/\/HOTEL\/(\d+)\/\d+\.html/);
    if (hotelMatch) {
      return parseInt(hotelMatch[1], 10);
    }
    
    // 2. f_no={id} クエリパラメータ
    const fNoParam = urlObj.searchParams.get('f_no');
    if (fNoParam) {
      return parseInt(fNoParam, 10);
    }
    
    // 3. hb.aflリンクのpc=パラメータから抽出
    if (urlObj.hostname === 'hb.afl.rakuten.co.jp') {
      const pcParam = urlObj.searchParams.get('pc');
      if (pcParam) {
        return extractHotelId(decodeURIComponent(pcParam), fallbackHotelNo);
      }
    }
    
  } catch {
    // URL解析エラーは無視
  }
  
  // 抽出できない場合はフォールバック
  return fallbackHotelNo;
}

// 安全なホテル詳細URLを生成する
function generateSafeHotelUrl(hotelId: number): string {
  return `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
}

// hb.aflリンクのpc=パラメータを検証・修正する
function validateAffiliateTargetUrl(affiliateUrl: string, hotelId: number): string {
  try {
    const urlObj = new URL(affiliateUrl);
    
    // hb.aflリンクでない場合はそのまま返す
    if (urlObj.hostname !== 'hb.afl.rakuten.co.jp') {
      return affiliateUrl;
    }
    
    const pcParam = urlObj.searchParams.get('pc');
    if (!pcParam) {
      return affiliateUrl;
    }
    
    const targetUrl = decodeURIComponent(pcParam);
    const targetUrlObj = new URL(targetUrl);
    
    // 許可されたホスト以外（画像APIなど）の場合は修正
    const allowedHosts = ['travel.rakuten.co.jp', 'hotel.travel.rakuten.co.jp'];
    if (!allowedHosts.includes(targetUrlObj.hostname)) {
      console.warn(`🔗 不正なターゲットURL検出: ${targetUrlObj.hostname}, 修正中...`);
      
      // 安全なホテル詳細URLに置き換え
      const safeTargetUrl = generateSafeHotelUrl(hotelId);
      urlObj.searchParams.set('pc', encodeURIComponent(safeTargetUrl));
      
      return urlObj.toString();
    }
    
    return affiliateUrl;
  } catch (error) {
    console.warn(`🔗 アフィリエイトURL検証エラー: ${error}, フォールバック中...`);
    return affiliateUrl;
  }
}

// 楽天APIから有効なホテル詳細URLを取得する（レガシー関数）
function extractValidHotelUrl(rakutenHotel: RakutenHotel): string {
  const hotelId = extractHotelId(rakutenHotel.hotelInformationUrl || '', rakutenHotel.hotelNo);
  return generateSafeHotelUrl(hotelId);
}

// 楽天ホテルデータをアプリのHotel型にマッピング
function mapRakutenToHotel(rakutenHotel: RakutenHotel, withDebug = false, rawMode = false): Hotel {
  // エリアを住所から抽出
  const area = extractAreaFromAddress(rakutenHotel.address1);
  
  // 設備情報（楽天APIからは詳細取得が必要なため、デフォルト設定）
  const amenities: Array<"シャワー" | "WiFi" | "2人可"> = ["WiFi"];
  
  // アフィリエイトURL生成ロジック
  let affiliateUrl = '';
  
  // ホテルIDを抽出して安全なターゲットURLを生成
  const hotelId = extractHotelId(
    rakutenHotel.hotelInformationUrl || rakutenHotel.hotelAffiliateUrl || '', 
    rakutenHotel.hotelNo
  );
  const safeTargetUrl = generateSafeHotelUrl(hotelId);
  
  if (rawMode) {
    // 【RAWモード】：hb.afl優先、ターゲットURLを安全化
    const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
    
    if (rakutenHotel.hotelAffiliateUrl && rakutenHotel.hotelAffiliateUrl.includes('hb.afl.rakuten.co.jp')) {
      // APIのhb.aflリンクを検証・修正
      affiliateUrl = validateAffiliateTargetUrl(rakutenHotel.hotelAffiliateUrl, hotelId);
    } else if (rakutenHotel.planListUrl && rakutenHotel.planListUrl.includes('hb.afl.rakuten.co.jp')) {
      // planListUrlも検証・修正
      affiliateUrl = validateAffiliateTargetUrl(rakutenHotel.planListUrl, hotelId);
    } else if (AFF_ID) {
      // 環境変数でhb.aflリンクを生成（安全なターゲットURL使用）
      affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${AFF_ID}/?pc=${encodeURIComponent(safeTargetUrl)}`;
    } else {
      // フォールバック：安全な直接リンク
      affiliateUrl = safeTargetUrl;
    }
    // rawModeでは safeHotelLink を通さない
  } else {
    // 【通常モード】：アフィリエイト化
    const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID;
    
    // 1. APIからhb.aflアフィリエイトリンクを最優先で使用（ターゲット検証）
    if (rakutenHotel.hotelAffiliateUrl && rakutenHotel.hotelAffiliateUrl.includes('hb.afl.rakuten.co.jp')) {
      affiliateUrl = validateAffiliateTargetUrl(rakutenHotel.hotelAffiliateUrl, hotelId);
    }
    // 2. planListUrlがhb.aflリンクの場合も使用（ターゲット検証）
    else if (rakutenHotel.planListUrl && rakutenHotel.planListUrl.includes('hb.afl.rakuten.co.jp')) {
      affiliateUrl = validateAffiliateTargetUrl(rakutenHotel.planListUrl, hotelId);
    }
    // 3. 環境変数があれば必ずhb.aflリンクを生成（安全なターゲットURL）
    else if (AFF_ID) {
      affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${AFF_ID}/?pc=${encodeURIComponent(safeTargetUrl)}`;
    }
    // 4. 環境変数未設定時のみ直接リンク（フォールバック）
    else {
      affiliateUrl = safeTargetUrl;
    }
    
    // hb.aflリンクの場合はsafeHotelLinkを通さない（アフィリエイトリンクを保持）
    if (!affiliateUrl.includes('hb.afl.rakuten.co.jp')) {
      // 最終安全性チェック（許可ドメイン以外は修正）
      affiliateUrl = safeHotelLink(affiliateUrl, rakutenHotel.hotelNo, {
        hotelAffiliateUrl: rakutenHotel.hotelAffiliateUrl,
        hotelInformationUrl: rakutenHotel.hotelInformationUrl
      });
    }
  }
  
  const hotel: Hotel = {
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
  };
  
  // デバッグ情報の追加（debugLinks=1の時のみ）
  if (withDebug) {
    const finalHrefSample = createFinalHrefSample(
      affiliateUrl, 
      rakutenHotel.hotelNo,
      new Date().toISOString().split('T')[0], // 今日
      new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0], // 明日
      2 // 2名
    );
    
    hotel.debugInfo = {
      fromApi: {
        hotelAffiliateUrl: rakutenHotel.hotelAffiliateUrl,
        hotelInformationUrl: rakutenHotel.hotelInformationUrl,
        planListUrl: rakutenHotel.planListUrl,
      },
      extractedValidUrl: extractValidHotelUrl(rakutenHotel), // 有効URL抽出結果
      afterNormalize: affiliateUrl,
      finalHrefSample: finalHrefSample,
      affiliateIdPresent: Boolean(process.env.RAKUTEN_AFFILIATE_ID), // アフィリエイトID設定状況
      selectedFrom: affiliateUrl.includes('hb.afl.rakuten.co.jp') ? 'hb.afl' : 'travel.rakuten', // 選択元
      envAffiliateId: Boolean(process.env.RAKUTEN_AFFILIATE_ID), // 環境変数設定状況
      extractedHotelId: hotelId, // 抽出されたホテルID
      finalTarget: safeTargetUrl, // 最終ターゲットURL
    };
  }
  
  return hotel;
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
  
  if (!APP_ID) {
    throw new Error("RAKUTEN_APP_ID missing in environment variables");
  }
  
  const params = new URLSearchParams({
    applicationId: APP_ID,
    format: "json",
    formatVersion: "2",
    datumType: "1", // WGS84・度
  });
  
  if (AFF_ID) {
    params.set("affiliateId", AFF_ID);
  }
  
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
      return mapRakutenToHotel(hotel, searchParams.withDebug, searchParams.rawMode);
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
      return mapRakutenToHotel(hotel, searchParams.withDebug, searchParams.rawMode);
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
    return mapRakutenToHotel(hotel, false); // HotelDetailSearchではデバッグ不要
    
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