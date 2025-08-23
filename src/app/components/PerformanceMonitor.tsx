"use client";

import { useState, useEffect } from "react";
import { cacheManager } from "@/lib/cache";
import { apiOptimizer } from "@/lib/api-optimizer";

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  apiResponseTime: number;
  cacheHitRate: number;
  memoryUsage?: number;
}

export default function PerformanceMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    apiResponseTime: 0,
    cacheHitRate: 0
  });

  // 開発環境でのみ表示
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development');
  }, []);

  // パフォーマンスメトリクスを収集
  useEffect(() => {
    if (!isVisible) return;

    const collectMetrics = () => {
      // Navigation Timing API
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;
      const renderTime = navigation.domContentLoadedEventEnd - navigation.fetchStart;

      // API レスポンス時間（最新の測定値）
      const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const apiEntries = resourceEntries.filter(entry => entry.name.includes('/api/'));
      const latestApiEntry = apiEntries[apiEntries.length - 1];
      const apiResponseTime = latestApiEntry ? latestApiEntry.duration : 0;

      // キャッシュ統計
      const cacheStats = cacheManager.getCacheStats();
      const cacheHitRate = cacheStats.totalEntries > 0 ? 
        (cacheStats.memorySize / cacheStats.totalEntries) * 100 : 0;

      // メモリ使用量（対応ブラウザのみ）
      const memoryUsage = (performance as any).memory?.usedJSHeapSize;

      setMetrics({
        loadTime: Math.round(loadTime),
        renderTime: Math.round(renderTime),
        apiResponseTime: Math.round(apiResponseTime),
        cacheHitRate: Math.round(cacheHitRate),
        memoryUsage: memoryUsage ? Math.round(memoryUsage / 1024 / 1024) : undefined
      });
    };

    collectMetrics();
    const interval = setInterval(collectMetrics, 2000);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return "text-green-600";
    if (value <= thresholds.warning) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-black/80 backdrop-blur-sm text-white text-xs p-3 rounded-lg shadow-lg max-w-xs">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-yellow-400">🚀 Performance</h4>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Page Load:</span>
            <span className={getStatusColor(metrics.loadTime, { good: 1000, warning: 3000 })}>
              {metrics.loadTime}ms
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>DOM Ready:</span>
            <span className={getStatusColor(metrics.renderTime, { good: 500, warning: 1500 })}>
              {metrics.renderTime}ms
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>API Response:</span>
            <span className={getStatusColor(metrics.apiResponseTime, { good: 300, warning: 1000 })}>
              {metrics.apiResponseTime}ms
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>Cache Hit:</span>
            <span className="text-blue-400">
              {metrics.cacheHitRate}%
            </span>
          </div>

          {metrics.memoryUsage && (
            <div className="flex justify-between">
              <span>Memory:</span>
              <span className={getStatusColor(metrics.memoryUsage, { good: 50, warning: 100 })}>
                {metrics.memoryUsage}MB
              </span>
            </div>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-gray-600">
          <div className="text-xs text-gray-400">
            Cache: {cacheManager.getCacheStats().totalEntries} entries
          </div>
          <div className="text-xs text-gray-400">
            API: {apiOptimizer.getStats().pendingRequests} pending
          </div>
        </div>
      </div>
    </div>
  );
}
