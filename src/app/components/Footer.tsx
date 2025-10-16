import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* ナビゲーションリンク */}
        <div className="flex justify-center space-x-8 mb-6">
          <Link
            href="/faq"
            className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            よくある質問
          </Link>
          <Link
            href="/terms"
            className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            利用規約
          </Link>
          <Link
            href="/privacy-policy"
            className="text-gray-400 hover:text-white transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            プライバシーポリシー
          </Link>
        </div>

        {/* コピーライト・免責事項 */}
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">
            © 2024 終電あとホテル. ※外部サイトでの予約となります。
          </p>
          <p className="text-gray-500 text-xs">
            本サイトの外部リンクはアフィリエイトを含む場合があります。
          </p>
        </div>
      </div>
    </footer>
  );
}
