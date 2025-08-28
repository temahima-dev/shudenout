import { type Metadata } from "next";
import StructuredData from "@/app/components/StructuredData";
import { generateMetadata, generateFAQStructuredData } from "@/lib/seo";

export const metadata: Metadata = generateMetadata({
  title: "よくある質問",
  description: "ShuDen Out（終電あとホテル）に関するよくある質問と回答。ホテル検索、予約方法、料金について。",
  canonical: "/faq",
});

const FAQ_DATA = [
  {
    question: "終電を逃した場合、どのようにホテルを予約できますか？",
    answer: "ShuDen Outでは現在地から1km圏内のホテルを即座に検索できます。検索結果から気に入ったホテルを選び、予約ボタンをクリックすると楽天トラベルの予約ページに移動し、そのまま予約できます。"
  },
  {
    question: "料金はどのくらいかかりますか？",
    answer: "ホテルの料金は3,000円台から15,000円以上まで幅広くあります。価格帯フィルター（～5,000円、～10,000円、10,000円～）を使って予算に合ったホテルを絞り込むことができます。"
  },
  {
    question: "現在地での検索はどのように機能しますか？",
    answer: "「現在地から検索」を選択すると、ブラウザの位置情報機能を使って現在地を取得し、半径1km以内のホテルを距離順に表示します。位置情報の許可が必要です。"
  },
  {
    question: "どのエリアに対応していますか？",
    answer: "現在、東京都内の新宿、渋谷、上野エリアを中心にサービスを提供しています。今後、対応エリアを拡大予定です。"
  },
  {
    question: "予約にキャンセル料はかかりますか？",
    answer: "キャンセル料についてはホテルごとに異なります。詳細は楽天トラベルの各ホテルページでご確認ください。一般的に、当日キャンセルは料金が発生する場合があります。"
  },
  {
    question: "アプリはありますか？",
    answer: "現在はWebアプリのみの提供ですが、スマートフォンのブラウザからアクセス可能です。ホーム画面に追加することで、アプリのように使用できます。"
  },
  {
    question: "支払い方法は何が使えますか？",
    answer: "支払いは楽天トラベル経由で行うため、楽天トラベルで利用可能な支払い方法（クレジットカード、楽天ペイなど）をご利用いただけます。"
  },
  {
    question: "ホテルの設備を確認できますか？",
    answer: "はい。各ホテルカードには基本的な設備（WiFi、シャワー、2人利用可など）が表示されます。詳細な設備については、予約ページでご確認いただけます。"
  }
];

export default function FAQPage() {
  const faqStructuredData = generateFAQStructuredData(FAQ_DATA);

  return (
    <>
      <StructuredData data={faqStructuredData} />
      
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              よくある質問
            </h1>
            <p className="text-gray-600 mb-8">
              ShuDen Out（終電あとホテル）に関するよくあるご質問にお答えします。
            </p>

            <div className="space-y-6">
              {FAQ_DATA.map((faq, index) => (
                <div
                  key={index}
                  className="border-b border-gray-200 pb-6 last:border-b-0"
                >
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-start">
                    <span className="flex-shrink-0 bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded mr-3 mt-0.5">
                      Q{index + 1}
                    </span>
                    {faq.question}
                  </h2>
                  <div className="ml-11 text-gray-700 leading-relaxed">
                    {faq.answer}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 p-6 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                その他のご質問
              </h3>
              <p className="text-gray-700">
                上記以外のご質問がございましたら、各ホテルの詳細は楽天トラベルのページでご確認いただくか、
                直接ホテルにお問い合わせください。
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


