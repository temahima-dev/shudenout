import { Hotel } from "@/app/data/hotels";

// 除外対象の低品質ホテルワード
const LOW_QUALITY_WORDS = [
  // カプセル系（全角・半角対応）
  "カプセル", "カプセルホテル", "capsule", "caps", "ｃａｐｓｕｌｅ",
  // キャビン系（全角・半角対応）
  "キャビン", "cabin", "キャビンホテル", "ｃａｂｉｎ",
  // ポッド系
  "ポッド", "pod", "pods", "ｐｏｄ",
  // ドミトリー系
  "ドミトリー", "dorm", "dormitory", "相部屋", "男女混合", "shared",
  // ホステル系（全角・半角対応）
  "ホステル", "hostel", "ゲストハウス", "guest house", "guesthouse", "ｈｏｓｔｅｌ",
  // ネットカフェ系（全角・半角対応）
  "ネットカフェ", "net cafe", "netcafe", "漫画喫茶", "manga cafe", "ｎｅｔｃａｆｅ",
  // その他低品質系
  "コンパクト", "compact", "ミニマル", "minimal", "シンプル宿泊",
  // バックパッカー系
  "バックパッカー", "backpacker", "youth", "ユース",
  // 簡易宿泊系
  "簡易宿泊", "簡易ホテル", "格安宿泊", "ワンルーム宿泊",
  // サウナ系（24時間利用が多い）
  "サウナ", "sauna", "ｓａｕｎａ"
];

/**
 * 全角・半角文字を正規化（半角に統一）
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    })
    .replace(/[　]/g, ' '); // 全角スペースを半角に
}

/**
 * ホテルが品質基準を満たすかどうかを判定する
 * @param hotel ホテル情報
 * @returns 品質基準を満たす場合true
 */
export function isQualityHotel(hotel: Hotel): boolean {
  // ホテル名を正規化（全角→半角、小文字化）
  const normalizedHotelName = normalizeText(hotel.name);

  // 除外ワードチェック（ひとつでも含まれていれば除外）
  const matchedWord = LOW_QUALITY_WORDS.find(word => {
    const normalizedWord = normalizeText(word);
    return normalizedHotelName.includes(normalizedWord);
  });
  
  if (matchedWord) {
    // console.log(`🚫 品質フィルターで除外: "${hotel.name}" (理由: "${matchedWord}")`);
    return false;
  }

  return true;
}

/**
 * ホテルリストを品質フィルターでフィルタリング
 * @param hotels ホテルリスト
 * @returns 品質基準を満たすホテルのみ
 */
export function filterQualityHotels(hotels: Hotel[]): Hotel[] {
  const originalCount = hotels.length;
  const filteredHotels = hotels.filter(hotel => isQualityHotel(hotel));
  const filteredCount = filteredHotels.length;
  const excludedCount = originalCount - filteredCount;
  
  // console.log(`📊 品質フィルター結果: ${originalCount}件 → ${filteredCount}件 (${excludedCount}件除外)`);
  
  return filteredHotels;
}
