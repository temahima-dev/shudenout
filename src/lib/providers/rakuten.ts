/**
 * 楽天トラベル用のリンク生成ユーティリティ
 * VacantHotelSearchから取得したホテル情報を適切なリンクに変換
 */

import { mapHotelSearchJsonToCandidates } from './rakuten-utils';

interface HotelBasicInfo {
  hotelNo: number;
  hotelName: string;
  hotelInformationUrl: string;
  planListUrl: string;
  dpPlanListUrl: string;
  hotelAffiliateUrl?: {
    pc?: string;
    mobile?: string;
  };
}

interface LinkGenerationOptions {
  checkinDate: string;
  checkoutDate: string;
  adultNum: number;
  roomNum?: number;
  affiliateId?: string;
}

/**
 * ホテル情報URLからホテルIDを抽出
 */
function extractHotelId(url: string): string | null {
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
 * 楽天トラベルの直接ホテルページURLを生成
 */
function generateDirectHotelUrl(hotelId: string, options: LinkGenerationOptions): string {
  const baseUrl = `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
  const params = new URLSearchParams();

  // 宿泊日程を追加
  params.set('checkin_date', options.checkinDate.replace(/-/g, ''));
  params.set('checkout_date', options.checkoutDate.replace(/-/g, ''));
  params.set('adult_num', options.adultNum.toString());
  
  if (options.roomNum) {
    params.set('room_num', options.roomNum.toString());
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * アフィリエイトリンクを構築（最終固定版）
 * 必ず `/hgc/${affId}/?pc=` 形式でアフィリエイトIDの後にスラッシュを含める
 */
function buildAffiliateUrl(targetUrl: string, affId: string): string {
  try {
    // 既存のhb.aflリンクをチェック（正規形式でない場合は再生成）
    if (targetUrl.includes('hb.afl.rakuten.co.jp')) {
      const urlObj = new URL(targetUrl);
      const pcParam = urlObj.searchParams.get('pc');
      
      // pc パラメータからデコードした結果がtravel.rakuten.co.jpでない場合は再生成
      if (pcParam) {
        try {
          const decodedPc = decodeURIComponent(pcParam);
          if (decodedPc.includes('travel.rakuten.co.jp/HOTEL/')) {
            // 正規形式かチェック（trailing slash確認）
            const pathMatch = urlObj.pathname.match(/\/hgc\/([^\/]+)\/$/);
            if (pathMatch && pathMatch[1] === affId) {
              console.log('✅ Already properly formatted affiliate link:', targetUrl);
              return targetUrl;
            }
          }
        } catch (decodeError) {
          console.warn('Failed to decode pc parameter, regenerating:', decodeError);
        }
      }
      
      // 不正形式の場合は再生成のため targetUrl をデコード
      if (pcParam) {
        try {
          targetUrl = decodeURIComponent(pcParam);
        } catch (decodeError) {
          console.warn('Cannot decode existing pc parameter:', decodeError);
        }
      }
    }

    // ホテル詳細URLに正規化
    if (!targetUrl.includes('travel.rakuten.co.jp/HOTEL/')) {
      console.warn('⚠️ Non-hotel URL detected, skipping affiliate conversion:', targetUrl);
      return targetUrl;
    }

    // 1回だけエンコード（必須形式）
    const encodedUrl = encodeURIComponent(targetUrl);
    // 必ずtrailing slashを含める（ /hgc/${affId}/?pc= 形式）
    const affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${affId}/?pc=${encodedUrl}`;
    
    console.log('🔗 Building standardized affiliate link:', {
      originalTarget: targetUrl,
      isHotelDetail: targetUrl.includes('travel.rakuten.co.jp/HOTEL/'),
      encodedUrl: encodedUrl,
      finalAffiliate: affiliateUrl,
      hasTrailingSlash: true,
      isDoubleEncoded: false,
      affiliateFormat: `/hgc/${affId}/?pc=`
    });
    
    return affiliateUrl;
  } catch (error) {
    console.error('❌ Failed to build affiliate link:', error);
    return targetUrl;
  }
}

/**
 * アフィリエイトリンクに変換（buildAffiliateUrlのラッパー）
 */
function convertToAffiliateLink(directUrl: string, affiliateId?: string): string {
  if (!affiliateId) {
    return directUrl;
  }

  return buildAffiliateUrl(directUrl, affiliateId);
}

