import { NextRequest, NextResponse } from "next/server";
import { getHotelDetail, shouldUseFallback } from "@/lib/providers/rakuten";
import { HOTELS } from "@/app/data/hotels";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelNo = searchParams.get("hotelNo");

    if (!hotelNo || isNaN(parseInt(hotelNo))) {
      return NextResponse.json(
        { error: "hotelNo parameter is required and must be a number" },
        { status: 400 }
      );
    }

    // APIキーが設定されていない場合はfallbackデータから検索
    if (shouldUseFallback()) {
      console.warn("RAKUTEN_APP_ID not configured, using fallback data");
      
      // モックデータから該当するホテルを検索（IDからホテル番号を抽出）
      const targetId = `rakuten_${hotelNo}`;
      const hotel = HOTELS.find(h => h.id === targetId) || HOTELS[0]; // 見つからない場合は最初のホテル
      
      return NextResponse.json({
        hotel,
        fallback: true,
      });
    }

    console.log("楽天API HotelDetailSearch を実行:", { hotelNo });
    const hotel = await getHotelDetail(parseInt(hotelNo));

    if (!hotel) {
      return NextResponse.json(
        { error: "Hotel not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      hotel,
      fallback: false,
    });

  } catch (error) {
    console.error("楽天API Detail Route Error:", error);
    
    // エラー時はfallbackデータの最初のホテルを返す
    return NextResponse.json({
      hotel: HOTELS[0],
      fallback: true,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
