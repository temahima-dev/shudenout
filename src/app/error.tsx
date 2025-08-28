"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-red-500 mb-4">エラー</h1>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            問題が発生しました
          </h2>
          <p className="text-gray-600 mb-4">
            一時的な問題の可能性があります。再読み込みをお試しください。
          </p>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded transition-colors duration-200"
          >
            再読み込み
          </button>
          
          <Link
            href="/"
            className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded transition-colors duration-200"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

