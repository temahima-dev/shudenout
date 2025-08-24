import { NextRequest, NextResponse } from "next/server";
import { searchHotels } from "@/lib/providers/rakuten";
import { HOTELS } from "@/app/data/hotels";
import { filterQualityHotels } from "@/lib/filters/quality";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // URLパラメータを取得
    const area = searchParams.get("area") || undefined;
    const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : undefined;
    const amenities = searchParams.get("amenities")?.split(",").filter(Boolean) || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1;
    
    // 楽天API検索
    const rakutenResult = await searchHotels({
      lat: 35.6896, // デフォルト：新宿
      lng: 139.6917,
      radiusKm: 3.0,
      page,
      hits: 30,
      minCharge: minPrice,
      maxCharge: maxPrice,
      sort: "+roomCharge" as "+roomCharge"
    });
    
    // 楽天APIの結果が空の場合はモックデータを返す
    if (rakutenResult.items.length === 0) {
      console.log("楽天API結果が空のため、モックデータを使用");
      
      // モックデータにフィルタリングを適用
      let filteredMockData = [...HOTELS];
      
      // エリアフィルタ
      if (area) {
        filteredMockData = filteredMockData.filter(hotel => hotel.area === area);
      }
      
      // 価格フィルタ
      if (minPrice !== undefined) {
        filteredMockData = filteredMockData.filter(hotel => hotel.price >= minPrice);
      }
      if (maxPrice !== undefined) {
        filteredMockData = filteredMockData.filter(hotel => hotel.price <= maxPrice);
      }
      
      // 設備フィルタ（AND条件）
      if (amenities && amenities.length > 0) {
        filteredMockData = filteredMockData.filter(hotel => 
          amenities.every(amenity => hotel.amenities.includes(amenity as any))
        );
      }
      
      // 品質フィルターを適用
      filteredMockData = filterQualityHotels(filteredMockData);
      
      return NextResponse.json({ hotels: filteredMockData, success: true });
    }
    
    // 品質フィルターを適用
    const qualityFilteredItems = filterQualityHotels(rakutenResult.items);
    
    return NextResponse.json({ hotels: qualityFilteredItems, success: true });
  } catch (error) {
    console.error("Hotels API error:", error);
    return NextResponse.json({ hotels: [], success: false }, { status: 500 });
  }
}
