// Google Analytics 4 (GA4) 用のユーティリティ

declare global {
  interface Window {
    gtag: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: {
        [key: string]: any;
      }
    ) => void;
    dataLayer: any[];
  }
}

export const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

// GA4が有効かどうかを判定
export const isGAEnabled = (): boolean => {
  return !!GA_TRACKING_ID && typeof window !== 'undefined';
};

// ページビューを送信
export const trackPageView = (url: string): void => {
  if (!isGAEnabled()) return;
  
  window.gtag('config', GA_TRACKING_ID!, {
    page_location: url,
    page_title: document.title,
  });
};

// カスタムイベントを送信
export const trackEvent = (
  action: string,
  category: string,
  label?: string,
  value?: number,
  customParameters?: { [key: string]: any }
): void => {
  if (!isGAEnabled()) return;

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
    ...customParameters,
  });
};

// ホテル検索イベント
export const trackHotelSearch = (params: {
  area?: string;
  priceFilter?: string;
  amenities?: string[];
  useCurrentLocation?: boolean;
  resultCount?: number;
}): void => {
  trackEvent('search', 'hotel', 'hotel_search', params.resultCount, {
    search_area: params.area,
    price_filter: params.priceFilter,
    amenities: params.amenities?.join(','),
    use_current_location: params.useCurrentLocation,
    result_count: params.resultCount,
  });
};

// ホテル予約ボタンクリック
export const trackHotelBooking = (hotelData: {
  hotelId: string;
  hotelName: string;
  price: number;
  area: string;
  distanceKm?: number;
}): void => {
  trackEvent('click', 'hotel', 'book_hotel', hotelData.price, {
    hotel_id: hotelData.hotelId,
    hotel_name: hotelData.hotelName,
    hotel_area: hotelData.area,
    hotel_price: hotelData.price,
    distance_km: hotelData.distanceKm,
  });
};

// 現在地取得イベント
export const trackLocationUsage = (success: boolean, error?: string): void => {
  trackEvent('interaction', 'location', success ? 'success' : 'error', success ? 1 : 0, {
    location_error: error,
  });
};

// フィルター使用イベント
export const trackFilterUsage = (filterType: string, filterValue: string): void => {
  trackEvent('interaction', 'filter', `${filterType}_${filterValue}`, 1, {
    filter_type: filterType,
    filter_value: filterValue,
  });
};

// パフォーマンスイベント
export const trackPerformance = (metrics: {
  loadTime?: number;
  apiResponseTime?: number;
  cacheHitRate?: number;
}): void => {
  if (metrics.loadTime) {
    trackEvent('performance', 'timing', 'page_load', metrics.loadTime);
  }
  if (metrics.apiResponseTime) {
    trackEvent('performance', 'timing', 'api_response', metrics.apiResponseTime);
  }
  if (metrics.cacheHitRate !== undefined) {
    trackEvent('performance', 'cache', 'hit_rate', metrics.cacheHitRate);
  }
};

// コンバージョンイベント（ホテル予約完了）
export const trackConversion = (conversionData: {
  value: number;
  currency?: string;
  hotelId: string;
  transactionId?: string;
}): void => {
  trackEvent('purchase', 'ecommerce', 'hotel_booking', conversionData.value, {
    currency: conversionData.currency || 'JPY',
    transaction_id: conversionData.transactionId,
    item_id: conversionData.hotelId,
    item_category: 'hotel',
  });
};

// エラートラッキング
export const trackError = (error: {
  type: 'api_error' | 'location_error' | 'ui_error' | 'javascript_error';
  message: string;
  stack?: string;
  url?: string;
}): void => {
  trackEvent('exception', 'error', error.type, 1, {
    error_message: error.message,
    error_stack: error.stack,
    error_url: error.url,
    fatal: false,
  });
};

// ユーザーエンゲージメント
export const trackEngagement = (action: string, target: string, duration?: number): void => {
  trackEvent('engagement', 'user', action, duration, {
    engagement_target: target,
    engagement_duration: duration,
  });
};


