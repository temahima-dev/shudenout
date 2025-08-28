export default function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* 画像枠 */}
      <div className="h-40 w-full bg-gray-200"></div>
      
      <div className="p-4">
        {/* ホテル名 */}
        <div className="h-6 bg-gray-200 rounded mb-2"></div>
        
        {/* 最寄り駅・エリア */}
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
        
        {/* 設備タグ */}
        <div className="flex gap-1 mb-4">
          <div className="h-6 bg-gray-200 rounded-full w-16"></div>
          <div className="h-6 bg-gray-200 rounded-full w-12"></div>
        </div>
        
        {/* 価格・ボタン */}
        <div className="flex items-center justify-between">
          <div className="h-8 bg-gray-200 rounded w-20"></div>
          <div className="h-10 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
}

