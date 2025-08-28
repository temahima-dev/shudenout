import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="mb-6">
          <h1 className="text-6xl font-bold text-gray-400 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            ページが見つかりません
          </h2>
          <p className="text-gray-600">
            お探しのページは存在しないか、移動した可能性があります。
          </p>
        </div>
        
        <Link
          href="/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded transition-colors duration-200"
        >
          トップへ戻る
        </Link>
      </div>
    </div>
  );
}

