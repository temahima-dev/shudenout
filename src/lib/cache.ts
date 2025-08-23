import { type Hotel } from "@/app/data/hotels";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface SearchCacheData {
  items: Hotel[];
  paging: {
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
  };
  fallback: boolean;
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分
  private readonly SEARCH_TTL = 3 * 60 * 1000; // 検索結果は3分

  /**
   * キャッシュキーを生成
   */
  private generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${prefix}:${sortedParams}`;
  }

  /**
   * メモリキャッシュからデータを取得
   */
  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * メモリキャッシュにデータを保存
   */
  private setInMemory<T>(key: string, data: T, ttl: number): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * LocalStorageからデータを取得
   */
  private getFromLocalStorage<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const entry: CacheEntry<T> = JSON.parse(stored);
      if (Date.now() > entry.timestamp + entry.ttl) {
        localStorage.removeItem(key);
        return null;
      }
      
      return entry.data;
    } catch (error) {
      console.warn('LocalStorage読み取りエラー:', error);
      return null;
    }
  }

  /**
   * LocalStorageにデータを保存
   */
  private setInLocalStorage<T>(key: string, data: T, ttl: number): void {
    if (typeof window === 'undefined') return;
    
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('LocalStorage書き込みエラー:', error);
      // LocalStorageが満杯の場合、古いエントリを削除
      this.clearExpiredFromLocalStorage();
    }
  }

  /**
   * 期限切れのLocalStorageエントリをクリア
   */
  private clearExpiredFromLocalStorage(): void {
    if (typeof window === 'undefined') return;
    
    const now = Date.now();
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('shudenout:')) continue;
      
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const entry = JSON.parse(stored);
          if (now > entry.timestamp + entry.ttl) {
            keysToRemove.push(key);
          }
        }
      } catch {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  /**
   * 検索結果をキャッシュから取得
   */
  getSearchResults(params: Record<string, any>): SearchCacheData | null {
    const key = `shudenout:search:${this.generateKey('search', params)}`;
    
    // メモリキャッシュを最初にチェック（高速）
    let result = this.getFromMemory<SearchCacheData>(key);
    if (result) return result;
    
    // LocalStorageからチェック（永続化）
    result = this.getFromLocalStorage<SearchCacheData>(key);
    if (result) {
      // メモリキャッシュにも保存して次回高速化
      this.setInMemory(key, result, this.SEARCH_TTL);
    }
    
    return result;
  }

  /**
   * 検索結果をキャッシュに保存
   */
  setSearchResults(params: Record<string, any>, data: SearchCacheData): void {
    const key = `shudenout:search:${this.generateKey('search', params)}`;
    
    // メモリとLocalStorage両方に保存
    this.setInMemory(key, data, this.SEARCH_TTL);
    this.setInLocalStorage(key, data, this.SEARCH_TTL);
  }

  /**
   * 画像URLのキャッシュ状態をチェック
   */
  isImageCached(url: string): boolean {
    const key = `shudenout:image:${url}`;
    return this.getFromMemory<boolean>(key) !== null;
  }

  /**
   * 画像URLをキャッシュ済みとしてマーク
   */
  markImageCached(url: string): void {
    const key = `shudenout:image:${url}`;
    this.setInMemory(key, true, 30 * 60 * 1000); // 30分
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats(): {
    memorySize: number;
    localStorageSize: number;
    totalEntries: number;
  } {
    const memorySize = this.memoryCache.size;
    let localStorageSize = 0;
    
    if (typeof window !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('shudenout:')) {
          localStorageSize++;
        }
      }
    }
    
    return {
      memorySize,
      localStorageSize,
      totalEntries: memorySize + localStorageSize
    };
  }

  /**
   * 全キャッシュをクリア
   */
  clearAll(): void {
    this.memoryCache.clear();
    
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('shudenout:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }
}

// シングルトンインスタンス
export const cacheManager = new CacheManager();
