import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | ShuDen Out - 終電あとホテル',
  description: 'ShuDen Out（終電あとホテル）のプライバシーポリシー。個人情報の取り扱いについて説明します。',
  robots: 'index, follow',
};

export default function Privacy() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">プライバシーポリシー</h1>
        
        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">個人情報の取り扱いについて</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              ShuDen Out（以下「当サイト」）は、ユーザーの個人情報保護を重要視し、以下のプライバシーポリシーに従って適切に取り扱います。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">収集する情報</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>位置情報（ユーザーが許可した場合のみ）</li>
              <li>検索履歴（ブラウザのローカルストレージに保存）</li>
              <li>アクセスログ（IPアドレス、ブラウザ情報等）</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">第三者サービスの利用</h2>
            <div className="text-gray-600 space-y-4">
              <p>当サイトでは以下の第三者サービスを利用しています：</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>楽天トラベルAPI</strong>: ホテル情報の取得</li>
                <li><strong>Google Analytics</strong>: アクセス解析</li>
                <li><strong>Vercel</strong>: ホスティングサービス</li>
              </ul>
              <p>これらのサービスは独自のプライバシーポリシーに従って運営されています。</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Cookie の使用</h2>
            <p className="text-gray-600 leading-relaxed">
              当サイトでは、ユーザー体験の向上のためにCookieを使用する場合があります。
              ブラウザの設定でCookieを無効にすることも可能ですが、一部機能が制限される場合があります。
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">お問い合わせ</h2>
            <p className="text-gray-600 leading-relaxed">
              プライバシーポリシーに関するご質問は、当サイトのお問い合わせフォームよりご連絡ください。
            </p>
          </section>

          <section className="text-sm text-gray-500 border-t pt-4">
            <p>最終更新日: 2024年10月16日</p>
            <p className="mt-2 text-xs">Build: {new Date().toISOString()}</p>
          </section>
        </div>
      </div>
    </main>
  );
}
