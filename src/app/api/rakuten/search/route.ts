import { NextRequest, NextResponse } from "next/server";
import { searchHotels, searchVacancy, shouldUseFallback } from "@/lib/providers/rakuten";
import { HOTELS } from "@/app/data/hotels";
import { filterQualityHotels } from "@/lib/filters/quality";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // APIキーが設定されていない場合は即座にfallbackを返す
    if (shouldUseFallback()) {
      console.warn("RAKUTEN_APP_ID not configured, using fallback data");
      
      // モックデータのフィルタリング
      let filteredHotels = HOTELS;
      
      // エリアフィルタ（middleClassCodeまたはareaパラメータ）
      const area = searchParams.get("area");
      const middleClassCode = searchParams.get("middleClassCode");
      
      if (area) {
        const targetArea = area === "新宿区" ? "新宿区" : 
                          area === "渋谷区" ? "渋谷区" : 
                          area === "台東区" ? "台東区" : undefined;
        if (targetArea) {
          filteredHotels = filteredHotels.filter(hotel => hotel.area === targetArea);
        }
      } else if (middleClassCode) {
        // エリアコードマッピング
        const areaMapping: Record<string, string> = {
          "A1304": "新宿区",
          "A1303": "渋谷区", 
          "A1308": "台東区",
        };
        const targetArea = areaMapping[middleClassCode];
        if (targetArea) {
          filteredHotels = filteredHotels.filter(hotel => hotel.area === targetArea);
        }
      }
      
      // 価格フィルタ
      const minCharge = searchParams.get("minCharge");
      const maxCharge = searchParams.get("maxCharge");
      
      if (minCharge) {
        const min = parseInt(minCharge);
        filteredHotels = filteredHotels.filter(hotel => hotel.price >= min);
      }
      
      if (maxCharge) {
        const max = parseInt(maxCharge);
        filteredHotels = filteredHotels.filter(hotel => hotel.price <= max);
      }
      
      // 設備フィルタ
      const amenities = searchParams.get("amenities");
      if (amenities) {
        const amenityList = amenities.split(",").filter(Boolean);
        filteredHotels = filteredHotels.filter(hotel =>
          amenityList.every(amenity => hotel.amenities.includes(amenity as any))
        );
      }
      
      // 品質フィルターを適用
      filteredHotels = filterQualityHotels(filteredHotels);
      
      // ページング
      const page = parseInt(searchParams.get("page") || "1");
      const hits = parseInt(searchParams.get("hits") || "10");
      const startIndex = (page - 1) * hits;
      const endIndex = startIndex + hits;
      const paginatedHotels = filteredHotels.slice(startIndex, endIndex);
      
      return NextResponse.json({
        items: paginatedHotels,
        paging: {
          total: filteredHotels.length,
          page: page,
          totalPages: Math.ceil(filteredHotels.length / hits),
          hasNext: endIndex < filteredHotels.length,
        },
        fallback: true,
      });
    }

    // リクエストパラメータの解析
    const lat = searchParams.get("lat") ? parseFloat(searchParams.get("lat")!) : undefined;
    const lng = searchParams.get("lng") ? parseFloat(searchParams.get("lng")!) : undefined;
    const radiusKm = searchParams.get("radiusKm") ? parseFloat(searchParams.get("radiusKm")!) : undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1;
    const hits = searchParams.get("hits") ? parseInt(searchParams.get("hits")!) : 10;
    
    // 宿泊条件（空室検索用）
    const checkinDate = searchParams.get("checkinDate") || undefined;
    const checkoutDate = searchParams.get("checkoutDate") || undefined;
    const adultNum = searchParams.get("adultNum") ? parseInt(searchParams.get("adultNum")!) : undefined;
    const roomNum = searchParams.get("roomNum") ? parseInt(searchParams.get("roomNum")!) : undefined;
    
    // 価格範囲
    const minCharge = searchParams.get("minCharge") ? parseInt(searchParams.get("minCharge")!) : undefined;
    const maxCharge = searchParams.get("maxCharge") ? parseInt(searchParams.get("maxCharge")!) : undefined;
    
    // エリアコード
    const largeClassCode = searchParams.get("largeClassCode") || undefined;
    const middleClassCode = searchParams.get("middleClassCode") || undefined;
    const smallClassCode = searchParams.get("smallClassCode") || undefined;
    const detailClassCode = searchParams.get("detailClassCode") || undefined;
    
    // ソート
    const sort = searchParams.get("sort") as "standard" | "+roomCharge" | "-roomCharge" | undefined;
    
    const apiParams = {
      lat,
      lng,
      radiusKm,
      page,
      hits,
      checkinDate,
      checkoutDate,
      adultNum,
      roomNum,
      minCharge,
      maxCharge,
      largeClassCode,
      middleClassCode,
      smallClassCode,
      detailClassCode,
      sort,
    };

    // VacantHotelSearch API制限のため、常にSimpleHotelSearchを使用
    // 日付・人数情報はアフィリエイトURLに反映される
    console.log("楽天API SimpleHotelSearch を実行:", apiParams);
    
    // 楽天・じゃらん並行検索
    const { searchJalan } = await import("@/lib/providers/jalan");
    const { dedupeAndMerge } = await import("@/lib/merge");
    
    const [rakutenResult, jalanHotels] = await Promise.all([
      searchHotels(apiParams),
      searchJalan({
        lat: apiParams.lat,
        lng: apiParams.lng,
        radiusKm: apiParams.radiusKm,
        priceMin: apiParams.minCharge,
        priceMax: apiParams.maxCharge,
        page: apiParams.page,
        hits: apiParams.hits
      })
    ]);
    
    console.log("楽天API結果件数:", rakutenResult.items.length);
    console.log("じゃらんAPI結果件数:", jalanHotels.length);
    
    // 結果を統合・重複除去
    const combinedItems = dedupeAndMerge(rakutenResult.items, jalanHotels);
    console.log("統合後件数:", combinedItems.length);
    
    const result = {
      ...rakutenResult,
      items: combinedItems
    };

    // 楽天APIの結果が空の場合はモックデータを使用
    if (result.items.length === 0) {
      console.log("楽天API結果が空のため、モックデータを使用");
      const { HOTELS } = await import("@/app/data/hotels");
      const mockResult = {
        items: HOTELS.slice(0, 20),
        paging: { total: HOTELS.length, page: 1, totalPages: Math.ceil(HOTELS.length / 20), hasNext: true }
      };
      const qualityFilteredItems = filterQualityHotels(mockResult.items);
      
      return NextResponse.json({
        ...mockResult,
        items: qualityFilteredItems,
        paging: {
          ...mockResult.paging,
          total: qualityFilteredItems.length
        },
        fallback: true, // モックデータ使用中
      });
    }

    // 品質フィルターを適用（低品質ホテルを除外）
    const qualityFilteredItems = filterQualityHotels(result.items);
    console.log("品質フィルター適用後:", qualityFilteredItems.length, "/", result.items.length);

    return NextResponse.json({
      ...result,
      items: qualityFilteredItems,
      paging: {
        ...result.paging,
        total: qualityFilteredItems.length,
        totalPages: Math.ceil(qualityFilteredItems.length / (result.paging.totalPages > 0 ? result.items.length / result.paging.totalPages : 30)),
        hasNext: qualityFilteredItems.length > (result.paging.totalPages > 0 ? result.items.length / result.paging.totalPages : 30),
      },
      fallback: false,
    });

  } catch (error) {
    console.error("楽天API Route Error:", error);
    
    // エラー時はfallbackデータを返す
    console.warn("楽天API失敗、fallbackデータを使用");
    
    return NextResponse.json({
      items: HOTELS.slice(0, 6), // デフォルトで6件
      paging: {
        total: HOTELS.length,
        page: 1,
        totalPages: Math.ceil(HOTELS.length / 6),
        hasNext: HOTELS.length > 6,
      },
      fallback: true,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
