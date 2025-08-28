"use client";

import { useEffect } from "react";

export default function PerformanceMonitor() {
  useEffect(() => {
    // 開発環境のみでパフォーマンス監視
    if (process.env.NODE_ENV === 'development') {
      console.log('🚀 Performance Monitor: 当日空室検索システム稼働中');
    }
  }, []);

  // 本番環境では何も表示しない
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 text-white p-2 rounded text-xs opacity-75 z-50">
      🔧 Dev Mode
    </div>
  );
}