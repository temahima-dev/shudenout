import Link from "next/link";

export default function Header() {
  return (
    <>
      {/* スキップリンク */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-blue-600 text-white px-4 py-2 rounded z-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        メインコンテンツへスキップ
      </a>
      
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-center">
            {/* ロゴ中央配置 */}
            <Link href="/" className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              ShuDen Out
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