/**
 * URLにクエリパラメータを安全に追加
 */
function addSearchParams(url: string, options: LinkGenerationOptions): string {
  try {
    const urlObj = new URL(url);
    
    // 既存のパラメータを上書きしないように条件付きで追加
    if (!urlObj.searchParams.has('checkin_date') && !urlObj.searchParams.has('f_checkin')) {
      urlObj.searchParams.set('checkin_date', options.checkinDate.replace(/-/g, ''));
    }
    if (!urlObj.searchParams.has('checkout_date') && !urlObj.searchParams.has('f_checkout')) {
      urlObj.searchParams.set('checkout_date', options.checkoutDate.replace(/-/g, ''));
    }
    if (!urlObj.searchParams.has('adult_num') && !urlObj.searchParams.has('f_otona')) {
      urlObj.searchParams.set('adult_num', options.adultNum.toString());
    }
    
    if (options.roomNum && !urlObj.searchParams.has('room_num') && !urlObj.searchParams.has('f_heya')) {
      urlObj.searchParams.set('room_num', options.roomNum.toString());
    }
    
    return urlObj.toString();
  } catch (error) {
    console.warn('Failed to add parameters to URL:', url, error);
    return url; // 元のURLをそのまま返す
  }
}

/**
 * 楽天ホテルリンクを生成（ホテル詳細URLのみ使用・最終版）
 * 優先順位: ホテルID抽出→詳細URL生成 > hotelInformationUrl（詳細URLのみ） > 緊急フォールバック
 */
export function generateRakutenHotelLink(
  hotelInfo: HotelBasicInfo,
  options: LinkGenerationOptions
): {
  finalUrl: string;
  source: 'affiliate' | 'direct' | 'fallback';
  debug: {
    sourceUrl: string;
    finalUrl: string;
    status: string;
    usedSource: string;
    hasAffiliate: boolean;
    extractedId?: string;
    hasTrailingSlash?: boolean;
    isDoubleEncoded?: boolean;
  };
} {
  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID;

  // 1. hotelNo（楽天ホテルID）からホテル詳細URLを直接生成（最優先）
  if (hotelInfo.hotelNo) {
    const hotelId = hotelInfo.hotelNo.toString();
    const directUrl = `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.log('✅ Using hotelNo for hotel detail URL:', {
      hotelNo: hotelInfo.hotelNo,
      directUrl,
      finalUrl,
      hasAffiliate: !!affiliateId
    });

      return {
      finalUrl,
      source: 'direct',
      debug: {
        sourceUrl: `hotelNo: ${hotelInfo.hotelNo}`,
        finalUrl,
        status: 'direct',
        usedSource: 'hotelNo → hotel detail URL',
        hasAffiliate: !!affiliateId,
        extractedId: hotelId,
        hasTrailingSlash: finalUrl.includes('hgc/') && finalUrl.includes('/?pc='),
        isDoubleEncoded: false
      }
    };
  }

  // 2. hotelInformationUrl からID抽出（ホテル詳細URLのみ許可）
  const hotelId = extractHotelId(hotelInfo.hotelInformationUrl || '');
  if (hotelId && hotelInfo.hotelInformationUrl?.includes('travel.rakuten.co.jp/HOTEL/')) {
    const sourceUrl = hotelInfo.hotelInformationUrl;
    // パラメータは付けずにホテル詳細URLのみ使用
    const directUrl = `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.log('✅ Using hotelInformationUrl → hotel detail URL:', {
      sourceUrl,
      extractedId: hotelId,
      directUrl,
      finalUrl,
      hasAffiliate: !!affiliateId
    });
    
    return {
      finalUrl,
      source: 'direct',
      debug: {
        sourceUrl,
        finalUrl,
        status: 'direct',
        usedSource: 'hotelInformationUrl → hotel detail URL',
        hasAffiliate: !!affiliateId,
        extractedId: hotelId,
        hasTrailingSlash: finalUrl.includes('hgc/') && finalUrl.includes('/?pc='),
        isDoubleEncoded: false
      }
    };
  }

  // 3. 既存のhb.aflリンクの再構築（正規化）
  if (hotelInfo.hotelAffiliateUrl?.pc && hotelInfo.hotelAffiliateUrl.pc.includes('hb.afl.rakuten.co.jp')) {
    const sourceUrl = hotelInfo.hotelAffiliateUrl.pc;
    const finalUrl = convertToAffiliateLink(sourceUrl, affiliateId);
    
    console.log('🔄 Rebuilding existing affiliate link:', {
      sourceUrl,
      finalUrl,
      hasAffiliate: !!affiliateId
    });

    return {
      finalUrl,
      source: 'affiliate',
      debug: {
        sourceUrl,
        finalUrl,
        status: 'affiliate_rebuilt',
        usedSource: 'hotelAffiliateUrl.pc (rebuilt)',
        hasAffiliate: !!affiliateId,
        hasTrailingSlash: finalUrl.includes('hgc/') && finalUrl.includes('/?pc='),
        isDoubleEncoded: false
      }
    };
  }

  // 4. 緊急フォールバック: 楽天トラベルトップページ
  const fallbackUrl = 'https://travel.rakuten.co.jp/';
  const finalUrl = convertToAffiliateLink(fallbackUrl, affiliateId);
  
  console.error('❌ No valid hotel URL found, using rakuten travel top page');

  return {
    finalUrl,
    source: 'fallback',
    debug: {
      sourceUrl: 'none',
      finalUrl,
      status: 'emergency_fallback',
      usedSource: 'travel.rakuten.co.jp (emergency)',
      hasAffiliate: !!affiliateId,
      hasTrailingSlash: finalUrl.includes('hgc/') && finalUrl.includes('/?pc='),
      isDoubleEncoded: false
    }
  };
}

