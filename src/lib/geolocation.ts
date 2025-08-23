export interface Coordinates {
  lat: number;
  lng: number;
}

export interface GeolocationResult {
  coords: Coordinates;
  error?: string;
}

/**
 * ブラウザの位置情報APIを使用して現在地を取得
 */
export function getCurrentPosition(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        coords: { lat: 35.6812, lng: 139.7671 }, // 新宿駅をデフォルト
        error: "位置情報がサポートされていません"
      });
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5分間キャッシュ
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
        });
      },
      (error) => {
        console.warn("位置情報取得エラー:", error.message);
        resolve({
          coords: { lat: 35.6812, lng: 139.7671 }, // 新宿駅をデフォルト
          error: error.message
        });
      },
      options
    );
  });
}

/**
 * Haversine公式を使用して2点間の距離を計算（単位：km）
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371; // 地球の半径（km）
  const dLat = (point2.lat - point1.lat) * (Math.PI / 180);
  const dLng = (point2.lng - point1.lng) * (Math.PI / 180);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(point1.lat * (Math.PI / 180)) *
    Math.cos(point2.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 距離（km）を徒歩時間（分）に変換
 * 一般的な徒歩速度 4.8km/h（80m/分）を使用
 */
export function distanceToWalkingTime(distanceKm: number): number {
  const walkingSpeedKmPerHour = 4.8;
  return Math.round((distanceKm / walkingSpeedKmPerHour) * 60);
}

/**
 * 距離を読みやすい形式でフォーマット
 */
export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)}m`;
  }
  return `${distanceKm.toFixed(1)}km`;
}

/**
 * 徒歩時間を読みやすい形式でフォーマット
 */
export function formatWalkingTime(minutes: number): string {
  if (minutes < 60) {
    return `徒歩約${minutes}分`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `徒歩約${hours}時間${remainingMinutes}分`;
}

/**
 * 主要駅の座標データ
 */
export const MAJOR_STATIONS: Record<string, Coordinates> = {
  shinjuku: { lat: 35.6896, lng: 139.6917 },
  shibuya: { lat: 35.6580, lng: 139.7016 },
  ueno: { lat: 35.7141, lng: 139.7774 },
  tokyo: { lat: 35.6812, lng: 139.7671 },
  ikebukuro: { lat: 35.7295, lng: 139.7109 },
  akihabara: { lat: 35.6984, lng: 139.7731 }
};
