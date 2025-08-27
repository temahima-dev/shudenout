// 楽天ホテルリンクの安全性チェック・URL正規化

const ALLOWED_DOMAINS = [
  'travel.rakuten.co.jp',
  'hotel.travel.rakuten.co.jp',
  'hb.afl.rakuten.co.jp'
];

// 画像APIのURLかどうかを判定する
export function isImageApiUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'img.travel.rakuten.co.jp' && urlObj.pathname.includes('/image/tr/api/');
  } catch {
    return false;
  }
}

// URLからホテルIDを抽出する
export function extractHotelId(url: string): number | null {
  try {
    // f_no=パラメータから抽出
    const fNoMatch = url.match(/[?&]f_no=(\d+)/);
    if (fNoMatch) {
      return parseInt(fNoMatch[1], 10);
    }
    
    // /HOTEL/{id}/{id}.html パターンから抽出
    const hotelMatch = url.match(/\/HOTEL\/(\d+)\/\d+\.html/);
    if (hotelMatch) {
      return parseInt(hotelMatch[1], 10);
    }
    
    // hb.aflのpc=パラメータから抽出
    if (url.includes('hb.afl.rakuten.co.jp')) {
      const urlObj = new URL(url);
      const pcParam = urlObj.searchParams.get('pc');
      if (pcParam) {
        const decodedPc = decodeURIComponent(pcParam);
        return extractHotelId(decodedPc);
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// ホテル詳細URLに正規化する
export function normalizeTargetToHotelDetail(url: string, fallbackId?: number): string {
  // 画像APIの場合は処理しない（呼び出し側でfallback）
  if (isImageApiUrl(url)) {
    if (fallbackId) {
      return `https://travel.rakuten.co.jp/HOTEL/${fallbackId}/${fallbackId}.html`;
    }
    return url; // フォールバック不可の場合はそのまま返す
  }
  
  const hotelId = extractHotelId(url);
  if (hotelId) {
    return `https://travel.rakuten.co.jp/HOTEL/${hotelId}/${hotelId}.html`;
  }
  
  // ホテルIDが取れない場合
  if (fallbackId) {
    return `https://travel.rakuten.co.jp/HOTEL/${fallbackId}/${fallbackId}.html`;
  }
  
  return url; // フォールバック不可の場合はそのまま返す
}

// アフィリエイトURLを構築する（二重エンコード防止）
export function buildAffiliateUrl(targetUrl: string, affiliateId: string): string {
  // 二重エンコード検出・正規化
  const normalized = /%25[0-9A-Fa-f]{2}/.test(targetUrl) 
    ? decodeURIComponent(targetUrl) 
    : targetUrl;
  
  return `https://hb.afl.rakuten.co.jp/hgc/${affiliateId}/?pc=${encodeURIComponent(normalized)}`;
}

// アフィリエイトURLのターゲットを検証する
export function validateAffiliateTargetUrl(url: string): { isValid: boolean; reason?: string } {
  try {
    const urlObj = new URL(url);
    
    // hb.aflリンクでない場合は直接ホストをチェック
    if (urlObj.hostname !== 'hb.afl.rakuten.co.jp') {
      const isAllowed = urlObj.hostname === 'travel.rakuten.co.jp' || urlObj.hostname === 'hotel.travel.rakuten.co.jp';
      return {
        isValid: isAllowed,
        reason: isAllowed ? undefined : `Non-affiliate host: ${urlObj.hostname}`
      };
    }
    
    // hb.aflの場合はpc=パラメータをチェック
    const pcParam = urlObj.searchParams.get('pc');
    if (!pcParam) {
      return { isValid: false, reason: 'Missing pc parameter in hb.afl URL' };
    }
    
    const pcDecoded = decodeURIComponent(pcParam);
    const pcUrlObj = new URL(pcDecoded);
    const isValidHost = pcUrlObj.hostname === 'travel.rakuten.co.jp' || pcUrlObj.hostname === 'hotel.travel.rakuten.co.jp';
    
    return {
      isValid: isValidHost,
      reason: isValidHost ? undefined : `Invalid pc host: ${pcUrlObj.hostname}`
    };
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }
}

// 安全なホテルリンクを生成する関数（レガシー互換・新機能使用）
export function safeHotelLink(
  url: string, 
  fallbackHotelNo?: number, 
  originalApiUrls?: { hotelAffiliateUrl?: string; hotelInformationUrl?: string }
): string {
  if (!url || url.trim() === '') {
    return '';
  }

  const validation = validateAffiliateTargetUrl(url);
  if (validation.isValid) {
    return url;
  }
  
  console.warn(`🔗 無効なURL: ${validation.reason}, フォールバック中...`);
  
  // 元のAPIデータから有効なURLを探す
  if (originalApiUrls) {
    const candidates = [
      originalApiUrls.hotelAffiliateUrl,
      originalApiUrls.hotelInformationUrl
    ].filter(Boolean);
    
    for (const candidate of candidates) {
      const candidateValidation = validateAffiliateTargetUrl(candidate!);
      if (candidateValidation.isValid && !isImageApiUrl(candidate!)) {
        console.log(`🔗 有効な代替URL発見: ${candidate}`);
        return candidate!;
      }
    }
  }
  
  // 安全なフォールバックURL
  if (fallbackHotelNo) {
    const fallbackUrl = `https://travel.rakuten.co.jp/HOTEL/${fallbackHotelNo}/${fallbackHotelNo}.html`;
    console.log(`🔄 楽天トラベル正規URLに復帰: ${fallbackUrl}`);
    return fallbackUrl;
  }
  
  console.error(`❌ フォールバック不可: ${url}`);
  return '';
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