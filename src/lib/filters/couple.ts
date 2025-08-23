import { Hotel } from "@/app/data/hotels";

// 除外NGワード
const NG_WORDS = [
  "ホステル", "ゲストハウス", "カプセル", "カプセルホテル", "ドミトリー", "相部屋", "男女混合",
  "キャビン", "cabin", "ポッド", "pod", "コンパクト", "compact",
  "hostel", "capsule", "dorm", "guest house", "shared", "dormitory"
];

// 優遇ワード（加点対象）
const POSITIVE_WORDS = [
  "ダブル", "セミダブル", "クイーン", "キング", "カップル", "couple", 
  "ラブホテル", "ラブホ"
];

/**
 * ホテルがカップル向けかどうかを判定する
 * @param hotel ホテル情報
 * @param additionalText 追加判定テキスト（プラン名・部屋名など）
 * @returns カップル向けの場合true
 */
export function isCoupleFriendly(hotel: Hotel, additionalText?: string): boolean {
  // 判定対象テキストを小文字化して結合
  const checkTexts = [
    hotel.name,
    additionalText || ""
  ].join(" ").toLowerCase();

  // NGワードチェック（ひとつでも含まれていれば除外）
  const hasNGWord = NG_WORDS.some(ngWord => 
    checkTexts.includes(ngWord.toLowerCase())
  );
  
  if (hasNGWord) {
    return false;
  }

  // 必須条件: 評価4.0以上 OR 料金6000円以上 (どちらか一方でOK)
  const hasGoodRating = hotel.rating && hotel.rating >= 4.0;
  const hasGoodPrice = hotel.price >= 6000;
  
  if (!hasGoodRating && !hasGoodPrice) {
    return false; // 両方とも満たさない場合は除外
  }

  // 加点システム
  let score = 0;

  // 必須条件を満たしている場合は基本点を付与
  if (hasGoodRating) score += 1;
  if (hasGoodPrice) score += 1;

  // 優遇ワードの存在チェック（各1点）
  const positiveWordCount = POSITIVE_WORDS.filter(word => 
    checkTexts.includes(word.toLowerCase())
  ).length;
  score += positiveWordCount;

  // 1点以上でカップル向けと判定（必須条件クリア済みなので必ず1点以上）
  return score >= 1;
}

/**
 * ホテルリストをカップル向けでフィルタリング
 * @param hotels ホテルリスト
 * @returns カップル向けホテルのみ
 */
export function filterCoupleFriendly(hotels: Hotel[]): Hotel[] {
  return hotels.filter(hotel => isCoupleFriendly(hotel));
}
