import { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約 | ShuDen Out",
  description: "ShuDen Out の利用規約ページです。",
};

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">利用規約</h1>
      
      <div className="prose prose-gray max-w-none">
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">第1条（適用）</h2>
        <p className="text-gray-700 mb-6">
          本利用規約（以下「本規約」）は、ShuDen Out（以下「当サービス」）の利用条件を定めるものです。
          ユーザーの皆さまには、本規約に従って当サービスをご利用いただきます。
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">第2条（利用登録）</h2>
        <p className="text-gray-700 mb-6">
          当サービスは現在利用登録を必要としない情報提供サービスです。
          将来的に登録機能を追加する場合は、本規約を更新いたします。
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">第3条（免責事項）</h2>
        <p className="text-gray-700 mb-6">
          当サービスは情報提供を目的としており、実際の予約や宿泊については外部サイトでの手続きとなります。
          当サービスは宿泊に関するトラブルについて一切の責任を負いません。
        </p>
        
        <p className="text-sm text-gray-500 mt-12">
          最終更新日: 2024年1月1日
        </p>
      </div>
    </div>
  );
}

