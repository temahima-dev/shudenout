/**
 * JST (Japan Standard Time) 日付ユーティリティ
 * 日本時間での日付操作を提供
 */

/**
 * 現在の日本時間を取得
 */
export const nowInJST = (): Date => {
  const now = new Date();
  const jst = new Date(now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
  return jst;
};

/**
 * 日付をYYYY-MM-DD形式に変換
 */
export const ymd = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * 日本時間の今日と明日の日付を取得
 */
export const todayTomorrowJST = (): { today: string; tomorrow: string } => {
  const t = nowInJST();
  const today = new Date(t);
  const tomorrow = new Date(t);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return { 
    today: ymd(today), 
    tomorrow: ymd(tomorrow) 
  };
};

/**
 * 現在時刻が何時台かを取得（デバッグ用）
 */
export const getCurrentHourJST = (): number => {
  return nowInJST().getHours();
};

/**
 * 終電後かどうかを判定（22時以降を終電後とみなす）
 */
export const isAfterLastTrain = (): boolean => {
  const hour = getCurrentHourJST();
  return hour >= 22 || hour < 5; // 22時〜翌5時を終電後とする
};
