import { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | ShuDen Out",
  description: "ShuDen Out のプライバシーポリシーページです。",
};

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">プライバシーポリシー</h1>
      
      <div className="prose prose-gray max-w-none">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">1. 収集する情報</h2>
        <p className="text-gray-700 mb-6">
          当サービスでは、サービス改善のため以下の情報を収集する場合があります：
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>ウェブサイトのアクセス情報（IPアドレス、ブラウザ情報等）</li>
          <li>検索条件や閲覧履歴</li>
          <li>Cookieによる情報</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">2. 情報の利用目的</h2>
        <p className="text-gray-700 mb-6">
          収集した情報は以下の目的で利用いたします：
        </p>
        <ul className="list-disc list-inside text-gray-700 mb-6 space-y-2">
          <li>サービスの提供・運営</li>
          <li>サービスの改善・開発</li>
          <li>お問い合わせへの対応</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">3. 第三者への提供</h2>
        <p className="text-gray-700 mb-6">
          当サービスは、法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
          ただし、宿泊予約サイトへのリンクを通じて外部サイトに移動した場合は、それぞれのサイトのプライバシーポリシーが適用されます。
        </p>
        
        <p className="text-sm text-gray-500 mt-12">
          最終更新日: 2024年1月1日
        </p>
      </div>
    </div>
  );
}
