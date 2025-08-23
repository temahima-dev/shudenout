import { type Hotel } from "@/app/data/hotels";

type NormalizedHotel = Hotel;

interface JalanParams {
  area?: string;
  priceMin?: number;
  priceMax?: number;
  page?: number;
  hits?: number;
}

interface JalanHotel {
  HotelName: string;
  SmallArea: string;
  NearStation: string;
  HotelMinCharge: number;
  PictureUrl: string;
  SalesformUrl: string;
  CustomerEvaluationAverage?: number;
  X?: number;
  Y?: number;
}

const AREA_MAP: Record<string, string> = {
  shinjuku: "新宿",
  shibuya: "渋谷", 
  ueno: "上野",
  shinbashi: "新橋",
  ikebukuro: "池袋",
  roppongi: "六本木"
};

export async function searchJalan(params: JalanParams): Promise<NormalizedHotel[]> {
  // APIキー未設定なら空配列
  if (!process.env.JALAN_API_KEY) {
    return [];
  }

  try {
    const searchParams = new URLSearchParams({
      key: process.env.JALAN_API_KEY,
      format: 'json',
      count: (params.hits || 30).toString(),
      start: (((params.page || 1) - 1) * (params.hits || 30) + 1).toString(),
      ...(params.area && AREA_MAP[params.area] && { area: AREA_MAP[params.area] }),
      ...(params.priceMin && { price_min: params.priceMin.toString() }),
      ...(params.priceMax && { price_max: params.priceMax.toString() }),
      order: '1' // 料金昇順
    });

    const response = await fetch(
      `https://jws.jalan.net/APICommon/HotelSearch?${searchParams}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const hotels = data?.Results?.Hotel || [];

    return hotels.map((hotel: JalanHotel, index: number): NormalizedHotel => ({
      id: `jalan_${hotel.HotelName}_${index}`,
      name: hotel.HotelName,
      area: hotel.SmallArea || "東京",
      nearest: hotel.NearStation || "",
      price: hotel.HotelMinCharge || 0,
      imageUrl: hotel.PictureUrl || "",
      affiliateUrl: hotel.SalesformUrl || "",
      rating: hotel.CustomerEvaluationAverage || undefined,
      amenities: [],
      latitude: hotel.Y || undefined,
      longitude: hotel.X || undefined
    }));
  } catch (error) {
    console.error('Jalan API error:', error);
    return [];
  }
}
