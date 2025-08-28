"use client";

import { type Hotel } from "@/app/data/hotels";
import { trackHotelBooking } from "@/lib/analytics";
import Image from "next/image";

interface HotelCardProps {
  hotel: Hotel;
  checkinDate?: string;
  checkoutDate?: string;
  adultNum?: number;
}

export default function HotelCard({ hotel, checkinDate, checkoutDate, adultNum }: HotelCardProps) {
  // デバッグ設定（環境変数制御・本番では無効）
  const isDebugMode = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEBUG_LINKS_UI === 'true';
  
  // アフィリエイトURL診断
  const inspectAffiliateUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const isHBAFL = urlObj.hostname === 'hb.afl.rakuten.co.jp';
      
      if (!isHBAFL) {
        return {
          isOK: false,
          reason: `Non-hb.afl: ${urlObj.hostname}`
        };
      }
      
      const pcRaw = urlObj.searchParams.get('pc') || '';
      const hasDoubleEncode = /%25[0-9A-Fa-f]{2}/.test(pcRaw);
      
      if (hasDoubleEncode) {
        return {
          isOK: false,
          reason: 'Double-encoded pc parameter'
        };
      }
      
      if (pcRaw) {
        try {
          const pcDecoded = decodeURIComponent(pcRaw);
          const pcUrlObj = new URL(pcDecoded);
          const isTravelHost = pcUrlObj.hostname === 'travel.rakuten.co.jp' || pcUrlObj.hostname === 'hotel.travel.rakuten.co.jp';
          
          if (!isTravelHost) {
            return {
              isOK: false,
              reason: `Invalid pc host: ${pcUrlObj.hostname}`
            };
          }
        } catch {
          return {
            isOK: false,
            reason: 'Invalid pc URL format'
          };
        }
      }
      
      return { isOK: true, reason: '' };
    } catch {
      return {
        isOK: false,
        reason: 'Invalid URL format'
      };
    }
  };
  
  const handleAnalyticsTracking = () => {
    // アフィリエイトURL診断
    const urlInspection = inspectAffiliateUrl(hotel.affiliateUrl);
    const domHref = hotel.affiliateUrl; // 実際のDOM hrefと同じ
    const hrefMatches = domHref === hotel.affiliateUrl;
    
    // デバッグ情報をコンソールに出力
    if (isDebugMode) {
      console.info('BOOKING_LINK', {
        hotelId: hotel.id,
        hotelName: hotel.name,
        apiAffiliateUrl: hotel.affiliateUrl,
        domHref: domHref,
        hrefMatches,
        urlInspection
      });
    }
    
    // 従来のログ
    console.log({ event: "book_click", id: hotel.id, affiliateUrl: hotel.affiliateUrl });
    
    // Google Analytics追跡
    trackHotelBooking({
      hotelId: hotel.id,
      hotelName: hotel.name,
      price: hotel.price,
      area: hotel.area,
      distanceKm: hotel.distanceKm,
    });
  };
  
  // 診断バッジ用の状態計算
  const urlInspection = isDebugMode ? inspectAffiliateUrl(hotel.affiliateUrl) : null;
  const hrefMatches = hotel.affiliateUrl === hotel.affiliateUrl; // 実際は常に true（DOMと同じ値）
  const badgeStatus = urlInspection ? (urlInspection.isOK && hrefMatches ? 'OK' : 'WARN') : null;

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
        <Image
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

        {/* 当日空室バッジ（画像上） */}
        <div className="absolute bottom-3 left-3">
          <div 
            className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
              hotel.isSameDayAvailable 
                ? 'bg-green-500/90 text-white' 
                : 'bg-yellow-500/90 text-black'
            }`}
            aria-label={hotel.isSameDayAvailable ? '本日空室あり' : '空室未確認'}
          >
            <span>{hotel.isSameDayAvailable ? '✅' : '❓'}</span>
            <span>{hotel.isSameDayAvailable ? '本日空室あり' : '空室未確認'}</span>
          </div>
        </div>
        
        {/* 診断バッジ（開発時のみ） */}
        {isDebugMode && badgeStatus && (
          <div className="absolute top-12 left-3">
            <div 
              className={`px-2 py-1 rounded text-xs font-bold ${
                badgeStatus === 'OK' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-black'
              }`}
              title={badgeStatus === 'WARN' ? urlInspection?.reason : 'All checks passed'}
            >
              {badgeStatus}
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
        <a
          href={hotel.affiliateUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleAnalyticsTracking}
          className="block w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:transform active:scale-[0.98] text-center"
          data-analytics="book"
          data-hotel-id={hotel.id}
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            今すぐ予約
          </span>
        </a>
      </div>
    </div>
  );
}