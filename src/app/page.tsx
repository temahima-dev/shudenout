"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HotelCard from "@/app/components/HotelCard";
import PerformanceMonitor from "@/app/components/PerformanceMonitor";
import { type Hotel } from "@/app/data/hotels";
// 位置情報用の型定義
type Coordinates = {
  lat: number;
  lng: number;
};
import { apiOptimizer } from "@/lib/api-optimizer";
import { trackHotelSearch, trackLocationUsage, trackFilterUsage } from "@/lib/analytics";

type AreaFilter = "全て" | "新宿" | "渋谷" | "上野" | "新橋" | "池袋" | "六本木";
type PriceFilter = "指定なし" | "~5000" | "~10000" | "10000~";

// 当日空きのみ表示のため日付関数は不要

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
  // 当日空きのみ表示のため日付選択は削除
  const [adultNum, setAdultNum] = useState<number>(2);
  const [searchRadius, setSearchRadius] = useState<number>(3); // 半径セレクタ追加
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
    const adults = searchParams.get("adults");
    const radius = searchParams.get("radius");

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

    // 当日空きのみ表示のため日付復元は不要

    // 人数の復元（デフォルト2名）
    if (adults) {
      const numAdults = parseInt(adults, 10);
      if (!isNaN(numAdults) && numAdults >= 1 && numAdults <= 4) {
        setAdultNum(numAdults);
      }
    } else {
      setAdultNum(2); // URLパラメータがない場合のデフォルト
    }

    // 半径の復元（デフォルト3km）
    if (radius) {
      const numRadius = parseInt(radius, 10);
      if (!isNaN(numRadius) && numRadius >= 1 && numRadius <= 10) {
        setSearchRadius(numRadius);
      }
    } else {
      setSearchRadius(3); // URLパラメータがない場合のデフォルト
    }
  }, [searchParams]);

  // URLクエリ更新関数
  const updateURL = useCallback((updates: {
    area?: AreaFilter;
    price?: PriceFilter;
    amenities?: string[];
    count?: number;
    adults?: number;
  }) => {
    const params = new URLSearchParams();
    
    const newArea = updates.area ?? areaFilter;
    const newPrice = updates.price ?? priceFilter;
    const newAmenities = updates.amenities ?? amenityFilters;
    const newCount = updates.count ?? displayCount;
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
    
    // 当日空きのみ表示のため日付パラメータは不要
    
    // 人数（2人以外の場合のみ設定）
    if (newAdults !== 2) {
      params.set("adults", newAdults.toString());
    }
    
    // 半径（3km以外の場合のみ設定）
    if (searchRadius !== 3) {
      params.set("radius", searchRadius.toString());
    }
    
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [router, areaFilter, priceFilter, amenityFilters, displayCount, adultNum, searchRadius]);

  // APIからホテルデータを取得
  const fetchHotels = useCallback(async () => {
    // 既存のリクエストをキャンセル
    if (abortController) {
      abortController.abort();
    }
    
    const controller = new AbortController();
    setAbortController(controller);
    
    // 当日空室検索のためキャッシュは使用しない（リアルタイム性重視）
    
    setLoading(true);
    try {
      // 当日空室検索API用のパラメータ
      const apiParams = new URLSearchParams();
      
      // 座標検索の設定（現在地 > エリアフィルタの優先順位）
      if (useCurrentLocation && currentLocation) {
        // 現在地を使用
        apiParams.set("lat", currentLocation.lat.toString());
        apiParams.set("lng", currentLocation.lng.toString());
        apiParams.set("radiusKm", "1.0"); // 1km圏内
      } else if (areaFilter !== "全て") {
        // エリアフィルタを使用
        const areaMap = {
          "新宿": "shinjuku",
          "渋谷": "shibuya", 
          "上野": "ueno",
          "新橋": "shinbashi",
          "池袋": "ikebukuro",
          "六本木": "roppongi"
        };
        const areaCode = areaMap[areaFilter as keyof typeof areaMap];
        if (areaCode) {
          apiParams.set("area", areaCode);
        }
      } else {
        // 全て選択時
        apiParams.set("area", "all");
      }
      
      // 価格フィルタ
      if (priceFilter !== "指定なし") {
        if (priceFilter === "~5000") apiParams.set("maxCharge", "5000");
        else if (priceFilter === "~10000") apiParams.set("maxCharge", "10000");
        else if (priceFilter === "10000~") apiParams.set("minCharge", "10000");
      }
      
      // 人数
      apiParams.set("adultNum", adultNum.toString());
      
      // 検索半径
      apiParams.set("radius", searchRadius.toString());
      
      // 設備フィルタ
      if (amenityFilters.length > 0) {
        apiParams.set("amenities", amenityFilters.join(","));
      }
      
      // 当日空室検索API呼び出し（重複防止付き）
      const apiUrl = `/api/hotels`;
      const apiParamsObj = Object.fromEntries(apiParams.entries());
      
      // デバッグ用ログ
      console.log("🔍 当日空室検索 API Request:", {
        areaFilter,
        apiUrl: `${apiUrl}?${apiParams.toString()}`,
        params: apiParamsObj
      });
      
      const data = await apiOptimizer.deduplicateRequest(
        apiUrl,
        apiParamsObj,
        async () => {
          const response = await fetch(`${apiUrl}?${apiParams.toString()}`, {
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
        
        // 当日空室検索結果はそのまま表示（価格順）
        
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
        
        // 当日空室検索のためキャッシュは保存しない（リアルタイム性重視）
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
  }, [areaFilter, priceFilter, amenityFilters, displayCount, adultNum, searchRadius, abortController, useCurrentLocation, currentLocation]);
  
  // デバウンス付きでAPIを呼び出し
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchHotels();
    }, 250);
    
    return () => clearTimeout(timeoutId);
  }, [areaFilter, priceFilter, amenityFilters, displayCount, adultNum, searchRadius]);

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
      if (!navigator.geolocation) {
        throw new Error('位置情報がサポートされていません');
      }
      
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });
      
      setCurrentLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setUseCurrentLocation(true);
      
      // アナリティクス追跡
      trackLocationUsage(true);
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

  // 当日空きのみ表示のため日付変更ハンドラーは不要

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
              本日泊まれるホテルのみ表示中
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
            ⭐ 楽天トラベル空室検索・当日予約可能
          </div>
        </div>
      </section>
      
      {/* フィルタ Section */}
      <section id="filters" className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          {/* 当日空き表示説明 */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 md:p-6 rounded-xl mb-6 border border-green-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center">
              ⚡ 当日空室のみ表示中
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              本日→明日の空室があるホテルのみを表示しています。終電後にすぐ行ける宿だけ！
            </p>
                               {/* 人数・半径選択 */}
                   <div className="flex items-center space-x-6">
                     <div className="flex items-center space-x-2">
                       <label className="text-sm font-medium text-gray-700">
                         人数:
                       </label>
                       <select
                         value={adultNum}
                         onChange={(e) => handleAdultNumChange(parseInt(e.target.value))}
                         className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm text-gray-900"
                       >
                         <option value={1}>1人</option>
                         <option value={2}>2人</option>
                         <option value={3}>3人</option>
                         <option value={4}>4人</option>
                       </select>
                     </div>
                     
                     <div className="flex items-center space-x-2">
                       <label className="text-sm font-medium text-gray-700">
                         検索範囲:
                       </label>
                       <select
                         value={searchRadius}
                         onChange={(e) => setSearchRadius(parseInt(e.target.value))}
                         className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm text-gray-900"
                       >
                         <option value={2}>近場 (2km)</option>
                         <option value={3}>標準 (3km)</option>
                         <option value={5}>広め (5km)</option>
                       </select>
                     </div>
                   </div>
          </div>

          {/* 現在地から探すセクション */}
          <div className="py-4">
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation || useCurrentLocation}
                className="px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg text-lg min-w-[200px]"
              >
                {isGettingLocation ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
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
                  className="px-4 py-4 bg-gray-500 text-white font-semibold rounded-xl hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center shadow-lg text-lg"
                  title="現在地検索を解除"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* ステータス表示 */}
            {useCurrentLocation && currentLocation && (
              <div className="mt-4 p-3 bg-green-100 rounded-lg">
                <p className="text-sm text-green-700 flex items-center justify-center">
                  ✅ 現在地周辺のホテルを表示中 (半径2km以内)
                </p>
              </div>
            )}
            
            {isGettingLocation && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
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
            {/* 空室確認済みのホテルのみ表示するため、フォールバック警告は不要 */}
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
              空室が確認できるホテルがありません
            </h3>
            <p className="text-gray-600 mb-6">
              現在、当日空室のあるホテルが見つかりませんでした。<br />
              時間をおいて再度検索するか、エリアを変更してお試しください。
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
