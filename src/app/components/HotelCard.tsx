"use client";

import { type Hotel } from "@/app/data/hotels";
import { formatDistance, formatWalkingTime } from "@/lib/geolocation";
import { trackHotelBooking } from "@/lib/analytics";
import LazyImage from "./LazyImage";

interface HotelCardProps {
  hotel: Hotel;
  checkinDate?: string;
  checkoutDate?: string;
  adultNum?: number;
}

export default function HotelCard({ hotel, checkinDate, checkoutDate, adultNum }: HotelCardProps) {
  const handleReservationClick = () => {
    // コンソールログ（デバッグ用）
    console.log({ event: "book_click", id: hotel.id, affiliateUrl: hotel.affiliateUrl });
    
    // Google Analytics追跡
    trackHotelBooking({
      hotelId: hotel.id,
      hotelName: hotel.name,
      price: hotel.price,
      area: hotel.area,
      distanceKm: hotel.distanceKm,
    });
    
    // APIから提供されるaffiliateUrlをそのまま使用
    // 既にアフィリエイト化済みのため、余計な変換は行わない
    let finalUrl = hotel.affiliateUrl;
    
    // 楽天トラベルの正規URLの場合のみ、予約パラメータを追加
    try {
      const url = new URL(finalUrl);
      
      // travel.rakuten.co.jp の場合は検索パラメータを追加可能
      if (url.hostname === 'travel.rakuten.co.jp') {
        if (checkinDate) url.searchParams.set('checkin', checkinDate);
        if (checkoutDate) url.searchParams.set('checkout', checkoutDate);
        if (adultNum) url.searchParams.set('adults', adultNum.toString());
        url.searchParams.set('utm_source', 'shudenout');
        url.searchParams.set('utm_medium', 'affiliate');
        finalUrl = url.toString();
      }
      // hb.afl.rakuten.co.jp の場合はアフィリエイトリンクなのでそのまま
      
    } catch (error) {
      console.warn('URL処理エラー、元のURLを使用:', error);
      // エラーの場合は元のURLをそのまま使用
    }
    
    console.log('最終リンク:', finalUrl);
    window.open(finalUrl, "_blank", "noopener,noreferrer");
  };

  // 評価表示用のスター
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-yellow-400">★</span>);
    }
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-400">☆</span>);
    }
    return stars;
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out">
      {/* ホテル画像 */}
      <div className="relative h-48 w-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        <LazyImage
          src={hotel.imageUrl}
          alt={hotel.name}
          width={400}
          height={240}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500 w-full h-full"
          priority={false}
        />
        
        {/* 価格バッジ（画像上） */}
        <div className="absolute top-3 right-3">
          <div className="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm">
            <span className="text-lg font-bold text-gray-900">
              ¥{hotel.price.toLocaleString()}
            </span>
            <span className="text-xs text-gray-600 ml-1">〜</span>
          </div>
        </div>

        {/* 評価バッジ（画像上） */}
        {hotel.rating && (
          <div className="absolute top-3 left-3">
            <div className="bg-gray-900/80 backdrop-blur-sm text-white px-2 py-1 rounded-lg text-sm font-medium flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              <span>{hotel.rating}</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-5">
        {/* ホテル名 */}
        <h3 className="font-bold text-xl mb-2 text-gray-900 leading-tight line-clamp-2">
          {hotel.name}
        </h3>
        
        {/* 最寄り駅・エリア・距離 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="font-medium">{hotel.nearest}</span>
          </div>
          <span className="text-gray-300">•</span>
          <span className="text-sm text-gray-500">{hotel.area}</span>
          {hotel.distanceKm && hotel.walkingTimeMinutes && (
            <>
              <span className="text-gray-300">•</span>
              <div className="flex items-center text-sm text-blue-600 font-medium">
                <svg className="w-4 h-4 mr-1 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{formatDistance(hotel.distanceKm)} • {formatWalkingTime(hotel.walkingTimeMinutes)}</span>
              </div>
            </>
          )}
        </div>

        {/* 評価（テキスト版） */}
        {hotel.rating && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center">
              {renderStars(hotel.rating)}
            </div>
            <span className="text-sm font-medium text-gray-700">{hotel.rating}</span>
            <span className="text-xs text-gray-500">(楽天トラベル評価)</span>
          </div>
        )}
        
        {/* 設備タグ */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {hotel.amenities.slice(0, 4).map((amenity) => (
            <span
              key={amenity}
              className="inline-flex items-center bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs font-medium border border-blue-100"
            >
              {amenity}
            </span>
          ))}
          {hotel.amenities.length > 4 && (
            <span className="inline-flex items-center bg-gray-50 text-gray-600 px-2.5 py-1 rounded-md text-xs">
              +{hotel.amenities.length - 4}
            </span>
          )}
        </div>

        {/* 価格・予約ボタン */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-2xl font-bold text-gray-900">
              ¥{hotel.price.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500"> / 泊〜</span>
          </div>
        </div>
        
        {/* 予約ボタン */}
        <button
          onClick={handleReservationClick}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:transform active:scale-[0.98]"
          data-analytics="book"
          data-hotel-id={hotel.id}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            今すぐ予約
          </span>
        </button>
      </div>
    </div>
  );
}