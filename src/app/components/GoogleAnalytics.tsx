"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { GA_TRACKING_ID, trackPageView } from "@/lib/analytics";

export default function GoogleAnalytics() {
  // 一時的に無効化
  return null;
  
  // const pathname = usePathname();
  // const searchParams = useSearchParams();

  // // ページ遷移時のページビュー追跡
  // useEffect(() => {
  //   if (GA_TRACKING_ID) {
  //     const url = pathname + (searchParams.toString() ? `?${searchParams}` : '');
  //     trackPageView(url);
  //   }
  // }, [pathname, searchParams]);

  // // GA_TRACKING_IDが設定されていない場合は何も表示しない
  // if (!GA_TRACKING_ID) {
  //   return null;
  // }

  return (
    <>
      {/* Google Analytics GTM Script */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            
            gtag('config', '${GA_TRACKING_ID}', {
              page_title: document.title,
              page_location: window.location.href,
              send_page_view: false, // 手動でページビューを送信
              // プライバシー設定
              anonymize_ip: true,
              allow_google_signals: false,
              allow_ad_personalization_signals: false,
            });

            // Enhanced ecommerce設定
            gtag('config', '${GA_TRACKING_ID}', {
              custom_map: {
                'custom_parameter_1': 'hotel_area',
                'custom_parameter_2': 'search_method',
                'custom_parameter_3': 'distance_km'
              }
            });
          `,
        }}
      />
      
      {/* Google Analytics 4 Enhanced Ecommerce */}
      <Script
        id="ga4-ecommerce"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            // Enhanced Ecommerce events
            window.gtag_enhanced_ecommerce = {
              // ホテル表示イベント
              view_item_list: function(items, list_name) {
                gtag('event', 'view_item_list', {
                  item_list_id: list_name,
                  item_list_name: list_name,
                  items: items
                });
              },
              
              // ホテル詳細表示
              view_item: function(item) {
                gtag('event', 'view_item', {
                  currency: 'JPY',
                  value: item.price,
                  items: [item]
                });
              },
              
              // 予約ボタンクリック
              select_item: function(item) {
                gtag('event', 'select_item', {
                  item_list_id: 'hotel_search_results',
                  item_list_name: 'Hotel Search Results',
                  items: [item]
                });
              }
            };
          `,
        }}
      />
    </>
  );
}
