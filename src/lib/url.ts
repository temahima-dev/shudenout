export function withUtm(rawUrl: string, utm: Record<string, string>): string {
  try {
    // 相対URLの場合はベースURLを使用
    const baseUrl = rawUrl.startsWith('http') ? undefined : 'http://localhost:3000';
    const url = new URL(rawUrl, baseUrl);
    
    // ハッシュを一時的に保存
    const hash = url.hash;
    url.hash = '';
    
    // UTMパラメータを追加
    Object.entries(utm).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    
    // ハッシュを復元
    url.hash = hash;
    
    return url.toString();
  } catch (error) {
    console.error('URL parsing error:', error);
    return rawUrl; // エラー時は元のURLを返す
  }
}

// 日付・人数情報を楽天アフィリエイトURLに追加
export function withBookingParams(
  rawUrl: string, 
  params: {
    checkinDate?: string;
    checkoutDate?: string;
    adultNum?: number;
    utm?: Record<string, string>;
  }
): string {
  try {
    const url = new URL(rawUrl);
    
    // 楽天トラベルのパラメータを追加
    if (params.checkinDate) {
      url.searchParams.set('checkin_date', params.checkinDate);
    }
    if (params.checkoutDate) {
      url.searchParams.set('checkout_date', params.checkoutDate);
    }
    if (params.adultNum && params.adultNum > 1) {
      url.searchParams.set('adult_num', params.adultNum.toString());
    }
    
    // UTMパラメータを追加
    if (params.utm) {
      Object.entries(params.utm).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    
    return url.toString();
  } catch (error) {
    console.error('URL parsing error:', error);
    return rawUrl;
  }
}

// アフィリエイトリンクはサーバーサイドで生成済みのため、
// withAffiliate関数は削除（rakuten.ts で処理）
