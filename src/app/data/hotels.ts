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
  // デバッグ用（debugLinks=1の時のみ）
  debugInfo?: {
    fromApi: {
      hotelAffiliateUrl?: string;
      hotelInformationUrl?: string;
      planListUrl?: string;
    };
    extractedValidUrl: string; // 有効URL抽出結果
    afterNormalize: string;
    finalHrefSample: string;
    affiliateIdPresent: boolean; // アフィリエイトID設定状況
    selectedFrom: string; // 選択元（hb.afl or travel.rakuten）
    envAffiliateId: boolean; // 環境変数設定状況
    extractedHotelId: number; // 抽出されたホテルID
    finalTarget: string; // 最終ターゲットURL
  };
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
    name: "上野プレミアムホテル",
    area: "台東区",
    nearest: "上野駅",
    price: 4200,
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
    rating: 4.0
  },
  {
    id: "hotel_7",
    name: "新橋ステーションホテル",
    area: "港区",
    nearest: "新橋駅",
    price: 5500,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/shinbashi/1200/800",
    affiliateUrl: "https://example.com/hotel7",
    rating: 4.0
  },
  {
    id: "hotel_8",
    name: "六本木プレミアムイン",
    area: "港区",
    nearest: "六本木駅",
    price: 9800,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/roppongi/1200/800",
    affiliateUrl: "https://example.com/hotel8",
    rating: 4.3
  },
  {
    id: "hotel_9",
    name: "池袋ナイトホテル",
    area: "豊島区",
    nearest: "池袋駅",
    price: 4200,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/ikebukuro2/1200/800",
    affiliateUrl: "https://example.com/hotel9",
    rating: 4.0
  },
  {
    id: "hotel_10",
    name: "品川ビューホテル",
    area: "品川区",
    nearest: "品川駅",
    price: 6800,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/shinagawa/1200/800",
    affiliateUrl: "https://example.com/hotel10",
    rating: 4.1
  },
  {
    id: "hotel_11",
    name: "浅草トラディショナル",
    area: "台東区",
    nearest: "浅草駅",
    price: 5200,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/asakusa/1200/800",
    affiliateUrl: "https://example.com/hotel11",
    rating: 4.4
  },
  {
    id: "hotel_12",
    name: "秋葉原テックホテル",
    area: "千代田区",
    nearest: "秋葉原駅",
    price: 5800,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/akihabara/1200/800",
    affiliateUrl: "https://example.com/hotel12",
    rating: 4.0
  },
  {
    id: "hotel_13",
    name: "原宿デザインホテル",
    area: "渋谷区",
    nearest: "原宿駅",
    price: 8500,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/harajuku/1200/800",
    affiliateUrl: "https://example.com/hotel13",
    rating: 4.2
  },
  {
    id: "hotel_14",
    name: "銀座エレガントイン",
    area: "中央区",
    nearest: "銀座駅",
    price: 11500,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/ginza/1200/800",
    affiliateUrl: "https://example.com/hotel14",
    rating: 4.6
  },
  {
    id: "hotel_15",
    name: "恵比寿ガーデンホテル",
    area: "渋谷区",
    nearest: "恵比寿駅",
    price: 7800,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/ebisu/1200/800",
    affiliateUrl: "https://example.com/hotel15",
    rating: 4.3
  },
  {
    id: "hotel_16",
    name: "新宿サウスタワー",
    area: "新宿区",
    nearest: "新宿駅",
    price: 6200,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/shinjuku3/1200/800",
    affiliateUrl: "https://example.com/hotel16",
    rating: 4.0
  },
  {
    id: "hotel_17",
    name: "有楽町セントラルホテル",
    area: "千代田区",
    nearest: "有楽町駅",
    price: 7500,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/yurakucho/1200/800",
    affiliateUrl: "https://example.com/hotel17",
    rating: 4.1
  },
  {
    id: "hotel_18",
    name: "神田ビジネスイン",
    area: "千代田区",
    nearest: "神田駅",
    price: 4900,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/kanda/1200/800",
    affiliateUrl: "https://example.com/hotel18",
    rating: 4.0
  },
  {
    id: "hotel_19",
    name: "目黒リバーサイド",
    area: "品川区",
    nearest: "目黒駅",
    price: 6500,
    amenities: ["WiFi", "シャワー", "2人可"],
    imageUrl: "https://picsum.photos/seed/meguro/1200/800",
    affiliateUrl: "https://example.com/hotel19",
    rating: 4.2
  },
  {
    id: "hotel_20",
    name: "新橋コンフォートホテル",
    area: "港区",
    nearest: "新橋駅",
    price: 5800,
    amenities: ["WiFi", "シャワー"],
    imageUrl: "https://picsum.photos/seed/shinbashi2/1200/800",
    affiliateUrl: "https://example.com/hotel20",
    rating: 4.0
  }
];