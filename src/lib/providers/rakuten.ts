/**
 * 楽天トラベル用のリンク生成ユーティリティ
 * VacantHotelSearchから取得したホテル情報を適切なリンクに変換
 */

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

    // 1回だけエンコード
    const encodedUrl = encodeURIComponent(targetUrl);
    // 必ずtrailing slashを含める
    const affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${affId}/?pc=${encodedUrl}`;
    
    console.log('🔗 Building affiliate link:', {
      original: targetUrl,
      encoded: encodedUrl,
      affiliate: affiliateUrl,
      hasTrailingSlash: true,
      isDoubleEncoded: false
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