export interface Hotel {
  id: string;
  name: string;
  area: string;
  nearest: string;
  price: number;
  amenities: ("シャワー" | "WiFi" | "2人可")[];
  imageUrl: string;
  affiliateUrl: string;
  rating?: number;
  // 位置情報（楽天APIから取得）
  latitude?: number;
  longitude?: number;
  // 計算された距離情報
  distanceKm?: number;
  walkingTimeMinutes?: number;
}

export const HOTELS: Hotel[] = [
  {
    id: "hotel_1",
    name: "新宿ビジネスホテル",
    area: "新宿区",
    nearest: "新宿駅",
    price: 4800,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/shinjuku/1200/800",
    affiliateUrl: "https://example.com/hotel1?existing=param",
    rating: 4.2
  },
  {
    id: "hotel_2",
    name: "渋谷センターホテル",
    area: "渋谷区", 
    nearest: "渋谷駅",
    price: 7200,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/shibuya/1200/800",
    affiliateUrl: "https://example.com/hotel2#section1",
    rating: 4.1
  },
  {
    id: "hotel_3",
    name: "池袋ツインルーム",
    area: "豊島区",
    nearest: "池袋駅",
    price: 6500,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/ikebukuro/1200/800",
    affiliateUrl: "/relative/path?test=value#hash",
    rating: 4.5
  },
  {
    id: "hotel_4",
    name: "上野サウナ&ホテル",
    area: "台東区",
    nearest: "上野駅",
    price: 3800,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/ueno/1200/800",
    affiliateUrl: "https://example.com/hotel4",
    rating: 4.0
  },
  {
    id: "hotel_5",
    name: "新宿ラグジュアリーホテル",
    area: "新宿区",
    nearest: "新宿駅",
    price: 12000,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/shinjuku2/1200/800",
    affiliateUrl: "https://example.com/hotel5",
    rating: 4.7
  },
  {
    id: "hotel_6",
    name: "渋谷ビジネスイン",
    area: "渋谷区",
    nearest: "渋谷駅",
    price: 7200,
    amenities: ["WiFi"],
    imageUrl: "https://picsum.photos/seed/shibuya2/1200/800",
    affiliateUrl: "https://example.com/hotel6",
    rating: 3.9
  }
];