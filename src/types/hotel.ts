export type Amenity = "シャワー" | "WiFi" | "2人可";

export type PriceRange = "〜5,000円" | "〜10,000円" | "10,000円〜";

export type TokyoArea = 
  | "千代田区" | "中央区" | "港区" | "新宿区" | "文京区" | "台東区"
  | "墨田区" | "江東区" | "品川区" | "目黒区" | "大田区" | "世田谷区"
  | "渋谷区" | "中野区" | "杉並区" | "豊島区" | "北区" | "荒川区"
  | "板橋区" | "練馬区" | "足立区" | "葛飾区" | "江戸川区";

export interface Hotel {
  id: string;
  name: string;
  area: TokyoArea;
  nearestStation: string;
  price: number;
  priceDisplay: string;
  imageUrl: string;
  amenities: Amenity[];
  affiliateUrl: string;
  description?: string;
  rating?: number;
  source: "rakuten" | "jalan" | "mock";
}

export interface SearchFilters {
  area?: TokyoArea;
  priceRange?: PriceRange;
  amenities?: Amenity[];
}

export interface ApiResponse {
  hotels: Hotel[];
  total: number;
  hasError?: boolean;
  errorMessage?: string;
}
