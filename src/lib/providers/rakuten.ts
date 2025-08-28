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
 * アフィリエイトリンクに変換
 */
function convertToAffiliateLink(directUrl: string, affiliateId?: string): string {
  if (!affiliateId) {
    return directUrl;
  }

  try {
    const encodedUrl = encodeURIComponent(directUrl);
    return `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}?pc=${encodedUrl}`;
  } catch (error) {
    console.warn('Failed to convert to affiliate link:', error);
    return directUrl;
  }
}

/**
 * 楽天ホテルリンクを生成
 * 優先順位: hotelAffiliateUrl.pc > hotelInformationUrl (ID抽出) > planListUrl (fallback)
 */
export function generateRakutenHotelLink(
  hotelInfo: HotelBasicInfo,
  options: LinkGenerationOptions
): {
  finalUrl: string;
  source: 'affiliate' | 'direct' | 'fallback';
  debug?: {
    extractedId?: string;
    directUrl?: string;
    usedSource: string;
  };
} {
  const affiliateId = options.affiliateId || process.env.RAKUTEN_AFFILIATE_ID;

  // 1. hotelAffiliateUrl.pc が存在する場合はそれを使用
  if (hotelInfo.hotelAffiliateUrl?.pc) {
    console.log('Using hotelAffiliateUrl.pc:', hotelInfo.hotelAffiliateUrl.pc);
    return {
      finalUrl: hotelInfo.hotelAffiliateUrl.pc,
      source: 'affiliate',
      debug: {
        usedSource: 'hotelAffiliateUrl.pc'
      }
    };
  }

  // 2. hotelInformationUrl からホテルIDを抽出して直接リンクを生成
  const hotelId = extractHotelId(hotelInfo.hotelInformationUrl);
  if (hotelId) {
    const directUrl = generateDirectHotelUrl(hotelId, options);
    const finalUrl = convertToAffiliateLink(directUrl, affiliateId);
    
    console.log('Generated direct hotel link:', {
      hotelId,
      directUrl,
      finalUrl,
      hasAffiliate: !!affiliateId
    });

    return {
      finalUrl,
      source: 'direct',
      debug: {
        extractedId: hotelId,
        directUrl,
        usedSource: 'hotelInformationUrl + ID extraction'
      }
    };
  }

  // 3. fallback: dpPlanListUrl または planListUrl を使用
  let fallbackUrl = hotelInfo.dpPlanListUrl || hotelInfo.planListUrl;
  
  // URLにパラメータを追加
  try {
    const urlObj = new URL(fallbackUrl);
    urlObj.searchParams.set('checkin_date', options.checkinDate.replace(/-/g, ''));
    urlObj.searchParams.set('checkout_date', options.checkoutDate.replace(/-/g, ''));
    urlObj.searchParams.set('adult_num', options.adultNum.toString());
    
    if (options.roomNum) {
      urlObj.searchParams.set('room_num', options.roomNum.toString());
    }
    
    fallbackUrl = urlObj.toString();
  } catch (error) {
    console.warn('Failed to add parameters to fallback URL:', error);
  }

  const finalUrl = convertToAffiliateLink(fallbackUrl, affiliateId);

  console.log('Using fallback link:', {
    original: hotelInfo.dpPlanListUrl || hotelInfo.planListUrl,
    withParams: fallbackUrl,
    finalUrl,
    hasAffiliate: !!affiliateId
  });

  return {
    finalUrl,
    source: 'fallback',
    debug: {
      usedSource: 'planListUrl (fallback)'
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