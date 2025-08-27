// 楽天アフィリエイトリンクの検証とフォールバック機能

interface LinkCache {
  isValid: boolean;
  timestamp: number;
}

// 6時間のメモリキャッシュ
const linkCache = new Map<string, LinkCache>();
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6時間

/**
 * hb.aflリンクの有効性をチェック（本番のみ軽量実行）
 */
export async function verifyAffiliateLink(url: string, hotelNo: number): Promise<string> {
  // 開発環境ではそのまま返す
  if (process.env.NODE_ENV !== 'production') {
    return url;
  }

  // hb.aflリンクでない場合はそのまま返す
  if (!url.includes('hb.afl.rakuten.co.jp')) {
    return url;
  }

  // キャッシュキー
  const cacheKey = `${hotelNo}-${new URL(url).hostname}`;
  const cached = linkCache.get(cacheKey);
  
  // キャッシュが有効な場合
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    if (!cached.isValid) {
      // キャッシュでinvalidの場合、直接リンクに変換
      return `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/${hotelNo}.html`;
    }
    return url;
  }

  try {
    // HEAD リクエストで軽量チェック（リダイレクトを手動処理）
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShuDenOut-LinkChecker/1.0)',
      },
      signal: AbortSignal.timeout(3000), // 3秒タイムアウト
    });

    let isValid = true;
    
    // リダイレクト先が楽天市場の場合は無効と判定
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location && location.includes('www.rakuten.co.jp')) {
        isValid = false;
      }
    }

    // キャッシュに保存
    linkCache.set(cacheKey, {
      isValid,
      timestamp: Date.now(),
    });

    if (!isValid) {
      console.warn(`🔗 アフィリエイトリンク無効を検出: ホテル${hotelNo}, 直接リンクにフォールバック`);
      return `https://travel.rakuten.co.jp/HOTEL/${hotelNo}/${hotelNo}.html`;
    }

    return url;

  } catch (error) {
    // エラー時はオリジナルURLをそのまま使用（過負荷防止）
    console.warn(`🔗 リンク検証エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return url;
  }
}

/**
 * キャッシュクリア（メモリ使用量管理）
 */
export function clearLinkCache(): void {
  linkCache.clear();
}

/**
 * 古いキャッシュエントリを削除
 */
export function cleanupLinkCache(): void {
  const now = Date.now();
  for (const [key, value] of linkCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      linkCache.delete(key);
    }
  }
}
