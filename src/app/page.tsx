"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HotelCard from "@/app/components/HotelCard";
import PerformanceMonitor from "@/app/components/PerformanceMonitor";
import { type Hotel } from "@/app/data/hotels";
import { 
  getCurrentPosition, 
  calculateDistance, 
  distanceToWalkingTime, 
  formatDistance, 
  formatWalkingTime,
  type Coordinates 
} from "@/lib/geolocation";
import { cacheManager } from "@/lib/cache";
import { apiOptimizer } from "@/lib/api-optimizer";
import { trackHotelSearch, trackLocationUsage, trackFilterUsage } from "@/lib/analytics";

type AreaFilter = "全て" | "新宿" | "渋谷" | "上野" | "新橋" | "池袋" | "六本木";
type PriceFilter = "指定なし" | "~5000" | "~10000" | "10000~";

// 現在の日付をYYYY-MM-DD形式で取得
function getTodayString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// 明日の日付をYYYY-MM-DD形式で取得
function getTomorrowString(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [areaFilter, setAreaFilter] = useState<AreaFilter>("全て");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("指定なし");
  const [amenityFilters, setAmenityFilters] = useState<string[]>([]);
  
  // 現在地関連の状態
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState(false);
  const [checkinDate, setCheckinDate] = useState<string>(getTodayString());
  const [checkoutDate, setCheckoutDate] = useState<string>(getTomorrowString());
  const [adultNum, setAdultNum] = useState<number>(2);
  const [displayCount, setDisplayCount] = useState<number>(30);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isSampleData, setIsSampleData] = useState<boolean>(false);

  // URLからの状態復元
  useEffect(() => {
    const area = searchParams.get("area");
    const price = searchParams.get("price");
    const amenities = searchParams.get("amenities");
    const count = searchParams.get("count");
    const checkin = searchParams.get("checkin");
    const checkout = searchParams.get("checkout");
    const adults = searchParams.get("adults");

    if (area === "shinjuku") setAreaFilter("新宿");
    else if (area === "shibuya") setAreaFilter("渋谷");
    else if (area === "ueno") setAreaFilter("上野");
    else if (area === "shinbashi") setAreaFilter("新橋");
    else if (area === "ikebukuro") setAreaFilter("池袋");
    else if (area === "roppongi") setAreaFilter("六本木");
    else setAreaFilter("全て");

    if (price === "lt5k") setPriceFilter("~5000");
    else if (price === "lt10k") setPriceFilter("~10000");
    else if (price === "gte10k") setPriceFilter("10000~");
    else setPriceFilter("指定なし");

    if (amenities) {
      setAmenityFilters(amenities.split(",").filter(Boolean));
    } else {
      setAmenityFilters([]);
    }

    if (count) {
      const numCount = parseInt(count, 10);
      if (!isNaN(numCount) && numCount > 0) {
        setDisplayCount(numCount);
      }
    }

    // 日付の復元（デフォルトは今日〜明日）
    if (checkin && /^\d{4}-\d{2}-\d{2}$/.test(checkin)) {
      setCheckinDate(checkin);
    }
    if (checkout && /^\d{4}-\d{2}-\d{2}$/.test(checkout)) {
      setCheckoutDate(checkout);
    }

    // 人数の復元（デフォルト2名）
    if (adults) {
      const numAdults = parseInt(adults, 10);
      if (!isNaN(numAdults) && numAdults >= 1 && numAdults <= 4) {
        setAdultNum(numAdults);
      }
    } else {
      setAdultNum(2); // URLパラメータがない場合のデフォルト
    }
  }, [searchParams]);

  // URLクエリ更新関数
  const updateURL = useCallback((updates: {
    area?: AreaFilter;
    price?: PriceFilter;
    amenities?: string[];
    count?: number;
    checkin?: string;
    checkout?: string;
    adults?: number;
  }) => {
    const params = new URLSearchParams();
    
    const newArea = updates.area ?? areaFilter;
    const newPrice = updates.price ?? priceFilter;
    const newAmenities = updates.amenities ?? amenityFilters;
    const newCount = updates.count ?? displayCount;
    const newCheckin = updates.checkin ?? checkinDate;
    const newCheckout = updates.checkout ?? checkoutDate;
    const newAdults = updates.adults ?? adultNum;
    
    // area
    if (newArea === "新宿") params.set("area", "shinjuku");
    else if (newArea === "渋谷") params.set("area", "shibuya");
    else if (newArea === "上野") params.set("area", "ueno");
    else if (newArea === "新橋") params.set("area", "shinbashi");
    else if (newArea === "池袋") params.set("area", "ikebukuro");
    else if (newArea === "六本木") params.set("area", "roppongi");
    
    // price
    if (newPrice === "~5000") params.set("price", "lt5k");
    else if (newPrice === "~10000") params.set("price", "lt10k");
    else if (newPrice === "10000~") params.set("price", "gte10k");
    
    // amenities
    if (newAmenities.length > 0) {
      params.set("amenities", newAmenities.join(","));
    }
    
    // count
    if (newCount > 30) {
      params.set("count", newCount.toString());
    }
    
    // 日付（デフォルトの今日〜明日以外の場合のみ設定）
    const todayStr = getTodayString();
    const tomorrowStr = getTomorrowString();
    if (newCheckin !== todayStr) {
      params.set("checkin", newCheckin);
    }
    if (newCheckout !== tomorrowStr) {
      params.set("checkout", newCheckout);
    }
    
    // 人数（2人以外の場合のみ設定）
    if (newAdults !== 2) {
      params.set("adults", newAdults.toString());
    }
    
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, areaFilter, priceFilter, amenityFilters, displayCount, checkinDate, checkoutDate, adultNum]);

  // APIからホテルデータを取得
  const fetchHotels = useCallback(async () => {
    // 既存のリクエストをキャンセル
    if (abortController) {
      abortController.abort();
    }
    
    const controller = new AbortController();
    setAbortController(controller);
    
    // キャッシュキー用のパラメータ作成
    const cacheParams = {
      areaFilter,
      priceFilter,
      amenityFilters: amenityFilters.sort().join(','),
      checkinDate,
      checkoutDate,
      adultNum,
      displayCount,
      useCurrentLocation,
      currentLocation: currentLocation ? `${currentLocation.lat},${currentLocation.lng}` : null
    };
    
    // キャッシュから検索結果を取得
    const cachedResult = cacheManager.getSearchResults(cacheParams);
    if (cachedResult) {
      console.log('🚀 キャッシュから検索結果を取得');
      setHotels(cachedResult.items);
      setIsSampleData(cachedResult.isSample || cachedResult.fallback || false);
      setLoading(false);
      setAbortController(null);
      return;
    }
    
    setLoading(true);
    try {
      // 楽天API検索用のパラメータ変換
      const rakutenParams = new URLSearchParams();
      
      // 座標検索の設定（現在地 > エリアフィルタの優先順位）
      if (useCurrentLocation && currentLocation) {
        // 現在地を使用
        rakutenParams.set("lat", currentLocation.lat.toString());
        rakutenParams.set("lng", currentLocation.lng.toString());
        rakutenParams.set("radiusKm", "1.0"); // 1km圏内
      } else if (areaFilter !== "全て") {
        // エリアフィルタを使用
        const coordinates = {
          "新宿": { lat: 35.6896, lng: 139.6917 },
          "渋谷": { lat: 35.6580, lng: 139.7016 }, 
          "上野": { lat: 35.7141, lng: 139.7774 },
          "新橋": { lat: 35.6662, lng: 139.7580 },
          "池袋": { lat: 35.7295, lng: 139.7109 },
          "六本木": { lat: 35.6627, lng: 139.7314 }
        };
        const coord = coordinates[areaFilter as keyof typeof coordinates];
        if (coord) {
          rakutenParams.set("lat", coord.lat.toString());
          rakutenParams.set("lng", coord.lng.toString());
          rakutenParams.set("radiusKm", "2.0"); // 2.0km圏内
        }
      } else {
        // 全て選択時は東京都内広範囲（新宿を中心により広く）
        rakutenParams.set("lat", "35.6896"); // 新宿座標
        rakutenParams.set("lng", "139.6917");
        rakutenParams.set("radiusKm", "10.0"); // 10km圏内（東京都内ほぼ全域）
      }
      
      // 価格フィルタ
      if (priceFilter !== "指定なし") {
        if (priceFilter === "~5000") rakutenParams.set("maxCharge", "5000");
        else if (priceFilter === "~10000") rakutenParams.set("maxCharge", "10000");
        else if (priceFilter === "10000~") rakutenParams.set("minCharge", "10000");
      }
      
      // 日付・人数（空室検索のため）
      rakutenParams.set("checkinDate", checkinDate);
      rakutenParams.set("checkoutDate", checkoutDate);
      rakutenParams.set("adultNum", adultNum.toString());
      rakutenParams.set("roomNum", "1"); // 1部屋固定
      
      // 設備フィルタ（楽天APIでは詳細検索が必要なため、後でフィルタ）
      if (amenityFilters.length > 0) {
        rakutenParams.set("amenities", amenityFilters.join(","));
      }
      
      // ページング（楽天API対応）
      const itemsPerPage = 30; // 楽天API最大値
      const currentPage = Math.ceil(displayCount / itemsPerPage) || 1;
      rakutenParams.set("page", currentPage.toString());
      rakutenParams.set("hits", itemsPerPage.toString());
      
      // ソート（安い順）
      rakutenParams.set("sort", "+roomCharge");
      
      // 楽天API呼び出し（重複防止付き）
      const apiUrl = `/api/rakuten/search`;
      const apiParams = Object.fromEntries(rakutenParams.entries());
      
      // デバッグ用ログ（エリアフィルター問題解決のため）
      console.log("🔍 API Request Debug:", {
        areaFilter,
        apiUrl: `${apiUrl}?${rakutenParams.toString()}`,
        params: apiParams
      });
      
      const data = await apiOptimizer.deduplicateRequest(
        apiUrl,
        apiParams,
        async () => {
          const response = await fetch(`${apiUrl}?${rakutenParams.toString()}`, {
            signal: controller.signal,
            cache: 'no-store'
          });
          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }
          return response.json();
        }
      );
      
      if (data.items) {
        // 設備フィルタをクライアント側で適用（楽天APIでは詳細情報が取得困難なため）
        let filteredItems = data.items;
        if (amenityFilters.length > 0) {
          filteredItems = data.items.filter((hotel: Hotel) =>
            amenityFilters.every(amenity => hotel.amenities.includes(amenity as any))
          );
        }
        
        // 現在地が利用可能な場合、距離情報を計算して追加
        if (useCurrentLocation && currentLocation) {
          filteredItems = filteredItems.map((hotel: Hotel) => {
            if (hotel.latitude && hotel.longitude) {
              const distanceKm = calculateDistance(
                currentLocation,
                { lat: hotel.latitude, lng: hotel.longitude }
              );
              const walkingTimeMinutes = distanceToWalkingTime(distanceKm);
              
              return {
                ...hotel,
                distanceKm,
                walkingTimeMinutes,
              };
            }
            return hotel;
          });
          
          // 距離順でソート（近い順）
          filteredItems.sort((a: Hotel, b: Hotel) => {
            if (a.distanceKm && b.distanceKm) {
              return a.distanceKm - b.distanceKm;
            }
            if (a.distanceKm) return -1;
            if (b.distanceKm) return 1;
            return 0;
          });
        }
        
        setHotels(filteredItems);
        setIsSampleData(data.isSample || data.fallback || false);
        
        // アナリティクス追跡
        trackHotelSearch({
          area: areaFilter !== "全て" ? areaFilter : undefined,
          priceFilter: priceFilter !== "指定なし" ? priceFilter : undefined,
          amenities: amenityFilters,
          useCurrentLocation,
          resultCount: filteredItems.length,
        });
        
        // 結果をキャッシュに保存
        const cacheData = {
          items: filteredItems,
          paging: data.paging || {
            total: filteredItems.length,
            page: 1,
            totalPages: 1,
            hasNext: false
          },
          fallback: data.fallback || false
        };
        cacheManager.setSearchResults(cacheParams, cacheData);
      } else {
        setHotels([]);
        setIsSampleData(false);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // リクエストがキャンセルされた場合は何もしない
      }
      console.error("Failed to fetch hotels:", error);
      setHotels([]);
    } finally {
      setLoading(false);
      setAbortController(null);
    }
  }, [areaFilter, priceFilter, amenityFilters, displayCount, checkinDate, checkoutDate, adultNum, abortController, useCurrentLocation, currentLocation]);
  
  // デバウンス付きでAPIを呼び出し
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchHotels();
    }, 250);
    
    return () => clearTimeout(timeoutId);
  }, [areaFilter, priceFilter, amenityFilters, displayCount, checkinDate, checkoutDate, adultNum]);

  // APIで既にフィルタリング済み
  const filteredHotels = hotels;

  // 表示用のホテルリスト（段階表示対応）
  const displayedHotels = filteredHotels.slice(0, displayCount);
  const hasMoreHotels = displayCount < filteredHotels.length;

  const handleAmenityToggle = (amenity: string) => {
    const newAmenities = amenityFilters.includes(amenity)
      ? amenityFilters.filter(a => a !== amenity)
      : [...amenityFilters, amenity];
    
    setAmenityFilters(newAmenities);
    setDisplayCount(30);
    updateURL({ amenities: newAmenities, count: 30 });
  };

  // 現在地取得関数
  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const result = await getCurrentPosition();
      setCurrentLocation(result.coords);
      setUseCurrentLocation(true);
      
      // アナリティクス追跡
      trackLocationUsage(true);
      
      if (result.error) {
        console.warn("位置情報取得警告:", result.error);
      }
    } catch (error) {
      console.error("位置情報取得エラー:", error);
      
      // エラーをアナリティクスに送信
      trackLocationUsage(false, (error as Error).message);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleResetFilters = () => {
    setAreaFilter("全て");
    setPriceFilter("指定なし");
    setAmenityFilters([]);
    setCheckinDate(getTodayString());
    setCheckoutDate(getTomorrowString());
    setAdultNum(2);
    setDisplayCount(30);
    setUseCurrentLocation(false);
    setCurrentLocation(null);
    router.replace("/", { scroll: false });
  };

  const handleLoadMore = () => {
    const newCount = displayCount + 30; // 楽天APIページサイズに合わせて30件ずつ
    setDisplayCount(newCount);
    updateURL({ count: newCount });
  };



  const handleAreaChange = (area: AreaFilter) => {
    setAreaFilter(area);
    setDisplayCount(30);
    updateURL({ area, count: 30 });
  };

  const handlePriceChange = (price: PriceFilter) => {
    setPriceFilter(price);
    setDisplayCount(30);
    updateURL({ price, count: 30 });
  };

  const handleCheckinDateChange = (date: string) => {
    setCheckinDate(date);
    setDisplayCount(30);
    updateURL({ checkin: date, count: 30 });
  };

  const handleCheckoutDateChange = (date: string) => {
    setCheckoutDate(date);
    setDisplayCount(30);
    updateURL({ checkout: date, count: 30 });
  };

  const handleAdultNumChange = (num: number) => {
    setAdultNum(num);
    setDisplayCount(30);
    updateURL({ adults: num, count: 30 });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800 text-white py-12 md:py-16 px-4 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-black/10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGcgZmlsbD0ibm9uZSIgZmlsbC1ydWxlPSJldmVub2RkIj4KPGcgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjA1Ij4KPGNpcmNsZSBjeD0iMyIgY3k9IjMiIHI9IjMiLz4KPC9nPgo8L2c+Cjwvc3ZnPg==')] opacity-30"></div>
        </div>
        
        <div className="relative max-w-5xl mx-auto text-center">
          {/* メインコピー */}
          <div className="mb-8">
            <div className="inline-flex items-center bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="text-yellow-300 mr-2">⚡</span>
              緊急時対応 24時間利用可能
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-100">
                終電あとホテル
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl font-medium mb-6 text-blue-50">
              終電を逃しても、大丈夫。
            </p>
          </div>

          {/* 特徴・実績 - ボックス型横並び */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 mb-6">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 md:p-4 text-center border border-white/20">
              <div className="text-lg md:text-2xl font-bold text-yellow-300 mb-1">30秒</div>
              <div className="text-xs md:text-sm text-blue-100">最短検索</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 md:p-4 text-center border border-white/20">
              <div className="text-lg md:text-2xl font-bold text-yellow-300 mb-1">1000+</div>
              <div className="text-xs md:text-sm text-blue-100">対応ホテル</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3 md:p-4 text-center border border-white/20">
              <div className="text-lg md:text-2xl font-bold text-yellow-300 mb-1">24h</div>
              <div className="text-xs md:text-sm text-blue-100">いつでも利用</div>
            </div>
          </div>

          {/* 信頼性表示 */}
          <div className="text-sm text-blue-200 opacity-75">
            ⭐ 安心の楽天トラベル提携・即時予約可能
          </div>
        </div>
      </section>
      
      {/* フィルタ Section */}
      <section id="filters" className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          {/* 日付・人数選択 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 rounded-xl mb-6 border border-blue-100 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              📅 宿泊日・人数
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              希望の日付・人数を指定してホテルを検索できます。空室状況は各予約サイトでご確認ください。
            </p>
            {/* モバイル: 1列、デスクトップ: 3列レイアウト */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* チェックイン日 */}
              <div>
                {/* デスクトップ表示: 見出しを上に配置 */}
                <label className="hidden sm:block text-sm font-medium text-gray-700 mb-2">
                  チェックイン
                </label>
                {/* スマホ表示: 見出しと入力フィールドを横並び */}
                <div className="sm:hidden flex items-center space-x-2">
                  <label className="text-sm font-bold text-gray-800 w-8 flex-shrink-0">
                    IN
                  </label>
                  <input
                    id="checkin-mobile"
                    type="date"
                    value={checkinDate}
                    min={getTodayString()}
                    onChange={(e) => handleCheckinDateChange(e.target.value)}
                    className="max-w-xs p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base shadow-sm cursor-pointer text-gray-900"
                  />
                </div>
                {/* デスクトップ表示: 通常の入力フィールド */}
                <input
                  id="checkin-desktop"
                  type="date"
                  value={checkinDate}
                  min={getTodayString()}
                  onChange={(e) => handleCheckinDateChange(e.target.value)}
                  className="hidden sm:block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm cursor-pointer text-gray-900"
                />
              </div>

              {/* チェックアウト日 */}
              <div>
                {/* デスクトップ表示: 見出しを上に配置 */}
                <label className="hidden sm:block text-sm font-medium text-gray-700 mb-2">
                  チェックアウト
                </label>
                {/* スマホ表示: 見出しと入力フィールドを横並び */}
                <div className="sm:hidden flex items-center space-x-2">
                  <label className="text-sm font-bold text-gray-800 w-8 flex-shrink-0">
                    OUT
                  </label>
                  <input
                    id="checkout-mobile"
                    type="date"
                    value={checkoutDate}
                    min={checkinDate}
                    onChange={(e) => handleCheckoutDateChange(e.target.value)}
                    className="max-w-xs p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base shadow-sm cursor-pointer text-gray-900"
                  />
                </div>
                {/* デスクトップ表示: 通常の入力フィールド */}
                <input
                  id="checkout-desktop"
                  type="date"
                  value={checkoutDate}
                  min={checkinDate}
                  onChange={(e) => handleCheckoutDateChange(e.target.value)}
                  className="hidden sm:block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm cursor-pointer text-gray-900"
                />
              </div>

              {/* 人数 */}
              <div>
                {/* デスクトップ表示: 見出しを上に配置 */}
                <label className="hidden sm:block text-sm font-medium text-gray-700 mb-2">
                  人数
                </label>
                {/* スマホ表示: 見出しとプルダウンを横並び */}
                <div className="sm:hidden flex items-center space-x-2">
                  <label className="text-sm font-bold text-gray-800 w-8 flex-shrink-0">
                    人数
                  </label>
                  <select
                    value={adultNum}
                    onChange={(e) => handleAdultNumChange(parseInt(e.target.value))}
                    className="max-w-xs p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base shadow-sm text-gray-900"
                  >
                    <option value={2}>2人</option>
                    <option value={1}>1人</option>
                    <option value={3}>3人</option>
                    <option value={4}>4人</option>
                  </select>
                </div>
                {/* デスクトップ表示: 通常のプルダウン */}
                <select
                  value={adultNum}
                  onChange={(e) => handleAdultNumChange(parseInt(e.target.value))}
                  className="hidden sm:block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm text-gray-900"
                >
                  <option value={2}>2人</option>
                  <option value={1}>1人</option>
                  <option value={3}>3人</option>
                  <option value={4}>4人</option>
                </select>
              </div>
            </div>
          </div>

          {/* 現在地から探すセクション */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-xl border border-green-100 shadow-sm">
            <div className="flex justify-center space-x-2">
              <button
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation || useCurrentLocation}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2 shadow-sm min-w-[160px]"
              >
                {isGettingLocation ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>取得中...</span>
                  </>
                ) : useCurrentLocation ? (
                  <>
                    <span>✅</span>
                    <span>使用中</span>
                  </>
                ) : (
                  <>
                    <span>📍</span>
                    <span>現在地から探す</span>
                  </>
                )}
              </button>
              
              {/* リセットボタン */}
              {useCurrentLocation && (
                <button
                  onClick={() => {
                    setUseCurrentLocation(false);
                    setCurrentLocation(null);
                    handleAreaChange("全て");
                  }}
                  className="px-3 py-3 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center"
                  title="現在地検索を解除"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* ステータス表示 */}
            {useCurrentLocation && currentLocation && (
              <div className="mt-3 p-2 bg-green-100 rounded-lg">
                <p className="text-sm text-green-700 flex items-center justify-center">
                  ✅ 現在地周辺のホテルを表示中 (半径2km以内)
                </p>
              </div>
            )}
            
            {isGettingLocation && (
              <div className="mt-3 p-2 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-700 flex items-center justify-center">
                  📍 位置情報を取得中...しばらくお待ちください
                </p>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-base font-semibold text-gray-900 mb-4">🔍 詳細検索</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* エリアフィルタ */}
              <div className="space-y-2">
                {/* デスクトップ表示: 見出しを上に配置 */}
                <label className="hidden md:block text-sm font-medium text-gray-700">
                  エリア
                </label>
                {/* スマホ表示: 見出しとプルダウンを横並び */}
                <div className="md:hidden flex items-center space-x-2">
                  <label className="text-sm font-bold text-gray-800 w-8 flex-shrink-0">
                    場所
                  </label>
                  <select
                    value={useCurrentLocation ? "現在地" : areaFilter}
                    onChange={(e) => {
                      if (e.target.value === "現在地") {
                        handleGetCurrentLocation();
                      } else {
                        setUseCurrentLocation(false);
                        handleAreaChange(e.target.value as AreaFilter);
                      }
                    }}
                    disabled={isGettingLocation}
                    className="flex-1 p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm disabled:opacity-50 text-base text-gray-900"
                  >
                    <option value="全て">全て</option>
                    <option value="現在地">📍 現在地から検索</option>
                    <option value="新宿">新宿</option>
                    <option value="渋谷">渋谷</option>
                    <option value="上野">上野</option>
                    <option value="新橋">新橋</option>
                    <option value="池袋">池袋</option>
                    <option value="六本木">六本木</option>
                  </select>
                </div>

                {/* デスクトップ表示: 通常のプルダウン */}
                <div className="hidden md:block space-y-2">
                  <select
                    value={useCurrentLocation ? "現在地" : areaFilter}
                    onChange={(e) => {
                      if (e.target.value === "現在地") {
                        handleGetCurrentLocation();
                      } else {
                        setUseCurrentLocation(false);
                        handleAreaChange(e.target.value as AreaFilter);
                      }
                    }}
                    disabled={isGettingLocation}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm disabled:opacity-50 text-gray-900"
                  >
                    <option value="全て">全て</option>
                    <option value="現在地">📍 現在地から検索</option>
                    <option value="新宿">新宿</option>
                    <option value="渋谷">渋谷</option>
                    <option value="上野">上野</option>
                    <option value="新橋">新橋</option>
                    <option value="池袋">池袋</option>
                    <option value="六本木">六本木</option>
                  </select>

                  
                  {useCurrentLocation && currentLocation && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      ✅ 現在地周辺のホテルを表示中 (半径2km)
                    </p>
                  )}
                  {isGettingLocation && (
                    <p className="text-xs text-blue-600 flex items-center">
                      📍 位置情報を取得中...
                    </p>
                  )}
                </div>
                {/* スマホ表示: ステータス表示 */}
                <div className="md:hidden">
                  {useCurrentLocation && currentLocation && (
                    <p className="text-xs text-green-600 flex items-center mt-1">
                      ✅ 現在地周辺のホテルを表示中 (半径2km)
                    </p>
                  )}
                  {isGettingLocation && (
                    <p className="text-xs text-blue-600 flex items-center mt-1">
                      📍 位置情報を取得中...
                    </p>
                  )}
                </div>
              </div>

              {/* 価格帯フィルタ */}
              <div>
                {/* デスクトップ表示: 見出しを上に配置 */}
                <label className="hidden md:block text-sm font-medium text-gray-700 mb-2">
                  価格帯
                </label>
                {/* スマホ表示: 見出しとプルダウンを横並び */}
                <div className="md:hidden flex items-center space-x-2">
                  <label className="text-sm font-bold text-gray-800 w-8 flex-shrink-0">
                    価格
                  </label>
                  <select
                    value={priceFilter}
                    onChange={(e) => handlePriceChange(e.target.value as PriceFilter)}
                    className="flex-1 p-6 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-base text-gray-900"
                  >
                    <option value="指定なし">指定なし</option>
                    <option value="~5000">~5,000円</option>
                    <option value="~10000">~10,000円</option>
                    <option value="10000~">10,000円~</option>
                  </select>
                </div>
                {/* デスクトップ表示: 通常のプルダウン */}
                <select
                  value={priceFilter}
                  onChange={(e) => handlePriceChange(e.target.value as PriceFilter)}
                  className="hidden md:block w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm text-gray-900"
                >
                  <option value="指定なし">指定なし</option>
                  <option value="~5000">~5,000円</option>
                  <option value="~10000">~10,000円</option>
                  <option value="10000~">10,000円~</option>
                </select>
              </div>

              {/* 設備フィルタ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  設備
                </label>
                <div className="space-y-2">
                  {["シャワー", "WiFi", "2人可"].map((amenity) => (
                    <label key={amenity} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={amenityFilters.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 検索結果ヘッダー */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            検索結果
          </h2>
          <p className="text-gray-600">
            {displayedHotels.length}件表示中 / {filteredHotels.length}件が見つかりました
          </p>
                      {isSampleData && (
              <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  📄 楽天APIが失敗したため、サンプルデータを表示しています。
                  実際のデータを表示するには、API接続を確認してください。
                </p>
              </div>
            )}
        </div>

        {/* ホテル一覧 */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-2xl">🔍</div>
            <p className="text-gray-600 mt-2">ホテルを検索中...</p>
          </div>
        ) : filteredHotels.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏨</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              条件に一致するホテルがありません
            </h3>
            <p className="text-gray-600 mb-6">
              検索条件を変更するか、条件をリセットしてください
            </p>
            <button
              onClick={handleResetFilters}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
            >
              条件リセット
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedHotels.map((hotel) => (
                <HotelCard 
                  key={hotel.id} 
                  hotel={hotel}
                  checkinDate={checkinDate}
                  checkoutDate={checkoutDate}
                  adultNum={adultNum}
                />
              ))}
            </div>
            
            {/* もっと見るボタン */}
            {hasMoreHotels && (
              <div className="text-center mt-8">
                <button
                  onClick={handleLoadMore}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded transition-colors duration-200"
                >
                  さらに30件表示 ({filteredHotels.length - displayCount}件残り)
                </button>
              </div>
            )}
          </>
        )}
      </main>
      
      {/* パフォーマンス監視（開発環境のみ） */}
      <PerformanceMonitor />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="p-4">読み込み中...</div>}>
      <HomeContent />
    </Suspense>
  );
}
