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
 * アフィリエイトリンクに変換（2重エンコード防止）
 */
function convertToAffiliateLink(directUrl: string, affiliateId?: string): string {
  if (!affiliateId) {
    return directUrl;
  }

  try {
    // 既にhb.afl.rakuten.co.jpの場合はそのまま返す
    if (directUrl.includes('hb.afl.rakuten.co.jp')) {
      console.log('Already affiliate link, returning as-is:', directUrl);
      return directUrl;
    }

    // エンコードは1回のみ適用
    const encodedUrl = encodeURIComponent(directUrl);
    const affiliateUrl = `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}?pc=${encodedUrl}`;
    
    console.log('Converting to affiliate link:', {
      original: directUrl,
      encoded: encodedUrl,
      affiliate: affiliateUrl
    });
    
    return affiliateUrl;
  } catch (error) {
    console.warn('Failed to convert to affiliate link:', error);
    return directUrl;
  }
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
 * 楽天ホテルリンクを生成
 * 優先順位: hotelAffiliateUrl.pc > hotelInformationUrl/planListUrl (直接利用) > ID抽出生成 (fallback)
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
  };
} {
  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID;

  // 1. hotelAffiliateUrl.pc が存在する場合はそれを最優先で使用
  if (hotelInfo.hotelAffiliateUrl?.pc) {
    const sourceUrl = hotelInfo.hotelAffiliateUrl.pc;
    console.log('✅ Using hotelAffiliateUrl.pc:', sourceUrl);
    
    return {
      finalUrl: sourceUrl,
      source: 'affiliate',
      debug: {
        sourceUrl,
        finalUrl: sourceUrl,
        status: 'affiliate',
        usedSource: 'hotelAffiliateUrl.pc',
        hasAffiliate: !!affiliateId
      }
    };
  }

  // 2. hotelInformationUrl を直接利用（パラメータ付与）
  if (hotelInfo.hotelInformationUrl) {
    const sourceUrl = hotelInfo.hotelInformationUrl;
    const directUrl = addSearchParams(sourceUrl, options);
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.log('✅ Using hotelInformationUrl directly:', {
      sourceUrl,
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
        usedSource: 'hotelInformationUrl (direct)',
        hasAffiliate: !!affiliateId
      }
    };
  }

  // 3. planListUrl を直接利用（dpPlanListUrl > planListUrl の優先順位）
  const planUrl = hotelInfo.dpPlanListUrl || hotelInfo.planListUrl;
  if (planUrl) {
    const sourceUrl = planUrl;
    const directUrl = addSearchParams(sourceUrl, options);
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.log('✅ Using planListUrl directly:', {
      sourceUrl,
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
        usedSource: hotelInfo.dpPlanListUrl ? 'dpPlanListUrl (direct)' : 'planListUrl (direct)',
        hasAffiliate: !!affiliateId
      }
    };
  }

  // 4. fallback: ホテルIDを抽出してURL生成（404リスクあり）
  const hotelId = extractHotelId(hotelInfo.hotelInformationUrl || '');
  if (hotelId) {
    const directUrl = generateDirectHotelUrl(hotelId, options);
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.warn('⚠️ Using fallback ID-based URL generation (404 risk):', {
      hotelId,
      directUrl,
      finalUrl,
      hasAffiliate: !!affiliateId
    });

    return {
      finalUrl,
      source: 'fallback',
      debug: {
        sourceUrl: hotelInfo.hotelInformationUrl || '',
        finalUrl,
        status: 'fallback',
        usedSource: `ID extraction fallback (${hotelId})`,
        hasAffiliate: !!affiliateId,
        extractedId: hotelId
      }
    };
  }

  // 5. 最終フォールバック: 楽天トラベルトップページ
  const fallbackUrl = 'https://travel.rakuten.co.jp/';
  const finalUrl = convertToAffiliateLink(fallbackUrl, affiliateId);
  
  console.error('❌ No valid URL found, using rakuten travel top page');

  return {
    finalUrl,
    source: 'fallback',
    debug: {
      sourceUrl: 'none',
      finalUrl,
      status: 'emergency_fallback',
      usedSource: 'travel.rakuten.co.jp (emergency)',
      hasAffiliate: !!affiliateId
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