/**
 * リンクの有効性を検証
 */
export function validateRakutenLink(url: string): {
  isValid: boolean;
  isRakutenTravel: boolean;
  isAffiliate: boolean;
  reason?: string;
} {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    const isRakutenTravel = hostname === 'travel.rakuten.co.jp' || hostname === 'hotel.travel.rakuten.co.jp';
    const isAffiliate = hostname === 'hb.afl.rakuten.co.jp';
    const isValid = isRakutenTravel || isAffiliate;

    if (!isValid) {
      return {
        isValid: false,
        isRakutenTravel: false,
        isAffiliate: false,
        reason: `Invalid hostname: ${hostname}`
      };
    }

    // アフィリエイトリンクの場合、pc パラメータの中身もチェック
    if (isAffiliate) {
      const pcParam = urlObj.searchParams.get('pc');
      if (pcParam) {
        try {
          const decodedPc = decodeURIComponent(pcParam);
          const pcUrlObj = new URL(decodedPc);
          const pcHostname = pcUrlObj.hostname;
          
          if (pcHostname !== 'travel.rakuten.co.jp' && pcHostname !== 'hotel.travel.rakuten.co.jp') {
    return {
              isValid: false,
              isRakutenTravel: false,
              isAffiliate: true,
              reason: `Invalid pc parameter hostname: ${pcHostname}`
            };
          }
  } catch (error) {
          return {
            isValid: false,
            isRakutenTravel: false,
            isAffiliate: true,
            reason: 'Invalid pc parameter format'
          };
        }
      }
    }

    return {
      isValid: true,
      isRakutenTravel,
      isAffiliate
    };
  } catch (error) {
    return {
      isValid: false,
      isRakutenTravel: false,
      isAffiliate: false,
      reason: 'Invalid URL format'
    };
  }
}

/**
 * 固定のサンプルリンクを生成（デバッグ用）
 */
export function generateSampleHotelLink(
  hotelId: string,
  hotelName: string,
  options: LinkGenerationOptions
): string {
  const directUrl = generateDirectHotelUrl(hotelId, options);
  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID;
  
  return convertToAffiliateLink(directUrl, affiliateId);
}

