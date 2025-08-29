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

// 二段階パイプライン：施設候補取得
export async function fetchCandidates(params: {
  lat?: number;
  lng?: number;
  radius?: number;
  areaCode?: string;
  rakutenAppId: string;
}): Promise<string[]> {
  const { lat, lng, radius = 3.0, areaCode, rakutenAppId } = params;
  const hotelNos = new Set<string>();

  console.log('🔍 Stage 1: Fetching hotel candidates...');

  // 優先ルート1: SimpleHotelSearch で座標検索
  if (lat && lng) {
    try {
      const searchParams = new URLSearchParams({
        applicationId: rakutenAppId,
        latitude: lat.toString(),
        longitude: lng.toString(),
        searchRadius: radius.toString(),
        datumType: '1',
        hits: '100',
        responseType: 'small'
      });

      const url = `https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426?${searchParams}`;
      console.log('🎯 Calling SimpleHotelSearch for candidates...');
      
      const response = await fetch(url, { cache: 'no-store' });
      const text = await response.text();
      
      if (response.ok) {
        const json = JSON.parse(text);
        if (json.hotels && Array.isArray(json.hotels)) {
          // ユーティリティ関数を使用して候補を抽出
          const candidates = mapHotelSearchJsonToCandidates(json);
          for (const candidate of candidates) {
            hotelNos.add(candidate);
          }
          console.log(`✅ SimpleHotelSearch: ${hotelNos.size} candidates found`);
        }
      } else {
        console.warn(`⚠️ SimpleHotelSearch failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ SimpleHotelSearch error:', error);
    }
  }

  // 優先ルート2: 地区コード検索（将来実装）
  if (areaCode && hotelNos.size < 50) {
    console.log('🏛️ Area code search not yet implemented');
    // TODO: GetAreaClass → HotelSearch with area codes
  }

  console.log(`🎯 Stage 1 completed: ${hotelNos.size} unique candidates`);
  return Array.from(hotelNos);
}

// 二段階パイプライン：空室判定
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
    count: number;
    bodySnippet?: string;
  }>;
}> {
  const { checkinDate, checkoutDate, adultNum, roomNum, rakutenAppId } = params;
  const vacantHotels: any[] = [];
  const chunks: any[] = [];
  const chunkSize = 15; // VacantHotelSearchの制限

  console.log(`🔍 Stage 2: Checking vacancy for ${hotelNos.length} candidates...`);

  // チャンクに分割して並列処理
  const chunkPromises: Promise<void>[] = [];
  
  for (let i = 0; i < hotelNos.length; i += chunkSize) {
    const chunkHotelNos = hotelNos.slice(i, i + chunkSize);
    const chunkIndex = Math.floor(i / chunkSize);
    
    chunkPromises.push(
      (async () => {
        try {
          const vacantParams = new URLSearchParams({
            applicationId: rakutenAppId,
            checkinDate,
            checkoutDate,
            adultNum: adultNum.toString(),
            roomNum: roomNum.toString(),
            hotelNo: chunkHotelNos.join(','),
            responseType: 'small'
          });

          const url = `https://app.rakuten.co.jp/services/api/Travel/VacantHotelSearch/20170426?${vacantParams}`;
          
          console.log(`🎯 Chunk ${chunkIndex + 1}: Checking ${chunkHotelNos.length} hotels...`);
          
          const t0 = Date.now();
          const response = await fetch(url, { cache: 'no-store' });
          const elapsedMs = Date.now() - t0;
          const text = await response.text();
          
          const chunkResult = {
            from: i,
            to: i + chunkHotelNos.length - 1,
            hotelNos: chunkHotelNos,
            status: response.status,
            elapsedMs,
            count: 0,
            ...(isInspectMode && { bodySnippet: text.slice(0, 300) })
          };

          if (response.status === 200) {
            const json = JSON.parse(text);
            if (json.hotels && Array.isArray(json.hotels)) {
              for (const hotel of json.hotels) {
                vacantHotels.push(hotel);
              }
              chunkResult.count = json.hotels.length;
              console.log(`✅ Chunk ${chunkIndex + 1}: ${json.hotels.length} vacant hotels found`);
            } else {
              console.log(`ℹ️ Chunk ${chunkIndex + 1}: 0 vacant hotels`);
            }
          } else if (response.status === 404) {
            console.log(`📍 Chunk ${chunkIndex + 1}: Not found (404) - treated as 0 vacant`);
          } else if (response.status === 429 || response.status >= 500) {
            console.warn(`⚠️ Chunk ${chunkIndex + 1}: API error (${response.status}), attempting retry...`);
            
            // 1回だけリトライ
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
            
            const retryT0 = Date.now();
            const retryResponse = await fetch(url, { cache: 'no-store' });
            const retryElapsedMs = Date.now() - retryT0;
            const retryText = await retryResponse.text();
            
            chunkResult.status = retryResponse.status;
            chunkResult.elapsedMs += retryElapsedMs;
            if (isInspectMode) {
              chunkResult.bodySnippet = retryText.slice(0, 300);
            }

            if (retryResponse.status === 200) {
              const retryJson = JSON.parse(retryText);
              if (retryJson.hotels && Array.isArray(retryJson.hotels)) {
                for (const hotel of retryJson.hotels) {
                  vacantHotels.push(hotel);
                }
                chunkResult.count = retryJson.hotels.length;
                console.log(`✅ Chunk ${chunkIndex + 1} retry: ${retryJson.hotels.length} vacant hotels found`);
              }
            } else {
              console.error(`❌ Chunk ${chunkIndex + 1} retry failed: ${retryResponse.status}`);
            }
          } else {
            console.warn(`⚠️ Chunk ${chunkIndex + 1}: Parameter error (${response.status})`);
          }

          chunks.push(chunkResult);
        } catch (error) {
          console.error(`❌ Chunk ${chunkIndex + 1} error:`, error);
          chunks.push({
            from: i,
            to: i + chunkHotelNos.length - 1,
            hotelNos: chunkHotelNos,
            status: 0,
            elapsedMs: 0,
            count: 0,
            ...(isInspectMode && { bodySnippet: error instanceof Error ? error.message : String(error) })
          });
        }
      })()
    );
  }

  // 全チャンクの完了を待つ
  await Promise.all(chunkPromises);

  console.log(`🎯 Stage 2 completed: ${vacantHotels.length} vacant hotels from ${chunks.length} chunks`);

  return {
    vacantHotels,
    chunks: chunks.sort((a, b) => a.from - b.from) // from順にソート
  };
}