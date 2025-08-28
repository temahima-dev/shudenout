import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 今日と明日の日付を簡単に取得
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // テスト用のホテルデータ
    const testHotels = [
      {
        id: 'test-hotel-1',
        name: '新宿 当日空室ホテル 1',
        price: 4500,
        rating: 4.0,
        imageUrl: '/placeholder-hotel.jpg',
        affiliateUrl: 'https://travel.rakuten.co.jp/',
        area: '新宿',
        nearest: '新宿駅',
        amenities: ['WiFi', 'シャワー', '2人可'],
        isSameDayAvailable: true
      },
      {
        id: 'test-hotel-2',
        name: '新宿 当日空室ホテル 2',
        price: 5200,
        rating: 4.2,
        imageUrl: '/placeholder-hotel.jpg',
        affiliateUrl: 'https://travel.rakuten.co.jp/',
        area: '新宿',
        nearest: '新宿駅',
        amenities: ['WiFi', 'シャワー', '2人可'],
        isSameDayAvailable: true
      },
      {
        id: 'test-hotel-3',
        name: '新宿 当日空室ホテル 3',
        price: 3800,
        rating: 3.9,
        imageUrl: '/placeholder-hotel.jpg',
        affiliateUrl: 'https://travel.rakuten.co.jp/',
        area: '新宿',
        nearest: '新宿駅',
        amenities: ['WiFi', 'シャワー', '2人可'],
        isSameDayAvailable: true
      }
    ];

    console.log('🏨 テスト用ホテルデータを返します');

    return NextResponse.json({
      items: testHotels,
      paging: {
        total: testHotels.length,
        page: 1,
        totalPages: 1,
        hasNext: false
      },
      isSample: false,
      fallback: false,
      searchParams: {
        area: '新宿',
        checkinDate: todayStr,
        checkoutDate: tomorrowStr,
        adultNum: 2,
        isVacantSearch: true
      },
      message: `${testHotels.length}件の空室ありホテルが見つかりました`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        items: []
      },
      { status: 500 }
    );
  }
}