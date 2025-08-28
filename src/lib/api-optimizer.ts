interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class ApiOptimizer {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly REQUEST_TIMEOUT = 30000; // 30秒でタイムアウト
  private readonly BATCH_DELAY = 100; // 100ms以内のリクエストをバッチ処理
  private batchQueue = new Map<string, Array<{
    params: any;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>>();

  /**
   * リクエストキーを生成
   */
  private generateRequestKey(url: string, params: any): string {
    const sortedParams = Object.keys(params || {})
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${url}?${sortedParams}`;
  }

  /**
   * 重複リクエストを防止して実行
   */
  async deduplicateRequest<T>(
    url: string, 
    params: any, 
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = this.generateRequestKey(url, params);
    
    // 既存のリクエストがある場合は結果を待つ
    const existing = this.pendingRequests.get(key);
    if (existing) {
      // タイムアウトチェック
      if (Date.now() - existing.timestamp < this.REQUEST_TIMEOUT) {
        console.log('🔄 重複リクエスト検出、既存リクエストの結果を待機:', key);
        return existing.promise;
      } else {
        // タイムアウトした古いリクエストを削除
        this.pendingRequests.delete(key);
      }
    }

    // 新しいリクエストを実行
    const promise = fetcher().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * バッチ処理でリクエストを最適化
   */
  async batchRequest<T>(
    batchKey: string,
    params: any,
    batchProcessor: (paramsList: any[]) => Promise<T[]>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // バッチキューに追加
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, []);
        
        // 遅延実行でバッチ処理
        setTimeout(async () => {
          const batch = this.batchQueue.get(batchKey);
          if (!batch || batch.length === 0) return;
          
          this.batchQueue.delete(batchKey);
          
          try {
            console.log(`📦 バッチ処理実行: ${batch.length}件のリクエスト`);
            const results = await batchProcessor(batch.map(item => item.params));
            
            // 結果を各リクエストに返す
            batch.forEach((item, index) => {
              item.resolve(results[index]);
            });
          } catch (error) {
            // エラーを全リクエストに返す
            batch.forEach(item => {
              item.reject(error);
            });
          }
        }, this.BATCH_DELAY);
      }
      
      this.batchQueue.get(batchKey)!.push({
        params,
        resolve,
        reject
      });
    });
  }

  /**
   * 並列リクエストの制限
   */
  async limitConcurrency<T>(
    requests: (() => Promise<T>)[],
    limit: number = 3
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < requests.length; i += limit) {
      const batch = requests.slice(i, i + limit);
      const batchResults = await Promise.allSettled(batch.map(req => req()));
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results[i + index] = result.value;
        } else {
          console.warn(`リクエスト${i + index}でエラー:`, result.reason);
          // エラー時のフォールバック値
          results[i + index] = null as any;
        }
      });
    }
    
    return results;
  }

  /**
   * リクエストのプリロード（先読み）
   */
  preloadRequest<T>(
    url: string,
    params: any,
    fetcher: () => Promise<T>
  ): void {
    const key = this.generateRequestKey(url, params);
    
    if (!this.pendingRequests.has(key)) {
      console.log('🔮 リクエストを先読み:', key);
      this.deduplicateRequest(url, params, fetcher).catch(() => {
        // 先読みなのでエラーは無視
      });
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    pendingRequests: number;
    batchQueues: number;
    totalBatchItems: number;
  } {
    let totalBatchItems = 0;
    this.batchQueue.forEach(batch => {
      totalBatchItems += batch.length;
    });

    return {
      pendingRequests: this.pendingRequests.size,
      batchQueues: this.batchQueue.size,
      totalBatchItems
    };
  }

  /**
   * 全リクエストをクリア
   */
  clearAll(): void {
    this.pendingRequests.clear();
    this.batchQueue.clear();
  }
}

// シングルトンインスタンス
export const apiOptimizer = new ApiOptimizer();