// 二段階パイプライン：施設候補取得（堅牢化版）
export async function fetchCandidates(params: {
  lat?: number;
  lng?: number;
  radius?: number;
  areaCode?: string;
  rakutenAppId: string;
}, isInspectMode: boolean = false): Promise<{
  candidateNos: string[];
  debugInfo: {
    source: 'SimpleHotelSearch' | 'AreaCode';
    url: string;
    paramsUsed: Record<string, string>;
    attempts: Array<{
      page: number;
      status: number;
      elapsedMs: number;
      bodySnippetHead: string;
      foundCount: number;
    }>;
    totalElapsedMs: number;
    totalPages: number;
  };
}> {
  const { lat, lng, radius = 3.0, areaCode, rakutenAppId } = params;
  const hotelNos = new Set<string>();
  const debugAttempts: any[] = [];
  const startTime = Date.now();

  console.log('🔍 Stage 1: Fetching hotel candidates...');

  let apiSource: 'SimpleHotelSearch' | 'AreaCode' = 'SimpleHotelSearch';
  let baseUrl = '';
  let baseParams: Record<string, string> = {};

  // 優先ルート1: SimpleHotelSearch（座標検索）
  if (lat && lng || areaCode) {
    // 楽天SimpleHotelSearch APIの必須パラメータを構築
    baseParams = {
      applicationId: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID || '',
      format: "json",
      latitude: lat?.toString() || "35.6905", // 新宿デフォルト
      longitude: lng?.toString() || "139.7004", // 新宿デフォルト
      searchRadius: "3", // 固定3km
      datumType: '1', // WGS84度単位（必須）
      hits: '30',
      page: '1',
      responseType: 'small'
    };

    apiSource = 'SimpleHotelSearch';
    baseUrl = process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL || 'https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426';

    console.log(`🎯 Using SimpleHotelSearch for candidates...`);

    // 最大3ページまで試行
    for (let page = 1; page <= 3; page++) {
      try {
        const searchParams = new URLSearchParams(baseParams);
        searchParams.set('page', page.toString());

        const url = `${baseUrl}?${searchParams}`;
        console.log("FETCH URL:", url);
        const pageStartTime = Date.now();
        
        const response = await fetch(url, { cache: 'no-store' });
        const elapsedMs = Date.now() - pageStartTime;
        const text = await response.text();
        
        const attempt = {
          page,
          status: response.status,
          elapsedMs,
          bodySnippetHead: text.slice(0, 300),
          foundCount: 0
        };

        if (response.ok) {
          try {
            const json = JSON.parse(text);
            if (json.hotels && Array.isArray(json.hotels)) {
              const candidates = mapHotelSearchJsonToCandidates(json);
              const beforeSize = hotelNos.size;
              for (const candidate of candidates) {
                hotelNos.add(candidate);
              }
              attempt.foundCount = hotelNos.size - beforeSize;
              console.log(`✅ SimpleHotelSearch page ${page}: ${attempt.foundCount} new candidates (total: ${hotelNos.size})`);
              
              // 新しい候補が見つからなくなったら次のページは不要
              if (attempt.foundCount === 0 && page > 1) {
                debugAttempts.push(attempt);
                break;
              }
            } else {
              console.log(`ℹ️ SimpleHotelSearch page ${page}: No hotels in response`);
            }
            
            debugAttempts.push(attempt);
            
          } catch (parseError) {
            console.error(`❌ SimpleHotelSearch page ${page} JSON parse error:`, parseError);
            attempt.foundCount = 0;
            debugAttempts.push(attempt);
            break; // JSONエラーで次ページは不要
          }
        } else {
          console.warn(`⚠️ SimpleHotelSearch page ${page} failed: ${response.status}`);
          debugAttempts.push(attempt);
          
          // 4xx/5xxエラーでは次ページは期待できない
          if (response.status >= 400) {
            break;
          }
        }
      } catch (error) {
        console.error(`❌ SimpleHotelSearch page ${page} error:`, error);
        debugAttempts.push({
          page,
          status: 0,
          elapsedMs: 0,
          bodySnippetHead: error instanceof Error ? error.message : String(error),
          foundCount: 0
        });
        break; // ネットワークエラーで次ページは不要
      }
    }
  }

  // 優先ルート2: エリアコード検索（フォールバック）
  if ((areaCode && hotelNos.size < 10) || hotelNos.size === 0) {
    console.log('🏛️ Attempting area code fallback...');
    
    // エリアコードマッピング
    const areaCodeMap: Record<string, string> = {
      'shinjuku': 'tokyo',
      'shibuya': 'tokyo',
      'ueno': 'tokyo',
      'shinbashi': 'tokyo',
      'ikebukuro': 'tokyo',
      'roppongi': 'tokyo',
      'all': 'tokyo'
    };
    
    const targetAreaCode = areaCodeMap[areaCode || 'all'] || 'tokyo';
    
    try {
      const areaParams = {
        applicationId: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID || '',
        largeClassCode: targetAreaCode,
        hits: '30',
        page: '1',
        responseType: 'small'
      };
      
      const areaSearchParams = new URLSearchParams(areaParams);
      const rakutenBaseUrl = process.env.NEXT_PUBLIC_RAKUTEN_BASE_URL || 'https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426';
      const areaUrl = `${rakutenBaseUrl}?${areaSearchParams}`;
      
      console.log(`🎯 Trying area code fallback for ${targetAreaCode}...`);
      
      const areaStartTime = Date.now();
      const areaResponse = await fetch(areaUrl, { cache: 'no-store' });
      const areaElapsedMs = Date.now() - areaStartTime;
      const areaText = await areaResponse.text();
      
      const areaAttempt = {
        page: 1,
        status: areaResponse.status,
        elapsedMs: areaElapsedMs,
        bodySnippetHead: areaText.slice(0, 300),
        foundCount: 0
      };
      
      if (areaResponse.ok) {
        try {
          const areaJson = JSON.parse(areaText);
          if (areaJson.hotels && Array.isArray(areaJson.hotels)) {
            const areaCandidates = mapHotelSearchJsonToCandidates(areaJson);
            const beforeAreaSize = hotelNos.size;
            for (const candidate of areaCandidates) {
              hotelNos.add(candidate);
            }
            areaAttempt.foundCount = hotelNos.size - beforeAreaSize;
            console.log(`✅ Area code fallback: ${areaAttempt.foundCount} new candidates (total: ${hotelNos.size})`);
            
            apiSource = 'AreaCode';
            baseUrl = areaUrl;
            baseParams = areaParams;
          }
        } catch (parseError) {
          console.error(`❌ Area code fallback JSON parse error:`, parseError);
        }
      } else {
        console.warn(`⚠️ Area code fallback failed: ${areaResponse.status}`);
      }
      
      debugAttempts.push(areaAttempt);
      
    } catch (error) {
      console.error(`❌ Area code fallback error:`, error);
      debugAttempts.push({
        page: 1,
        status: 0,
        elapsedMs: 0,
        bodySnippetHead: error instanceof Error ? error.message : String(error),
        foundCount: 0
      });
    }
  }

  const totalElapsedMs = Date.now() - startTime;
  console.log(`🎯 Stage 1 completed: ${hotelNos.size} unique candidates in ${totalElapsedMs}ms`);

  return {
    candidateNos: Array.from(hotelNos),
    debugInfo: {
      source: apiSource,
      url: baseUrl,
      paramsUsed: baseParams,
      attempts: debugAttempts,
      totalElapsedMs,
      totalPages: debugAttempts.length
    }
  };
}

