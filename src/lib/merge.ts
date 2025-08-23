import { type Hotel } from "@/app/data/hotels";

// 文字列正規化（大文字小文字・全半角・空白・記号のゆらぎ除去）
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '')
    .trim();
}

// 距離計算（Haversine公式）
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 地球の半径(km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // メートル単位
}

// 最寄り駅の類似性チェック
function isSimilarNearest(nearest1: string, nearest2: string): boolean {
  const normalized1 = nearest1.replace(/[0-9]+分|徒歩|車|バス/g, '').trim();
  const normalized2 = nearest2.replace(/[0-9]+分|徒歩|車|バス/g, '').trim();
  return normalized1.length > 0 && normalized2.length > 0 && 
         normalized1.startsWith(normalized2.substring(0, 3)) ||
         normalized2.startsWith(normalized1.substring(0, 3));
}

// 画像URLの解像度比較
function getBetterImageUrl(url1: string, url2: string): string {
  if (!url1) return url2;
  if (!url2) return url1;
  
  // URLにサイズ情報が含まれる場合の簡易判定
  const sizeMatch1 = url1.match(/(\d+)x(\d+)/);
  const sizeMatch2 = url2.match(/(\d+)x(\d+)/);
  
  if (sizeMatch1 && sizeMatch2) {
    const size1 = parseInt(sizeMatch1[1]) * parseInt(sizeMatch1[2]);
    const size2 = parseInt(sizeMatch2[1]) * parseInt(sizeMatch2[2]);
    return size1 >= size2 ? url1 : url2;
  }
  
  // 楽天優先
  if (url1.includes('rakuten')) return url1;
  if (url2.includes('rakuten')) return url2;
  
  return url1;
}

// ホテルの重複判定
function isDuplicate(hotel1: Hotel, hotel2: Hotel): boolean {
  // 名前の正規化比較
  const name1 = normalizeString(hotel1.name);
  const name2 = normalizeString(hotel2.name);
  
  if (name1 === name2) return true;
  
  // 座標がある場合は300m以内
  if (hotel1.latitude && hotel1.longitude && hotel2.latitude && hotel2.longitude) {
    const distance = calculateDistance(
      hotel1.latitude, hotel1.longitude,
      hotel2.latitude, hotel2.longitude
    );
    if (distance <= 300) return true;
  }
  
  // 最寄り駅の類似性
  if (hotel1.nearest && hotel2.nearest) {
    return isSimilarNearest(hotel1.nearest, hotel2.nearest);
  }
  
  return false;
}

// ホテルマージ
function mergeHotels(rakuten: Hotel, jalan: Hotel): Hotel {
  return {
    ...rakuten, // 楽天をベースに
    price: Math.min(rakuten.price, jalan.price), // 安い方
    imageUrl: getBetterImageUrl(rakuten.imageUrl, jalan.imageUrl),
    rating: rakuten.rating && jalan.rating 
      ? Math.round((rakuten.rating + jalan.rating) / 2 * 10) / 10
      : rakuten.rating || jalan.rating,
    // affiliateUrlは楽天優先（envで切替可能にする場合は process.env.PREFER_AFFILIATE）
    affiliateUrl: rakuten.affiliateUrl || jalan.affiliateUrl
  };
}

export function dedupeAndMerge(rakutenHotels: Hotel[], jalanHotels: Hotel[]): Hotel[] {
  const result: Hotel[] = [...rakutenHotels];
  
  for (const jalanHotel of jalanHotels) {
    const duplicateIndex = result.findIndex(rakutenHotel => 
      isDuplicate(rakutenHotel, jalanHotel)
    );
    
    if (duplicateIndex >= 0) {
      // 重複ホテルをマージ
      result[duplicateIndex] = mergeHotels(result[duplicateIndex], jalanHotel);
    } else {
      // 新規ホテルを追加
      result.push(jalanHotel);
    }
  }
  
  // 価格昇順でソート
  return result.sort((a, b) => a.price - b.price);
}
