// 楽天ホテルリンクの安全性チェック

const ALLOWED_DOMAINS = [
  'travel.rakuten.co.jp',          // 楽天トラベル本体
  'hb.afl.rakuten.co.jp',          // 楽天アフィリエイト中継
  // 'img.travel.rakuten.co.jp',   // 画像API（将来拡張用、現在は対象外）
];

/**
 * 楽天ホテルリンクの安全性をチェックし、許可ドメイン以外は修正する
 * @param url チェック対象のURL
 * @param fallbackHotelNo フォールバック用のホテル番号（任意）
 * @param originalApiUrls 元のAPIから取得したURL情報（フォールバック用）
 * @returns 安全なURL、または空文字
 */
export function safeHotelLink(
  url: string, 
  fallbackHotelNo?: number, 
  originalApiUrls?: { hotelAffiliateUrl?: string; hotelInformationUrl?: string }
): string {
  if (!url || url.trim() === '') {
    return '';
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // 許可ドメインのチェック
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
    if (isAllowed) {
      return url; // 許可ドメインなのでそのまま返す
    }
    
    // 許可ドメイン以外（楽天市場等）の場合
    console.warn(`⚠️ 非許可ドメインを検出: ${hostname}, フォールバック中...`);
    
    // 1. 元のAPIからhotelAffiliateUrlが許可ドメインなら復帰
    if (originalApiUrls?.hotelAffiliateUrl) {
      try {
        const affiliateUrlObj = new URL(originalApiUrls.hotelAffiliateUrl);
        const affiliateHostname = affiliateUrlObj.hostname.toLowerCase();
        const isAffiliateAllowed = ALLOWED_DOMAINS.some(domain => 
          affiliateHostname === domain || affiliateHostname.endsWith('.' + domain)
        );
        
        if (isAffiliateAllowed) {
          console.log(`✅ APIのhotelAffiliateUrlに復帰: ${originalApiUrls.hotelAffiliateUrl}`);
          return originalApiUrls.hotelAffiliateUrl;
        }
      } catch {
        // URL解析エラーは無視して次へ
      }
    }
    
    // 2. 元のAPIからhotelInformationUrlが許可ドメインなら復帰
    if (originalApiUrls?.hotelInformationUrl) {
      try {
        const infoUrlObj = new URL(originalApiUrls.hotelInformationUrl);
        const infoHostname = infoUrlObj.hostname.toLowerCase();
        const isInfoAllowed = ALLOWED_DOMAINS.some(domain => 
          infoHostname === domain || infoHostname.endsWith('.' + domain)
        );
        
        if (isInfoAllowed) {
          console.log(`✅ APIのhotelInformationUrlに復帰: ${originalApiUrls.hotelInformationUrl}`);
          return originalApiUrls.hotelInformationUrl;
        }
      } catch {
        // URL解析エラーは無視して次へ
      }
    }
    
    // 3. ホテル番号があれば楽天トラベルの正規URLを生成
    if (fallbackHotelNo) {
      const fallbackUrl = `https://travel.rakuten.co.jp/HOTEL/${fallbackHotelNo}/${fallbackHotelNo}.html`;
      console.log(`🔄 楽天トラベル正規URLに復帰: ${fallbackUrl}`);
      return fallbackUrl;
    }
    
    // フォールバックできない場合は空文字
    console.error(`❌ フォールバック不可: ${url}`);
    return '';
    
  } catch (error) {
    console.error('URL解析エラー:', error);
    return '';
  }
}

/**
 * 予約用パラメータを URL に追加する
 */
export interface BookingParams {
  checkinDate?: string;
  checkoutDate?: string;
  adultNum?: number;
  utm?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
}

export function withBookingParams(baseUrl: string, params: BookingParams): string {
  try {
    const url = new URL(baseUrl);
    
    if (params.checkinDate) {
      url.searchParams.set('checkin', params.checkinDate);
    }
    if (params.checkoutDate) {
      url.searchParams.set('checkout', params.checkoutDate);
    }
    if (params.adultNum) {
      url.searchParams.set('adults', params.adultNum.toString());
    }
    
    // UTMパラメータ追加
    if (params.utm) {
      if (params.utm.utm_source) url.searchParams.set('utm_source', params.utm.utm_source);
      if (params.utm.utm_medium) url.searchParams.set('utm_medium', params.utm.utm_medium);
      if (params.utm.utm_campaign) url.searchParams.set('utm_campaign', params.utm.utm_campaign);
    }
    
    return url.toString();
  } catch (error) {
    console.error('URL生成エラー:', error);
    return baseUrl;
  }
}

/**
 * デバッグ用：最終的なhrefサンプルを生成（withAffiliate + withUtm + safeHotelLink適用後）
 */
export function createFinalHrefSample(
  baseUrl: string, 
  hotelNo: number,
  checkinDate?: string,
  checkoutDate?: string,
  adultNum?: number
): string {
  // withBookingParams相当の処理
  const finalUrl = withBookingParams(baseUrl, {
    checkinDate,
    checkoutDate,
    adultNum,
    utm: {
      utm_source: 'shudenout',
      utm_medium: 'affiliate'
    }
  });
  
  // 最終安全性チェック
  return safeHotelLink(finalUrl, hotelNo);
}