// 二段階パイプライン：空室判定（堅牢化版）
export async function checkVacancy(
  hotelNos: string[],
  params: {
    checkinDate: string;
    checkoutDate: string;
    adultNum: number;
    roomNum: number;
    rakutenAppId: string;
  },
  isInspectMode: boolean = false
): Promise<{
  vacantHotels: any[];
  chunks: Array<{
    from: number;
    to: number;
    hotelNos: string[];
    status: number;
    elapsedMs: number;
    foundCount: number;
    bodySnippetHead?: string;
    retryAttempted?: boolean;
    retrySuccess?: boolean;
  }>;
}> {
  const { checkinDate, checkoutDate, adultNum, roomNum, rakutenAppId } = params;
  const vacantHotels: any[] = [];
  const chunks: any[] = [];
  const chunkSize = 15; // VacantHotelSearchの制限
  const maxConcurrency = 3; // 並列度を制限

  console.log(`🔍 Stage 2: Checking vacancy for ${hotelNos.length} candidates in ${Math.ceil(hotelNos.length / chunkSize)} chunks...`);

  // チャンクに分割
  const allChunks: Array<{ hotelNos: string[]; from: number; to: number; index: number }> = [];
  for (let i = 0; i < hotelNos.length; i += chunkSize) {
    const chunkHotelNos = hotelNos.slice(i, i + chunkSize);
    allChunks.push({
      hotelNos: chunkHotelNos,
      from: i,
      to: i + chunkHotelNos.length - 1,
      index: Math.floor(i / chunkSize)
    });
  }

  // 並列度制御でチャンクを処理
  const processChunk = async (chunk: typeof allChunks[0]) => {
    const { hotelNos: chunkHotelNos, from, to, index } = chunk;
    
    try {
      const vacantParams = new URLSearchParams({
        applicationId: process.env.NEXT_PUBLIC_RAKUTEN_APP_ID || '',
        checkinDate,
        checkoutDate,
        adultNum: adultNum.toString(),
        roomNum: roomNum.toString(),
        hotelNo: chunkHotelNos.join(','),
        responseType: 'small'
      });

      const vacantBaseUrl = 'https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426';
      const url = `${vacantBaseUrl}?${vacantParams}`;
      
      console.log(`🎯 Chunk ${index + 1}/${allChunks.length}: Checking ${chunkHotelNos.length} hotels...`);
      
      let totalElapsedMs = 0;
      let finalStatus = 0;
      let finalText = '';
      let retryAttempted = false;
      let retrySuccess = false;
      let foundHotels: any[] = [];

      // 初回試行
      const t0 = Date.now();
      const response = await fetch(url, { cache: 'no-store' });
      const elapsedMs = Date.now() - t0;
      totalElapsedMs += elapsedMs;
      const text = await response.text();
      
      finalStatus = response.status;
      finalText = text;

      if (response.status === 200) {
        try {
          const json = JSON.parse(text);
          if (json.hotels && Array.isArray(json.hotels)) {
            foundHotels = json.hotels;
            console.log(`✅ Chunk ${index + 1}: ${json.hotels.length} vacant hotels found`);
          } else {
            console.log(`ℹ️ Chunk ${index + 1}: 0 vacant hotels`);
          }
        } catch (parseError) {
          console.error(`❌ Chunk ${index + 1} JSON parse error:`, parseError);
        }
      } else if (response.status === 404) {
        console.log(`📍 Chunk ${index + 1}: Not found (404) - treated as 0 vacant`);
      } else if (response.status === 429 || response.status >= 500) {
        console.warn(`⚠️ Chunk ${index + 1}: API error (${response.status}), attempting retry...`);
        
        // リトライ実行
        retryAttempted = true;
        const jitterDelay = 300 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
        
        const retryT0 = Date.now();
        const retryResponse = await fetch(url, { cache: 'no-store' });
        const retryElapsedMs = Date.now() - retryT0;
        totalElapsedMs += retryElapsedMs;
        const retryText = await retryResponse.text();
        
        finalStatus = retryResponse.status;
        finalText = retryText;

        if (retryResponse.status === 200) {
          retrySuccess = true;
          try {
            const retryJson = JSON.parse(retryText);
            if (retryJson.hotels && Array.isArray(retryJson.hotels)) {
              foundHotels = retryJson.hotels;
              console.log(`✅ Chunk ${index + 1} retry: ${retryJson.hotels.length} vacant hotels found`);
            }
          } catch (parseError) {
            console.error(`❌ Chunk ${index + 1} retry JSON parse error:`, parseError);
          }
        } else {
          console.error(`❌ Chunk ${index + 1} retry failed: ${retryResponse.status}`);
        }
      } else {
        console.warn(`⚠️ Chunk ${index + 1}: Parameter error (${response.status})`);
      }

      // スレッドセーフに結果を追加
      for (const hotel of foundHotels) {
        vacantHotels.push(hotel);
      }

      const chunkResult = {
        from,
        to,
        hotelNos: chunkHotelNos,
        status: finalStatus,
        elapsedMs: totalElapsedMs,
        foundCount: foundHotels.length,
        ...(isInspectMode && { bodySnippetHead: finalText.slice(0, 300) }),
        ...(retryAttempted && { retryAttempted, retrySuccess })
      };

      chunks.push(chunkResult);
      
    } catch (error) {
      console.error(`❌ Chunk ${index + 1} error:`, error);
      chunks.push({
        from,
        to,
        hotelNos: chunkHotelNos,
        status: 0,
        elapsedMs: 0,
        foundCount: 0,
        ...(isInspectMode && { bodySnippetHead: error instanceof Error ? error.message : String(error) })
      });
    }
  };

  // 並列度制御でチャンクを実行
  const results = [];
  for (let i = 0; i < allChunks.length; i += maxConcurrency) {
    const batch = allChunks.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(processChunk);
    results.push(...await Promise.allSettled(batchPromises));
  }

  console.log(`🎯 Stage 2 completed: ${vacantHotels.length} vacant hotels from ${chunks.length} chunks`);

  return {
    vacantHotels,
    chunks: chunks.sort((a, b) => a.from - b.from) // from順にソート
  };
}